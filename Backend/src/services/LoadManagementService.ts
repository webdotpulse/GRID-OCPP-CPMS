import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { setChargingProfile, clearChargingProfile } from "../ocpp/remoteControl.js";
import type { SetChargingProfileRequest } from "../types/index.js";

export class LoadManagementService {
  private isEngineRunning = false;
  private timeoutId?: NodeJS.Timeout;

  public startSmartChargingEngine() {
    if (this.isEngineRunning) return;
    this.isEngineRunning = true;
    this.runSmartChargingLoop();
  }

  public stopSmartChargingEngine() {
    this.isEngineRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  private async runSmartChargingLoop() {
    if (!this.isEngineRunning) return;

    try {
      // Pre-fetch all active transactions
      const allActiveTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
        },
        include: { charger: true }
      });

      const txsByGroupId = new Map<number, typeof allActiveTransactions>();
      const groupIds = new Set<number>();
      const stationIds = new Set<number>();

      for (const tx of allActiveTransactions) {
        const groupId = tx.charger.chargeGroupId;
        if (groupId) {
          groupIds.add(groupId);
          if (!txsByGroupId.has(groupId)) {
            txsByGroupId.set(groupId, []);
          }
          txsByGroupId.get(groupId)!.push(tx);
        }
        if (tx.charger.charging_station_id) {
          stationIds.add(tx.charger.charging_station_id);
        }
      }

      // 1. Balance active Charge Groups
      if (groupIds.size > 0) {
        const activeGroups = await prisma.chargeGroup.findMany({
          where: { id: { in: Array.from(groupIds) } }
        });

        for (const group of activeGroups) {
          const activeTransactions = txsByGroupId.get(group.id) || [];
          await this.balanceChargeGroupLoadWithData(group, activeTransactions).catch((err: any) =>
            logger.error(`Smart Charging engine error for group ${group.id}: ${err}`)
          );
          await this.balancePhasesForGroup(group.id).catch((err: any) =>
            logger.error(`Phase balancing error for group ${group.id}: ${err}`)
          );
        }
      }

      // 2. Balance active Charging Stations with maxPower limits
      if (stationIds.size > 0) {
        for (const stationId of stationIds) {
          await this.balanceSiteLoad(stationId).catch((err: any) =>
            logger.error(`Smart Charging engine error for station ${stationId}: ${err}`)
          );
        }
      }
    } catch (error) {
      logger.error(`Smart Charging engine global error: ${error}`);
    } finally {
      // Recursive algorithm: schedule next run after 60 seconds
      if (this.isEngineRunning) {
        this.timeoutId = setTimeout(() => this.runSmartChargingLoop(), 60 * 1000);
      }
    }
  }
  /**
   * Calculate the total current power draw for a specific site
   */
  async calculateSiteLoad(stationId: number): Promise<number> {
    const aggregateLoad = await prisma.transaction.aggregate({
      where: {
        status: { in: ["initiated", "charging"] },
        charger: { charging_station_id: stationId }
      },
      _sum: {
        currentPower: true
      }
    });

    return (aggregateLoad._sum.currentPower || 0) / 1000;
  }

  /**
   * Balance load across a charging station based on maxPower constraints
   */
  async balanceSiteLoad(stationId: number): Promise<void> {
    try {
      const station = await prisma.chargingStation.findUnique({
        where: { id: stationId },
        include: { chargers: true }
      });

      if (!station || !station.maxPower) {
        logger.debug(`Load balancing skipped: Station ${stationId} has no maxPower defined.`);
        return;
      }

      // Find all active transactions at this station
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
          charger: { charging_station_id: stationId }
        },
        include: { charger: true }
      });

      if (activeTransactions.length === 0) {
        return; // No active transactions, nothing to balance
      }

      // 1) Find ACTUAL active load (what the cars are currently drawing).
      // We use actual load to know when a site is overloaded, so dynamic limits can kick in.
      const aggregateLoad = await prisma.transaction.aggregate({
        where: {
          status: { in: ["initiated", "charging"] },
          charger: { charging_station_id: stationId }
        },
        _sum: {
          currentPower: true
        }
      });

      let totalActiveLoadKw = (aggregateLoad._sum.currentPower || 0) / 1000;

      // 2) Find THEORETICAL max load (what the chargers COULD draw if unbounded).
      // We use theoretical load to decide when it's safe to CLEAR limits.
      // If we used actual load to clear limits, we'd clear them as soon as throttling
      // took effect, causing an oscillation (limit on -> load drops -> limit off -> load spikes -> limit on).
      let theoreticalMaxLoadKw = activeTransactions.reduce(
        (sum, tx) => sum + (tx.charger.power_capacity || 0),
        0
      );

      const safeLimitKw = station.maxPower * 0.95;

      // If THEORETICAL max load is safely under limits, clear limits.
      if (theoreticalMaxLoadKw <= safeLimitKw) {
        logger.debug(`Station ${stationId} theoretical load (${theoreticalMaxLoadKw.toFixed(1)}kW) within safe limit (${safeLimitKw.toFixed(1)}kW). Clearing any existing load management profiles.`);
        const clearPromises = activeTransactions.map(tx => this.clearLoadManagementProfile(tx.charger_id, 110));
        const clearResults = await Promise.allSettled(clearPromises);
        clearResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(`Failed to clear load management profile for charger ${activeTransactions[index].charger_id}: ${result.reason}`);
          }
        });
        return;
      }

      // If ACTUAL active load exceeds safe limit, or if limits are needed to prevent going over.
      // (If theoretical > safe limit, we must always enforce limits to be safe)
      logger.info(`Station ${stationId} load (Active: ${totalActiveLoadKw.toFixed(1)}kW, Theoretical: ${theoreticalMaxLoadKw.toFixed(1)}kW) requires load balancing (Safe Limit: ${safeLimitKw.toFixed(1)}kW).`);

      // Dynamic Equal Distribution:
      // (In a more advanced implementation, this could allocate more to cars drawing more,
      //  but equal distribution guarantees fairness and prevents starvation).
      const limitPerTransactionKw = Math.max(1.4, safeLimitKw / activeTransactions.length);
      const limitW = Math.floor(limitPerTransactionKw * 1000);

      // Pre-fetch all relevant charging profiles in a single query (Profile 110 for Site Load Management)
      const chargerIds = activeTransactions.map(tx => tx.charger_id);
      const existingProfilesList = await prisma.chargingProfile.findMany({
        where: { chargerId: { in: chargerIds }, chargingProfileId: 110 }
      });
      const existingProfilesMap = new Map(existingProfilesList.map(p => [p.chargerId, p]));

      // Apply the limits via SetChargingProfile
      const dispatchPromises: Promise<void>[] = [];
      const txsWithPromises: typeof activeTransactions = [];

      for (const tx of activeTransactions) {
        // Skip dispatch if profile already exists with exact limit AND charger is adhering to it
        const existingProfile = existingProfilesMap.get(tx.charger_id);

        const existingSchedule = existingProfile?.chargingSchedule as any;
        const currentLimitW = existingSchedule?.chargingSchedulePeriod?.[0]?.limit;

        if (existingProfile && currentLimitW === limitW) {
          if ((tx.currentPower || 0) <= limitW * 1.05) {
            continue; // Limit already applied and adhering, skip redundant dispatch
          }
        }

        const profileRequest: SetChargingProfileRequest = {
          chargerId: tx.charger_id,
          connectorId: 0, // 0 = entire Charge Point
          csChargingProfiles: {
            chargingProfileId: 110, // Static ID 110 representing Site Load Management
            stackLevel: 1,
            chargingProfilePurpose: "ChargePointMaxProfile",
            chargingProfileKind: "Absolute",
            chargingSchedule: {
              chargingRateUnit: "W", // kW converted to W
              chargingSchedulePeriod: [
                {
                  startPeriod: 0,
                  limit: limitW
                }
              ]
            }
          }
        };

        dispatchPromises.push(this.dispatchChargingProfiles(profileRequest));
        txsWithPromises.push(tx);
      }

      if (dispatchPromises.length > 0) {
        const dispatchResults = await Promise.allSettled(dispatchPromises);
        dispatchResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(`Failed to dispatch charging profile for charger ${txsWithPromises[index].charger_id}: ${result.reason}`);
          }
        });
      }
    } catch (error) {
      logger.error(`Error in balanceSiteLoad for station ${stationId}: ${error}`);
    }
  }

  /**
   * Balance load across a Charge Group based on maxPower constraints
   */
  async balanceChargeGroupLoad(groupId: number): Promise<void> {
    try {
      const group = await prisma.chargeGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) return;

      const activeTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
          charger: { chargeGroupId: groupId }
        },
        include: { charger: true }
      });

      if (activeTransactions.length === 0) return;

      await this.balanceChargeGroupLoadWithData(group, activeTransactions);
    } catch (error) {
      logger.error(`Error in balanceChargeGroupLoad for group ${groupId}: ${error}`);
    }
  }

  async balanceChargeGroupLoadWithData(group: any, activeTransactions: any[]): Promise<void> {
    try {
      const groupId = group.id;
      if (activeTransactions.length === 0) return;

      // Calculate theoretical max power capacity of the chargers to prevent oscillation when clearing
      let theoreticalMaxLoadKw = activeTransactions.reduce(
        (sum, tx) => sum + (tx.charger.power_capacity || 0),
        0
      );

      // --- 1. AMPERAGE BALANCING ---
      if (group.maxAmperage) {
        // Find ACTUAL active current from in-memory array
        let totalActiveCurrent = activeTransactions.reduce((sum, tx) => sum + (tx.current || 0), 0);

        const safeLimitAmps = group.maxAmperage * 0.95;

        // Calculate theoretical max current based on power capacity (assuming 230V per phase, or just a rough max estimate).
        // A safer way is estimating max amperage from the power capacity. E.g. 22kW -> ~32A (3-phase)
        let theoreticalMaxCurrentAmps = activeTransactions.reduce((sum, tx) => {
          // If power capacity exists, estimate max amps. Using a conservative estimate of 32A max per typical AC charger.
          // Or just using total active transactions * 32A.
          const estimatedMaxTxAmps = tx.charger.power_capacity ? Math.ceil((tx.charger.power_capacity * 1000) / (230 * 3)) : 32;
          return sum + Math.max(32, estimatedMaxTxAmps); // Default to at least 32A assumption per charger
        }, 0);

        if (theoreticalMaxCurrentAmps <= safeLimitAmps) {
          logger.debug(`Charge Group ${groupId} theoretical current (${theoreticalMaxCurrentAmps.toFixed(1)}A) within safe limit (${safeLimitAmps.toFixed(1)}A). Clearing any existing amp load management profiles.`);
          const clearPromises = activeTransactions.map(tx => this.clearLoadManagementProfile(tx.charger_id, 101));
          const clearResults = await Promise.allSettled(clearPromises);
          clearResults.forEach((result, index) => {
            if (result.status === "rejected") {
              logger.error(`Failed to clear amp load management profile for charger ${activeTransactions[index].charger_id}: ${result.reason}`);
            }
          });
        } else {
          logger.info(`Charge Group ${groupId} active current (${totalActiveCurrent.toFixed(1)}A, Theoretical: ${theoreticalMaxCurrentAmps.toFixed(1)}A) requires load balancing (Safe Limit: ${safeLimitAmps.toFixed(1)}A).`);

          // Prioritize older transactions; suspend others if safe limit drops below 6A per active transaction
          const sortedTransactions = [...activeTransactions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          const maxActiveChargers = Math.max(1, Math.floor(safeLimitAmps / 6)); // At least 1 to avoid divide-by-zero
          const activeCount = Math.min(sortedTransactions.length, maxActiveChargers);
          const limitPerTransactionAmps = Math.floor(safeLimitAmps / activeCount);

          const chargerIds = activeTransactions.map(tx => tx.charger_id);
          const existingAmpProfilesList = await prisma.chargingProfile.findMany({
            where: { chargerId: { in: chargerIds }, chargingProfileId: 101 }
          });
          const existingAmpProfilesMap = new Map(existingAmpProfilesList.map(p => [p.chargerId, p]));

          const dispatchPromises: Promise<void>[] = [];
          const txsWithPromises: typeof activeTransactions = [];

          for (let i = 0; i < sortedTransactions.length; i++) {
            const tx = sortedTransactions[i];
            const currentTxLimitAmps = i < activeCount ? limitPerTransactionAmps : 0;

            const existingProfile = existingAmpProfilesMap.get(tx.charger_id);

            const existingSchedule = existingProfile?.chargingSchedule as any;
            const currentLimitAmps = existingSchedule?.chargingSchedulePeriod?.[0]?.limit;

            if (existingProfile && currentLimitAmps === currentTxLimitAmps) {
              if ((tx.current || 0) <= currentTxLimitAmps * 1.05) {
                continue; // Limit already applied and adhering, skip redundant dispatch
              }
            }

            const profileRequest: SetChargingProfileRequest = {
              chargerId: tx.charger_id,
              connectorId: 0,
              csChargingProfiles: {
                chargingProfileId: 101, // ID representing Smart Load Management (Amps)
                stackLevel: 2, // Higher priority
                chargingProfilePurpose: "TxDefaultProfile", // Throttling charging speeds for tx
                chargingProfileKind: "Absolute",
                chargingSchedule: {
                  chargingRateUnit: "A", // Using Amps
                  chargingSchedulePeriod: [
                    {
                      startPeriod: 0,
                      limit: currentTxLimitAmps
                    }
                  ]
                }
              }
            };

            // Dispatch profile to throttle
            dispatchPromises.push(this.dispatchChargingProfiles(profileRequest));
            txsWithPromises.push(tx);
          }

          if (dispatchPromises.length > 0) {
            const dispatchResults = await Promise.allSettled(dispatchPromises);
            dispatchResults.forEach((result, index) => {
              if (result.status === "rejected") {
                logger.error(`Failed to dispatch amp throttle profile for tx ${txsWithPromises[index].id}: ${result.reason}`);
              }
            });
          }
        }
      }

      // --- 2. POWER BALANCING ---
      if (!group.maxPower) return;

      const safeLimitKw = group.maxPower * 0.95;

      // Find ACTUAL active load from in-memory array
      let totalActiveLoadKw = activeTransactions.reduce((sum, tx) => sum + ((tx.currentPower || 0) / 1000), 0);

      // CLEAR limits based on THEORETICAL max load to prevent oscillation
      if (theoreticalMaxLoadKw <= safeLimitKw) {
        logger.debug(`Charge Group ${groupId} theoretical load (${theoreticalMaxLoadKw.toFixed(1)}kW) within safe limit (${safeLimitKw.toFixed(1)}kW). Clearing any existing load management profiles.`);
        const clearPromises = activeTransactions.map(tx => this.clearLoadManagementProfile(tx.charger_id, 100));
        const clearResults = await Promise.allSettled(clearPromises);
        clearResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(`Failed to clear power load management profile for charger ${activeTransactions[index].charger_id}: ${result.reason}`);
          }
        });
        return;
      }

      // APPLY limits based on ACTUAL load or if theoretical limit enforces it
      logger.info(`Charge Group ${groupId} load (Active: ${totalActiveLoadKw.toFixed(1)}kW, Theoretical: ${theoreticalMaxLoadKw.toFixed(1)}kW) requires load balancing (Safe Limit: ${safeLimitKw.toFixed(1)}kW).`);

      // Prioritize older transactions; suspend others if safe limit drops below 1.4kW per active transaction
      const sortedTransactionsKw = [...activeTransactions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      const maxActiveChargersKw = Math.max(1, Math.floor(safeLimitKw / 1.4));
      const activeCountKw = Math.min(sortedTransactionsKw.length, maxActiveChargersKw);
      const limitPerTransactionKw = safeLimitKw / activeCountKw;

      const chargerIdsKw = activeTransactions.map(tx => tx.charger_id);
      const existingPowerProfilesList = await prisma.chargingProfile.findMany({
        where: { chargerId: { in: chargerIdsKw }, chargingProfileId: 100 }
      });
      const existingPowerProfilesMap = new Map(existingPowerProfilesList.map(p => [p.chargerId, p]));

      const dispatchPromises: Promise<void>[] = [];
      const txsWithPromises: typeof activeTransactions = [];

      for (let i = 0; i < sortedTransactionsKw.length; i++) {
        const tx = sortedTransactionsKw[i];
        const limitW = i < activeCountKw ? Math.floor(limitPerTransactionKw * 1000) : 0;

        const existingProfile = existingPowerProfilesMap.get(tx.charger_id);

        const existingSchedule = existingProfile?.chargingSchedule as any;
        const currentLimitW = existingSchedule?.chargingSchedulePeriod?.[0]?.limit;

        if (existingProfile && currentLimitW === limitW) {
          if ((tx.currentPower || 0) <= limitW * 1.05) {
            continue; // Limit already applied and adhering, skip redundant dispatch
          }
        }

        const profileRequest: SetChargingProfileRequest = {
          chargerId: tx.charger_id,
          connectorId: 0,
          csChargingProfiles: {
            chargingProfileId: 100, // Static ID representing Load Management
            stackLevel: 1,
            chargingProfilePurpose: "ChargePointMaxProfile",
            chargingProfileKind: "Absolute",
            chargingSchedule: {
              chargingRateUnit: "W",
              chargingSchedulePeriod: [
                {
                  startPeriod: 0,
                  limit: limitW
                }
              ]
            }
          }
        };

        dispatchPromises.push(this.dispatchChargingProfiles(profileRequest));
        txsWithPromises.push(tx);
      }

      if (dispatchPromises.length > 0) {
        const dispatchResults = await Promise.allSettled(dispatchPromises);
        dispatchResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(`Failed to dispatch power throttle profile for charger ${txsWithPromises[index].charger_id}: ${result.reason}`);
          }
        });
      }
    } catch (error) {
      logger.error(`Error in balanceChargeGroupLoadWithData for group ${group.id}: ${error}`);
    }
  }

  /**
   * Dispatch a ChargingProfile and save it to the database
   */
  async dispatchChargingProfiles(request: SetChargingProfileRequest): Promise<void> {
    try {
      const response = await setChargingProfile(request);

      if (response.status === "Accepted") {
        logger.info(`Charging profile accepted by charger ${request.chargerId}`);

        // Save applied profile to DB
        await prisma.chargingProfile.upsert({
          where: {
            chargerId_chargingProfileId: {
              chargerId: request.chargerId,
              chargingProfileId: request.csChargingProfiles.chargingProfileId
            }
          },
          update: {
            connectorId: request.connectorId,
            stackLevel: request.csChargingProfiles.stackLevel,
            chargingProfilePurpose: request.csChargingProfiles.chargingProfilePurpose,
            chargingProfileKind: request.csChargingProfiles.chargingProfileKind,
            recurrencyKind: request.csChargingProfiles.recurrencyKind,
            validFrom: request.csChargingProfiles.validFrom ? new Date(request.csChargingProfiles.validFrom) : null,
            validTo: request.csChargingProfiles.validTo ? new Date(request.csChargingProfiles.validTo) : null,
            chargingSchedule: request.csChargingProfiles.chargingSchedule as any
          },
          create: {
            chargerId: request.chargerId,
            connectorId: request.connectorId,
            chargingProfileId: request.csChargingProfiles.chargingProfileId,
            stackLevel: request.csChargingProfiles.stackLevel,
            chargingProfilePurpose: request.csChargingProfiles.chargingProfilePurpose,
            chargingProfileKind: request.csChargingProfiles.chargingProfileKind,
            recurrencyKind: request.csChargingProfiles.recurrencyKind,
            validFrom: request.csChargingProfiles.validFrom ? new Date(request.csChargingProfiles.validFrom) : null,
            validTo: request.csChargingProfiles.validTo ? new Date(request.csChargingProfiles.validTo) : null,
            chargingSchedule: request.csChargingProfiles.chargingSchedule as any
          }
        });
      } else {
        logger.warn(`Charging profile rejected by charger ${request.chargerId}`);
      }
    } catch (error) {
      logger.error(`Error dispatching charging profile: ${error}`);
      throw error;
    }
  }

  /**
   * Clear the load management profile from a charger
   */
  async clearLoadManagementProfile(chargerId: number, profileId: number = 100): Promise<void> {
    try {
      // Only clear if the profile actually exists in the database
      const existingProfile = await prisma.chargingProfile.findUnique({
        where: {
          chargerId_chargingProfileId: { chargerId, chargingProfileId: profileId }
        }
      });

      if (!existingProfile) {
        return; // Profile already cleared or never set, skip redundant dispatch
      }

      const response = await clearChargingProfile({
        chargerId,
        id: profileId,
        chargingProfilePurpose: profileId === 101 ? "TxDefaultProfile" : "ChargePointMaxProfile"
      });

      if (response.status === "Accepted") {
        logger.info(`Load management profile ${profileId} cleared for charger ${chargerId}`);
        await prisma.chargingProfile.deleteMany({
          where: {
            chargerId: chargerId,
            chargingProfileId: profileId
          }
        });
      }
    } catch (error) {
      logger.error(`Error clearing load management profile ${profileId} for charger ${chargerId}: ${error}`);
      throw error;
    }
  }

  /**
   * 3-Phase Dynamic Load Balancing & Phase Unbalance Mitigation (ENG-01)
   */
  async balancePhasesForGroup(groupId: number): Promise<any> {
    try {
      const group = await prisma.chargeGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        logger.warn(`Phase balancing skipped: ChargeGroup ${groupId} not found`);
        return { balanced: true, groupId, error: "Group not found" };
      }

      const maxPhaseCurrent = (group as any).maxPhaseCurrent ?? 80.0;
      const maxPhaseUnbalance = (group as any).maxPhaseUnbalance ?? group.phaseUnbalanceLimit ?? 16.0;

      // Fetch active transactions and their associated charger & connectors
      const activeTransactions = await prisma.transaction.findMany({
        where: {
          status: { in: ["initiated", "charging"] },
          charger: { chargeGroupId: groupId },
        },
        include: {
          charger: {
            include: {
              evses: {
                include: {
                  connectors: true,
                },
              },
            },
          },
        },
      });

      if (activeTransactions.length === 0) {
        return {
          balanced: true,
          groupId,
          phaseLoads: { L1: 0, L2: 0, L3: 0 },
          maxPhase: "L1",
          unbalance: 0,
          isOverCurrent: false,
          isUnbalanced: false,
          actionsTaken: [],
        };
      }

      // 1. Calculate per-phase currents for each active transaction
      const txPhaseData: Array<{
        tx: any;
        chargerId: number;
        phaseConnection: string;
        currentL1: number;
        currentL2: number;
        currentL3: number;
        totalCurrent: number;
      }> = [];

      let totalL1 = 0;
      let totalL2 = 0;
      let totalL3 = 0;

      for (const tx of activeTransactions) {
        // Resolve connector phase mapping
        let phaseConnection = "L1-L2-L3";
        for (const evse of tx.charger.evses || []) {
          const matchingConn = (evse.connectors || []).find(
            (c: any) =>
              c.connector_name === tx.connectorName ||
              String(c.connector_id) === tx.connectorName ||
              String(evse.evse_id) === tx.connectorName ||
              (evse.connectors && evse.connectors.length === 1)
          );
          if (matchingConn && (matchingConn as any).phaseConnection) {
            phaseConnection = (matchingConn as any).phaseConnection;
            break;
          }
        }

        // Fetch latest meter telemetry for accurate phase current
        const latestMeter = await prisma.meterValue.findFirst({
          where: { transactionId: tx.transactionId },
          orderBy: { timestamp: "desc" },
        });

        let l1 = 0;
        let l2 = 0;
        let l3 = 0;

        if (
          latestMeter &&
          (latestMeter.current_L1 !== null ||
            latestMeter.current_L2 !== null ||
            latestMeter.current_L3 !== null)
        ) {
          l1 = latestMeter.current_L1 || 0;
          l2 = latestMeter.current_L2 || 0;
          l3 = latestMeter.current_L3 || 0;
        } else {
          const rawCurrent = tx.current || latestMeter?.current || 16;
          const connUpper = phaseConnection.toUpperCase();

          if (connUpper === "L1") {
            l1 = rawCurrent;
          } else if (connUpper === "L2") {
            l2 = rawCurrent;
          } else if (connUpper === "L3") {
            l3 = rawCurrent;
          } else {
            // 3-Phase balanced
            l1 = rawCurrent;
            l2 = rawCurrent;
            l3 = rawCurrent;
          }
        }

        totalL1 += l1;
        totalL2 += l2;
        totalL3 += l3;

        txPhaseData.push({
          tx,
          chargerId: tx.charger_id,
          phaseConnection,
          currentL1: l1,
          currentL2: l2,
          currentL3: l3,
          totalCurrent: Math.max(l1, l2, l3),
        });
      }

      totalL1 = Math.round(totalL1 * 10) / 10;
      totalL2 = Math.round(totalL2 * 10) / 10;
      totalL3 = Math.round(totalL3 * 10) / 10;

      const maxCurrent = Math.max(totalL1, totalL2, totalL3);
      const minCurrent = Math.min(totalL1, totalL2, totalL3);
      const unbalance = Math.round((maxCurrent - minCurrent) * 10) / 10;

      const maxPhase: "L1" | "L2" | "L3" =
        totalL1 === maxCurrent ? "L1" : totalL2 === maxCurrent ? "L2" : "L3";

      const isOverCurrent = totalL1 > maxPhaseCurrent || totalL2 > maxPhaseCurrent || totalL3 > maxPhaseCurrent;
      const isUnbalanced = unbalance > maxPhaseUnbalance;

      logger.info(
        `[3-Phase DLB] Group ${groupId} Phase Loads -> L1: ${totalL1}A, L2: ${totalL2}A, L3: ${totalL3}A | Unbalance: ${unbalance}A (Max Allowed: ${maxPhaseUnbalance}A, Max Phase Limit: ${maxPhaseCurrent}A)`
      );

      // 2. Clear phase throttling profiles if site is balanced and safe
      if (!isOverCurrent && !isUnbalanced) {
        const chargerIds = activeTransactions.map((tx) => tx.charger_id);
        const existingPhaseProfiles = await prisma.chargingProfile.findMany({
          where: { chargerId: { in: chargerIds }, chargingProfileId: 102 },
        });

        if (existingPhaseProfiles.length > 0) {
          logger.info(`[3-Phase DLB] Group ${groupId} is balanced. Clearing phase unbalance profiles.`);
          for (const p of existingPhaseProfiles) {
            await this.clearLoadManagementProfile(p.chargerId, 102).catch((err) =>
              logger.error(`Error clearing phase profile on charger ${p.chargerId}: ${err}`)
            );
          }
        }

        return {
          balanced: true,
          groupId,
          phaseLoads: { L1: totalL1, L2: totalL2, L3: totalL3 },
          maxPhase,
          unbalance,
          isOverCurrent: false,
          isUnbalanced: false,
          actionsTaken: [],
        };
      }

      // 3. Mitigate over-current or phase unbalance by throttling transactions on the highest phase
      logger.warn(
        `[3-Phase DLB] Phase unbalance/overload detected on group ${groupId}! Mitigating load on phase ${maxPhase}...`
      );

      const safeCap = maxPhaseCurrent * 0.95;
      const unbalanceCap = minCurrent + maxPhaseUnbalance;
      const targetPhaseMax = Math.min(safeCap, unbalanceCap);
      const reductionRequired = Math.max(0, maxCurrent - targetPhaseMax);

      // Find transactions contributing current to the overloaded phase
      const contributingTxs = txPhaseData.filter((item) => {
        if (maxPhase === "L1") return item.currentL1 > 0;
        if (maxPhase === "L2") return item.currentL2 > 0;
        if (maxPhase === "L3") return item.currentL3 > 0;
        return false;
      });

      // Sort single-phase vehicles on maxPhase first (they are the root cause of unbalance)
      contributingTxs.sort((a, b) => {
        const aSingle = a.phaseConnection.toUpperCase() === maxPhase ? 1 : 0;
        const bSingle = b.phaseConnection.toUpperCase() === maxPhase ? 1 : 0;
        if (aSingle !== bSingle) return bSingle - aSingle;
        return b.totalCurrent - a.totalCurrent;
      });

      const actionsTaken: Array<{
        chargerId: number;
        transactionId: string;
        phaseConnection: string;
        originalCurrent: number;
        newLimitAmps: number;
      }> = [];

      let remainingReduction = reductionRequired;

      for (const item of contributingTxs) {
        if (remainingReduction <= 0) break;

        const currentDrawn =
          maxPhase === "L1"
            ? item.currentL1
            : maxPhase === "L2"
            ? item.currentL2
            : item.currentL3;

        // Calculate throttled current limit (minimum 6A)
        const proposedLimit = Math.max(6, Math.floor(currentDrawn - remainingReduction));
        const delta = currentDrawn - proposedLimit;

        if (delta > 0) {
          remainingReduction -= delta;

          const profileRequest: SetChargingProfileRequest = {
            chargerId: item.chargerId,
            connectorId: 0,
            csChargingProfiles: {
              chargingProfileId: 102, // 102 = 3-Phase DLB Unbalance Mitigation Profile
              stackLevel: 3, // Highest priority to immediately protect grid breakers
              chargingProfilePurpose: "TxDefaultProfile",
              chargingProfileKind: "Absolute",
              chargingSchedule: {
                chargingRateUnit: "A",
                chargingSchedulePeriod: [
                  {
                    startPeriod: 0,
                    limit: proposedLimit,
                  },
                ],
              },
            },
          };

          await this.dispatchChargingProfiles(profileRequest).catch((err) =>
            logger.error(`Error dispatching phase throttle profile to charger ${item.chargerId}: ${err}`)
          );

          actionsTaken.push({
            chargerId: item.chargerId,
            transactionId: item.tx.transactionId,
            phaseConnection: item.phaseConnection,
            originalCurrent: currentDrawn,
            newLimitAmps: proposedLimit,
          });
        }
      }

      return {
        balanced: false,
        groupId,
        phaseLoads: { L1: totalL1, L2: totalL2, L3: totalL3 },
        maxPhase,
        unbalance,
        isOverCurrent,
        isUnbalanced,
        reductionRequired,
        actionsTaken,
      };
    } catch (error: any) {
      logger.error(`Error in balancePhasesForGroup for group ${groupId}: ${error}`);
      return { balanced: false, groupId, error: error.message || "Phase balancing failure" };
    }
  }
}

export const loadManagementService = new LoadManagementService();

