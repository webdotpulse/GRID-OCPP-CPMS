import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { setChargingProfile } from "../ocpp/remoteControl.js";
import type { SetChargingProfileRequest } from "../types/index.js";

export interface PhaseCommutationResult {
  chargerId: number;
  commutationTriggered: boolean;
  previousPhaseMode: string;
  targetPhaseMode: string;
  numberPhases: 1 | 3;
  targetLimitAmps: number;
  availablePowerKw: number;
  reason: string;
}

export class PhaseCommutationService {
  private static DWELL_TIME_SECONDS = 180; // 3 minutes debounce to protect physical contactors/relays
  public static SINGLE_PHASE_MIN_KW = 1.38; // 6A @ 230V ~ 1.4 kW
  public static THREE_PHASE_MIN_KW = 4.14;  // 3x6A @ 230V ~ 4.1 kW
  public static VOLTS_PER_PHASE = 230;

  /**
   * Evaluate and execute dynamic 1-Phase ⇄ 3-Phase phase switching based on available power
   */
  public static async evaluatePhaseCommutation(params: {
    chargerId: number;
    availablePowerKw: number;
    forceSwitch?: boolean;
  }): Promise<PhaseCommutationResult> {
    const { chargerId, availablePowerKw, forceSwitch } = params;

    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!charger) {
      throw new Error(`Charger ${chargerId} not found`);
    }

    const currentMode = (charger as any).currentPhaseMode || "3-Phase";
    const lastSwitch = (charger as any).lastPhaseSwitchAt as Date | null;
    const now = new Date();

    // Check anti-chatter dwell time
    if (!forceSwitch && lastSwitch) {
      const elapsedSeconds = (now.getTime() - new Date(lastSwitch).getTime()) / 1000;
      if (elapsedSeconds < this.DWELL_TIME_SECONDS) {
        logger.debug(
          `[PhaseCommutation] Charger ${chargerId} in cooldown (${Math.round(elapsedSeconds)}s / ${this.DWELL_TIME_SECONDS}s). Skipping commutation.`
        );
        return {
          chargerId,
          commutationTriggered: false,
          previousPhaseMode: currentMode,
          targetPhaseMode: currentMode,
          numberPhases: currentMode === "1-Phase" ? 1 : 3,
          targetLimitAmps: currentMode === "1-Phase" ? 16 : 16,
          availablePowerKw,
          reason: `Dwell-time cooldown active (${Math.round(elapsedSeconds)}s / ${this.DWELL_TIME_SECONDS}s)`,
        };
      }
    }

    let targetMode = currentMode;
    let numberPhases: 1 | 3 = currentMode === "1-Phase" ? 1 : 3;
    let targetLimitAmps = 6;
    let reason = "Power within current phase envelope";

    if (availablePowerKw < this.THREE_PHASE_MIN_KW && availablePowerKw >= this.SINGLE_PHASE_MIN_KW) {
      // Power is insufficient for 3-Phase 6A (4.14 kW), but sufficient for 1-Phase continuous charging (1.4 kW - 4.1 kW)
      targetMode = "1-Phase";
      numberPhases = 1;
      // Calculate single phase current: P / 230V
      targetLimitAmps = Math.min(32, Math.max(6, Math.floor((availablePowerKw * 1000) / this.VOLTS_PER_PHASE)));
      reason = `Available power (${availablePowerKw.toFixed(2)} kW) is below 3-phase threshold (${this.THREE_PHASE_MIN_KW} kW). Commuting to 1-Phase (6A - 32A).`;
    } else if (availablePowerKw >= this.THREE_PHASE_MIN_KW) {
      // Power is sufficient for 3-Phase charging (>= 4.14 kW)
      targetMode = "3-Phase";
      numberPhases = 3;
      // Calculate per-phase current: P / (3 * 230V)
      targetLimitAmps = Math.min(32, Math.max(6, Math.floor((availablePowerKw * 1000) / (3 * this.VOLTS_PER_PHASE))));
      reason = `Available power (${availablePowerKw.toFixed(2)} kW) allows 3-Phase charging. Commuting to 3-Phase.`;
    } else {
      // Available power < 1.38 kW (below minimum 6A 1-phase)
      targetMode = currentMode;
      numberPhases = currentMode === "1-Phase" ? 1 : 3;
      targetLimitAmps = 0; // Pause / suspend
      reason = `Available power (${availablePowerKw.toFixed(2)} kW) below minimum single-phase threshold (1.38 kW).`;
    }

    const needsSwitch = forceSwitch || targetMode !== currentMode;

    if (needsSwitch) {
      logger.info(
        `[PhaseCommutation] Charger ${chargerId}: switching phase mode from ${currentMode} -> ${targetMode} (${numberPhases}-Phase @ ${targetLimitAmps}A). Reason: ${reason}`
      );

      // Dispatch OCPP SetChargingProfile with explicit numberPhases
      const profileRequest: SetChargingProfileRequest = {
        chargerId,
        connectorId: 0,
        csChargingProfiles: {
          chargingProfileId: 103, // 103 = Dynamic Phase Commutation Profile
          stackLevel: 2,
          chargingProfilePurpose: "TxDefaultProfile",
          chargingProfileKind: "Absolute",
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [
              {
                startPeriod: 0,
                limit: targetLimitAmps,
                numberPhases: numberPhases,
              },
            ],
          },
        },
      };

      try {
        await setChargingProfile(profileRequest);
      } catch (err) {
        logger.warn(`[PhaseCommutation] SetChargingProfile failed for charger ${chargerId}: ${err}`);
      }

      // Update Charger model state
      await prisma.charger.update({
        where: { charger_id: chargerId },
        data: {
          currentPhaseMode: targetMode,
          lastPhaseSwitchAt: now,
        } as any,
      });

      return {
        chargerId,
        commutationTriggered: true,
        previousPhaseMode: currentMode,
        targetPhaseMode: targetMode,
        numberPhases,
        targetLimitAmps,
        availablePowerKw,
        reason,
      };
    }

    return {
      chargerId,
      commutationTriggered: false,
      previousPhaseMode: currentMode,
      targetPhaseMode: currentMode,
      numberPhases,
      targetLimitAmps,
      availablePowerKw,
      reason,
    };
  }

  /**
   * Manually force a specific phase mode on a charger
   */
  public static async setManualPhaseMode(
    chargerId: number,
    phaseMode: "1-Phase" | "3-Phase",
    limitAmps: number = 16
  ): Promise<PhaseCommutationResult> {
    const numberPhases: 1 | 3 = phaseMode === "1-Phase" ? 1 : 3;

    const profileRequest: SetChargingProfileRequest = {
      chargerId,
      connectorId: 0,
      csChargingProfiles: {
        chargingProfileId: 103,
        stackLevel: 2,
        chargingProfilePurpose: "TxDefaultProfile",
        chargingProfileKind: "Absolute",
        chargingSchedule: {
          chargingRateUnit: "A",
          chargingSchedulePeriod: [
            {
              startPeriod: 0,
              limit: limitAmps,
              numberPhases: numberPhases,
            },
          ],
        },
      },
    };

    await setChargingProfile(profileRequest);

    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: {
        currentPhaseMode: phaseMode,
        lastPhaseSwitchAt: new Date(),
      } as any,
    });

    return {
      chargerId,
      commutationTriggered: true,
      previousPhaseMode: "unknown",
      targetPhaseMode: phaseMode,
      numberPhases,
      targetLimitAmps: limitAmps,
      availablePowerKw: phaseMode === "1-Phase" ? (limitAmps * 230) / 1000 : (limitAmps * 3 * 230) / 1000,
      reason: "Manual phase mode override by operator",
    };
  }
}
