import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { setChargingProfile } from "../ocpp/remoteControl.js";

export class V2GOrchestrationService {
  /**
   * Evaluates if we need to dispatch V2G discharging commands based on grid load or high peak tariffs.
   * Can evaluate all active clients or a specific client if clientId is provided.
   */
  public static async evaluateAndDispatchV2G(clientId?: number, currentGridKw?: number, gridLimitKw?: number) {
    try {
      logger.info(`Evaluating V2G Orchestration...${clientId ? ` (Client: ${clientId})` : ""}`);

      if (clientId !== undefined && currentGridKw !== undefined) {
        const maxGridImport = gridLimitKw ?? 5.0;
        if (currentGridKw > maxGridImport) {
          const excessLoadKw = currentGridKw - maxGridImport;
          await this.triggerV2GDischargeForClient(clientId, excessLoadKw > 0 ? excessLoadKw : currentGridKw);
        } else {
          await this.stopV2GDischargeForClient(clientId);
        }
        return;
      }

      // Find all active transactions with V2G capability
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
          ...(clientId ? { charger: { owner_id: clientId } } : {})
        },
        include: {
          charger: true,
          rfidUser: {
            include: { vehicleEnergyProfile: true }
          }
        }
      });

      const clientIds = Array.from(new Set(activeTransactions.map(tx => tx.charger?.owner_id).filter((id): id is number => id !== null && id !== undefined)));

      for (const cId of clientIds) {
        if (currentGridKw !== undefined) {
          const maxGridImport = gridLimitKw ?? 5.0;
          if (currentGridKw > maxGridImport) {
            const excessLoadKw = currentGridKw - maxGridImport;
            await this.triggerV2GDischargeForClient(cId, excessLoadKw > 0 ? excessLoadKw : currentGridKw);
          } else {
            await this.stopV2GDischargeForClient(cId);
          }
        }
      }

    } catch (error) {
      logger.error(`Error in evaluateAndDispatchV2G: ${error}`);
    }
  }

  /**
   * Triggers V2G discharge for a specific client's active transactions.
   */
  public static async triggerV2GDischargeForClient(clientId: number, gridLoadKw: number) {
    try {
      // Find active transactions for this client's chargers
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
          charger: { owner_id: clientId }
        },
        include: {
          charger: true,
          rfidUser: {
            include: { vehicleEnergyProfile: true }
          }
        }
      });

      // Extract active transaction IDs for batch fetching
      const transactionIds = activeTransactions.map(tx => tx.transactionId);

      // Fetch the latest meter value for all active transactions in a single query
      const latestMeterValues = await prisma.meterValue.findMany({
        where: { transactionId: { in: transactionIds } },
        orderBy: { timestamp: "desc" },
        distinct: ["transactionId"]
      });

      // Map for quick lookup
      const meterValueMap = new Map(latestMeterValues.map(mv => [mv.transactionId, mv]));

      for (const tx of activeTransactions) {
        // Skip if already explicitly set to discharge at a sufficient rate
        if (tx.currentDirection === "Discharging") continue;

        let profile = tx.rfidUser?.vehicleEnergyProfile;
        if (!profile && tx.charger?.owner_id) {
          profile = await prisma.vehicleEnergyProfile.findFirst({
            where: { userId: tx.charger.owner_id }
          }) as any;
        }

        const minSoc = profile ? profile.minSocThreshold : 40.0;

        const latestMeterValue = meterValueMap.get(tx.transactionId);

        // Safely determine current SoC (never use finalMeterValue in Wh as percentage SoC)
        const currentSoc = latestMeterValue?.soc ?? tx.soc ?? 100;

        if (currentSoc > minSoc) {
           // We have enough charge. Dispatch negative power profile.
           // Use actual charger capacity, ensuring we cap it so we don't discharge more than the charger is rated for
           const chargerCapacityKw = tx.charger.power_capacity || 11;
           const limitKw = -Math.min(gridLoadKw, chargerCapacityKw);
           const limitAmps = (limitKw * 1000) / 230; // Approx negative amps

           logger.info(`Triggering V2G discharge for tx ${tx.id} on charger ${tx.charger_id} at ${limitKw}kW (${limitAmps.toFixed(1)}A)`);

           const profileRequest = {
            chargerId: tx.charger_id,
            connectorId: 0,
            csChargingProfiles: {
              chargingProfileId: 300, // V2G Discharge Profile ID
              stackLevel: 3,          // Higher priority than normal load balancing
              chargingProfilePurpose: "TxDefaultProfile" as const,
              chargingProfileKind: "Absolute" as const,
              chargingSchedule: {
                chargingRateUnit: "A" as const,
                chargingSchedulePeriod: [
                  {
                    startPeriod: 0,
                    limit: limitAmps // Negative limit indicates discharging in V2G extension/2.0.1
                  }
                ]
              }
            }
          };

          const response = await setChargingProfile(profileRequest);

          if (response && response.status === "Accepted") {
            // Update transaction
            await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                currentDirection: "Discharging",
                dischargeLimit: limitAmps
              }
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error triggering V2G for client ${clientId}: ${error}`);
    }
  }

  /**
   * Stops V2G discharge when grid load normalizes.
   */
  public static async stopV2GDischargeForClient(clientId: number) {
    try {
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
          charger: { owner_id: clientId },
          currentDirection: "Discharging"
        }
      });

      for (const tx of activeTransactions) {
         logger.info(`Stopping V2G discharge for tx ${tx.id} on charger ${tx.charger_id}`);

         const profileRequest = {
          chargerId: tx.charger_id,
          connectorId: 0,
          csChargingProfiles: {
            chargingProfileId: 300,
            stackLevel: 3,
            chargingProfilePurpose: "TxDefaultProfile" as const,
            chargingProfileKind: "Absolute" as const,
            chargingSchedule: {
              chargingRateUnit: "A" as const,
              chargingSchedulePeriod: [
                {
                  startPeriod: 0,
                  limit: 0
                }
              ]
            }
          }
        };

        const response = await setChargingProfile(profileRequest);

        if (response && response.status === "Accepted") {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              currentDirection: "Charging",
              dischargeLimit: null
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error stopping V2G for client ${clientId}: ${error}`);
    }
  }
}
