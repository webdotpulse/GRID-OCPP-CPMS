import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface ChargingSchedulePeriod {
  startPeriod: number;
  limit: number;
  numberPhases?: number;
  minChargingRate?: number;
}

export interface ChargingSchedule {
  duration?: number;
  startSchedule?: string;
  chargingRateUnit: "A" | "W";
  chargingSchedulePeriod: ChargingSchedulePeriod[];
  minChargingRate?: number;
}

export interface ChargingProfileData {
  chargingProfileId: number;
  stackLevel: number;
  chargingProfilePurpose: "ChargePointMaxProfile" | "TxDefaultProfile" | "TxProfile";
  chargingProfileKind: "Absolute" | "Recurring" | "Relative";
  recurrencyKind?: "Daily" | "Weekly";
  validFrom?: Date | string;
  validTo?: Date | string;
  transactionId?: string | number;
  chargingSchedule: ChargingSchedule;
}

export interface CompositeScheduleResult {
  status: "Accepted" | "Rejected";
  chargerId: number;
  connectorId: number;
  scheduleStart?: string;
  duration?: number;
  chargingRateUnit?: "A" | "W";
  chargingSchedulePeriod?: ChargingSchedulePeriod[];
  error?: string;
}

export class SmartChargingProfileService {
  public static readonly DEFAULT_VOLTAGE = 230; // 230V per phase
  public static readonly DEFAULT_PHASES = 3;

  /**
   * Convert power/current limits between Amperes ("A") and Watts ("W")
   */
  public static convertChargingRate(
    value: number,
    fromUnit: "A" | "W",
    toUnit: "A" | "W",
    numberPhases: number = this.DEFAULT_PHASES,
    voltage: number = this.DEFAULT_VOLTAGE
  ): number {
    if (fromUnit === toUnit) return Math.round(value * 10) / 10;

    const phases = Math.max(1, numberPhases || 3);
    const v = voltage || 230;

    if (fromUnit === "A" && toUnit === "W") {
      // Amperes -> Watts: P = I * V * phases
      const watts = value * v * phases;
      return Math.round(watts * 10) / 10;
    } else if (fromUnit === "W" && toUnit === "A") {
      // Watts -> Amperes: I = P / (V * phases)
      const amps = value / (v * phases);
      return Math.round(amps * 10) / 10;
    }

    return value;
  }

  /**
   * Save or update a charging profile for a charger/connector
   */
  public static async saveChargingProfile(
    chargerId: number,
    connectorId: number,
    profileData: ChargingProfileData
  ): Promise<any> {
    try {
      const validFrom = profileData.validFrom ? new Date(profileData.validFrom) : null;
      const validTo = profileData.validTo ? new Date(profileData.validTo) : null;
      const transactionId =
        profileData.transactionId !== undefined && profileData.transactionId !== null
          ? String(profileData.transactionId)
          : null;
      const stackLevel = profileData.stackLevel ?? 0;
      const chargingProfilePurpose = profileData.chargingProfilePurpose ?? "TxDefaultProfile";
      const chargingProfileKind = profileData.chargingProfileKind ?? "Absolute";
      const chargingSchedule = profileData.chargingSchedule ?? {
        chargingRateUnit: "A",
        chargingSchedulePeriod: [{ startPeriod: 0, limit: 32 }],
      };

      const profile = await prisma.chargingProfile.upsert({
        where: {
          chargerId_chargingProfileId: {
            chargerId,
            chargingProfileId: profileData.chargingProfileId,
          },
        },
        create: {
          chargerId,
          connectorId,
          chargingProfileId: profileData.chargingProfileId,
          stackLevel,
          chargingProfilePurpose,
          chargingProfileKind,
          recurrencyKind: profileData.recurrencyKind || null,
          validFrom,
          validTo,
          transactionId,
          chargingSchedule: chargingSchedule as any,
        },
        update: {
          connectorId,
          stackLevel,
          chargingProfilePurpose,
          chargingProfileKind,
          recurrencyKind: profileData.recurrencyKind || null,
          validFrom,
          validTo,
          transactionId,
          chargingSchedule: chargingSchedule as any,
        },
      });

      logger.info(
        `Saved ChargingProfile ${profileData.chargingProfileId} for charger ${chargerId} (Purpose: ${profileData.chargingProfilePurpose}, Stack: ${profileData.stackLevel})`
      );
      return profile;
    } catch (error) {
      logger.error(`Error saving charging profile: ${error}`);
      throw error;
    }
  }

  /**
   * Clear charging profiles matching criteria
   */
  public static async clearChargingProfiles(
    chargerId: number,
    filter?: {
      id?: number;
      connectorId?: number;
      chargingProfilePurpose?: string;
      stackLevel?: number;
    }
  ): Promise<number> {
    try {
      const whereClause: any = { chargerId };
      if (filter?.id !== undefined) whereClause.chargingProfileId = filter.id;
      if (filter?.connectorId !== undefined) whereClause.connectorId = filter.connectorId;
      if (filter?.chargingProfilePurpose !== undefined) whereClause.chargingProfilePurpose = filter.chargingProfilePurpose;
      if (filter?.stackLevel !== undefined) whereClause.stackLevel = filter.stackLevel;

      const deleted = await prisma.chargingProfile.deleteMany({
        where: whereClause,
      });

      logger.info(`Cleared ${deleted.count} charging profiles for charger ${chargerId}`);
      return deleted.count;
    } catch (error) {
      logger.error(`Error clearing charging profiles: ${error}`);
      return 0;
    }
  }

  /**
   * Get active charging profiles for a charger and connector
   */
  public static async getActiveProfiles(
    chargerId: number,
    connectorId?: number,
    now: Date = new Date()
  ): Promise<any[]> {
    const whereClause: any = { chargerId };
    if (connectorId !== undefined) {
      whereClause.OR = [{ connectorId }, { connectorId: 0 }];
    }

    const profiles = await prisma.chargingProfile.findMany({
      where: whereClause,
      orderBy: [{ stackLevel: "desc" }, { createdAt: "desc" }],
    });

    // Filter by validity window
    return profiles.filter((p) => {
      if (p.validFrom && new Date(p.validFrom) > now) return false;
      if (p.validTo && new Date(p.validTo) < now) return false;
      return true;
    });
  }

  /**
   * Resolve limit at a specific offset (in seconds) from a profile's schedule
   */
  private static getProfileLimitAtOffset(
    profile: any,
    offsetSeconds: number,
    targetUnit: "A" | "W"
  ): { limit: number; numberPhases: number } | null {
    const schedule: ChargingSchedule = profile.chargingSchedule as ChargingSchedule;
    if (!schedule || !Array.isArray(schedule.chargingSchedulePeriod) || schedule.chargingSchedulePeriod.length === 0) {
      return null;
    }

    const periods = [...schedule.chargingSchedulePeriod].sort((a, b) => a.startPeriod - b.startPeriod);
    let activePeriod = periods[0];

    for (const p of periods) {
      if (offsetSeconds >= p.startPeriod) {
        activePeriod = p;
      } else {
        break;
      }
    }

    const numberPhases = activePeriod.numberPhases || 3;
    const convertedLimit = this.convertChargingRate(
      activePeriod.limit,
      schedule.chargingRateUnit || "A",
      targetUnit,
      numberPhases
    );

    return {
      limit: convertedLimit,
      numberPhases,
    };
  }

  /**
   * Calculate Composite Charging Schedule by resolving stack priorities and ceiling limits
   */
  public static async calculateCompositeSchedule(
    chargerId: number,
    connectorId: number,
    durationSeconds: number = 86400,
    chargingRateUnit: "A" | "W" = "A",
    options?: { now?: Date; transactionId?: string }
  ): Promise<CompositeScheduleResult> {
    try {
      const scheduleStart = options?.now || new Date();
      const scheduleEnd = new Date(scheduleStart.getTime() + durationSeconds * 1000);

      // Fetch charger to get default physical capacity
      const charger = await prisma.charger.findUnique({
        where: { charger_id: chargerId },
      });

      if (!charger) {
        return {
          status: "Rejected",
          chargerId,
          connectorId,
          error: "Charger not found",
        };
      }

      // Default fallback physical capacity from charger (power_capacity in kW)
      const defaultPowerWatts = (charger.power_capacity || 22) * 1000;
      const defaultLimit = this.convertChargingRate(
        defaultPowerWatts,
        "W",
        chargingRateUnit,
        3
      );

      // Fetch all candidate charging profiles
      const activeProfiles = await this.getActiveProfiles(chargerId, connectorId, scheduleStart);

      // Group profiles by purpose and select the highest stack level for each purpose
      const maxProfiles: any[] = [];
      const txDefaultProfiles: any[] = [];
      const txProfiles: any[] = [];

      for (const p of activeProfiles) {
        if (p.chargingProfilePurpose === "ChargePointMaxProfile") {
          maxProfiles.push(p);
        } else if (p.chargingProfilePurpose === "TxDefaultProfile") {
          txDefaultProfiles.push(p);
        } else if (p.chargingProfilePurpose === "TxProfile") {
          if (!options?.transactionId || p.transactionId === options.transactionId) {
            txProfiles.push(p);
          }
        }
      }

      // Sort by stackLevel descending
      maxProfiles.sort((a, b) => b.stackLevel - a.stackLevel);
      txDefaultProfiles.sort((a, b) => b.stackLevel - a.stackLevel);
      txProfiles.sort((a, b) => b.stackLevel - a.stackLevel);

      const winningMaxProfile = maxProfiles[0] || null;
      const winningTxProfile = txProfiles[0] || null;
      const winningTxDefaultProfile = txDefaultProfiles[0] || null;

      // Active transaction profile (TxProfile > TxDefaultProfile)
      const activeTxProfile = winningTxProfile || winningTxDefaultProfile || null;

      // Collect all critical time change points (startPeriod in seconds)
      const criticalOffsets = new Set<number>([0]);

      const addOffsetsFromProfile = (prof: any) => {
        if (!prof?.chargingSchedule?.chargingSchedulePeriod) return;
        for (const p of prof.chargingSchedule.chargingSchedulePeriod) {
          if (p.startPeriod >= 0 && p.startPeriod < durationSeconds) {
            criticalOffsets.add(p.startPeriod);
          }
        }
      };

      if (winningMaxProfile) addOffsetsFromProfile(winningMaxProfile);
      if (activeTxProfile) addOffsetsFromProfile(activeTxProfile);

      const sortedOffsets = Array.from(criticalOffsets).sort((a, b) => a - b);

      // Evaluate composite limit for each slice
      const rawPeriods: ChargingSchedulePeriod[] = [];

      for (const offset of sortedOffsets) {
        let baseLimit = defaultLimit;
        let numberPhases = 3;

        if (activeTxProfile) {
          const txRes = this.getProfileLimitAtOffset(activeTxProfile, offset, chargingRateUnit);
          if (txRes !== null) {
            baseLimit = txRes.limit;
            numberPhases = txRes.numberPhases;
          }
        }

        // Apply ChargePointMaxProfile ceiling
        if (winningMaxProfile) {
          const maxRes = this.getProfileLimitAtOffset(winningMaxProfile, offset, chargingRateUnit);
          if (maxRes !== null) {
            baseLimit = Math.min(baseLimit, maxRes.limit);
            if (maxRes.numberPhases) {
              numberPhases = Math.min(numberPhases, maxRes.numberPhases);
            }
          }
        }

        // Clamp limit to non-negative and 1 decimal place
        const finalLimit = Math.max(0, Math.round(baseLimit * 10) / 10);

        rawPeriods.push({
          startPeriod: offset,
          limit: finalLimit,
          numberPhases,
        });
      }

      // Compress consecutive periods with identical limit and numberPhases
      const compressedPeriods: ChargingSchedulePeriod[] = [];
      for (const period of rawPeriods) {
        const last = compressedPeriods[compressedPeriods.length - 1];
        if (last && last.limit === period.limit && last.numberPhases === period.numberPhases) {
          // Skip redundant interval
          continue;
        }
        compressedPeriods.push(period);
      }

      const result: CompositeScheduleResult = {
        status: "Accepted",
        chargerId,
        connectorId,
        scheduleStart: scheduleStart.toISOString(),
        duration: durationSeconds,
        chargingRateUnit,
        chargingSchedulePeriod: compressedPeriods.length > 0 ? compressedPeriods : [
          { startPeriod: 0, limit: defaultLimit, numberPhases: 3 },
        ],
      };

      logger.info(
        `Calculated Composite Schedule for charger ${chargerId} (Connector ${connectorId}, Unit: ${chargingRateUnit}, Periods: ${result.chargingSchedulePeriod?.length})`
      );

      return result;
    } catch (error: any) {
      logger.error(`Error calculating composite schedule: ${error}`);
      return {
        status: "Rejected",
        chargerId,
        connectorId,
        error: error.message || "Failed to calculate composite schedule",
      };
    }
  }
}
