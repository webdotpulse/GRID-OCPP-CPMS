import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { setChargingProfile } from "../ocpp/remoteControl.js";
import { redisClient } from "../config/redis.js";

export class V2GOrchestrationService {
  /**
   * Evaluates if we need to dispatch V2G discharging commands based on building load (EMS telemetry).
   * Can evaluate all active gateways, or a specific gateway if gatewayId is provided.
   */
  public static async evaluateAndDispatchV2G(gatewayId?: string, currentGridKw?: number, gridLimitKw?: number) {
    try {
      logger.info(`Evaluating V2G Orchestration based on EMS telemetry...${gatewayId ? ` (Gateway: ${gatewayId})` : ""}`);

      // 1. Get active EMS Gateways
      const gateways = gatewayId
        ? await prisma.emsGateway.findMany({ where: { gateway_id: gatewayId, status: "online" } })
        : await prisma.emsGateway.findMany({ where: { status: "online" } });

      for (const gateway of gateways) {
        // If V2G is disabled on this gateway, ensure any ongoing V2G discharge is stopped
        if (gateway.v2gEnabled === false) {
          await this.stopV2GDischargeForClient(gateway.client_id);
          continue;
        }

        let gridKw = currentGridKw;
        if (gridKw === undefined) {
          // Retrieve telemetry from Redis (recent data)
          const redisKey = `ems_telemetry:${gateway.gateway_id}`;
          const telemetryRaw = await redisClient.hgetall(redisKey);

          if (!telemetryRaw || Object.keys(telemetryRaw).length === 0) {
            continue; // No recent telemetry for this gateway
          }

          gridKw = parseFloat(telemetryRaw.grid_kw || "0");
        }

        const maxGridImport = gridLimitKw ?? gateway.maxGridImport ?? 5.0;

        // If the house is drawing high power exceeding grid import limit, trigger V2G
        if (gridKw > maxGridImport) {
          const excessLoadKw = gridKw - maxGridImport;
          await this.triggerV2GDischargeForClient(gateway.client_id, excessLoadKw > 0 ? excessLoadKw : gridKw);
        } else {
          await this.stopV2GDischargeForClient(gateway.client_id);
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
