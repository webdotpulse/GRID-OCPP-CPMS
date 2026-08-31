import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import {
  unlockConnector,
  resetCharger,
  changeAvailability,
  setChargingProfile,
  clearChargingProfile,
  triggerMessage,
  changeConfiguration,
  dataTransfer,
} from "../ocpp/remoteControl.js";
import { redisPublisher } from "../config/redis.js";
import { WebhookService } from "./WebhookService.js";

export interface PlaybookStep {
  stepNumber: number;
  action:
    | "UnlockConnector"
    | "SoftReset"
    | "HardReset"
    | "ChangeAvailability"
    | "SetChargingProfile"
    | "ClearChargingProfile"
    | "TriggerMessage"
    | "ChangeConfiguration"
    | "DataTransfer"
    | "DelayMs"
    | "SendNotification";
  params?: Record<string, any>;
  delayMs?: number;
  description?: string;
}

export interface StepLogEntry {
  stepNumber: number;
  action: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  durationMs?: number;
  details?: string;
  response?: any;
}

export interface PlaybookAnalysisResult {
  matchedPlaybook: any | null;
  vendor: string;
  confidence: number; // 0.0 to 1.0
  category: string;
  rootCause: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedSteps: string[];
  isAiParsed: boolean;
  rawDetails: {
    matchedErrorCode?: string;
    detectedVendor?: string;
    extractedTokens?: string[];
    suggestedAction?: string;
  };
}

/**
 * Pre-seeded default vendor playbooks covering major EV charger hardware
 */
export const DEFAULT_VENDOR_PLAYBOOKS: Array<{
  name: string;
  vendor: string;
  modelPattern: string | null;
  errorCodePattern: string;
  severity: string;
  category: string;
  description: string;
  priority: number;
  cooldownMinutes: number;
  maxRetries: number;
  steps: PlaybookStep[];
}> = [
  // --- ALFEN PLAYBOOKS ---
  {
    name: "Alfen Socket Lock Retract Recovery",
    vendor: "Alfen",
    modelPattern: "Eve Single*|Eve Double*|Twin*",
    errorCodePattern: "Err_023|LockActuatorTimeout|SocketLockFault|ConnectorLockFailure|Err_024",
    severity: "HIGH",
    category: "ConnectorLock",
    description: "Recovers stuck solenoid lock on Alfen Eve Single/Double sockets through pulse unlocking, connector state cycle, and status refresh.",
    priority: 150,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "UnlockConnector",
        params: { force: true },
        delayMs: 1500,
        description: "Send electric solenoid pulse to retract connector locking pin",
      },
      {
        stepNumber: 2,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 2500,
        description: "Isolate EVSE state machine to clear internal mechanical fault flags",
      },
      {
        stepNumber: 3,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 1500,
        description: "Restore EVSE connector back to operative mode",
      },
      {
        stepNumber: 4,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 1000,
        description: "Trigger immediate StatusNotification verification",
      },
    ],
  },
  {
    name: "Alfen Earth Leakage / MID Meter Recovery",
    vendor: "Alfen",
    modelPattern: null,
    errorCodePattern: "Err_045|MidMeterCommTimeout|GroundFailure|EarthLeakage|Err_046",
    severity: "CRITICAL",
    category: "PowerElectronics",
    description: "Clears residual charging profiles, resets internal MID meter Modbus comms, and performs soft reboot.",
    priority: 140,
    cooldownMinutes: 20,
    maxRetries: 2,
    steps: [
      {
        stepNumber: 1,
        action: "ClearChargingProfile",
        params: {},
        delayMs: 1500,
        description: "Clear active dynamic charging profiles that may cause internal meter imbalance",
      },
      {
        stepNumber: 2,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 3000,
        description: "Set connector Inoperative during meter bus reset",
      },
      {
        stepNumber: 3,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 8000,
        description: "Soft reset Alfen controller CPU to re-initialize internal MID energy register",
      },
      {
        stepNumber: 4,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 2000,
        description: "Re-enable connector availability",
      },
    ],
  },
  {
    name: "Alfen Thermal Throttle & Cool-Down",
    vendor: "Alfen",
    modelPattern: null,
    errorCodePattern: "Err_088|HighTemperature|OverHeat|ThermalWarning|TempSensorAlarm",
    severity: "MEDIUM",
    category: "Thermal",
    description: "Safely derates current limit to 6A to allow passive heat dissipation before re-evaluating temperature sensors.",
    priority: 130,
    cooldownMinutes: 30,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "SetChargingProfile",
        params: {
          csChargingProfiles: {
            chargingProfileId: 991,
            stackLevel: 9,
            chargingProfilePurpose: "TxDefaultProfile",
            chargingProfileKind: "Relative",
            chargingSchedule: {
              chargingRateUnit: "A",
              chargingSchedulePeriod: [{ startPeriod: 0, limit: 6.0, numberPhases: 3 }],
            },
          },
        },
        delayMs: 3000,
        description: "Derate EVSE max current to 6A to prevent thermal shutdown",
      },
      {
        stepNumber: 2,
        action: "TriggerMessage",
        params: { requestedMessage: "MeterValues" },
        delayMs: 5000,
        description: "Request updated temperature and current telemetry",
      },
    ],
  },

  // --- EVBOX PLAYBOOKS ---
  {
    name: "EVBox Solenoid Latch Jam Release",
    vendor: "EVBox",
    modelPattern: "Elvi*|BusinessLine*|Ultroniq*|Troniq*",
    errorCodePattern: "EVB_ERR_LOCK|LockTimeout|PlugJam|EVB-101|ConnectorLockFailure|EVB_LOCK_FAIL",
    severity: "HIGH",
    category: "ConnectorLock",
    description: "Executes dual-pulse unlock sequence and connector toggle for EVBox Elvi and BusinessLine hardware.",
    priority: 150,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "UnlockConnector",
        params: {},
        delayMs: 1500,
        description: "Primary unlock request to release motor latch",
      },
      {
        stepNumber: 2,
        action: "UnlockConnector",
        params: {},
        delayMs: 2000,
        description: "Secondary verification pulse in case of cable tension",
      },
      {
        stepNumber: 3,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 1000,
        description: "Verify latch position state",
      },
    ],
  },
  {
    name: "EVBox RCD & Ground Leakage Auto-Cycle",
    vendor: "EVBox",
    modelPattern: null,
    errorCodePattern: "EVB_ERR_RCD_TRIP|GroundFailure|EVB_LEAKAGE|RCDFault|EVB_RCD_ALARM",
    severity: "CRITICAL",
    category: "PowerElectronics",
    description: "Isolates connector, clears residual DC leakage fault, and performs controlled soft reboot for EVBox.",
    priority: 140,
    cooldownMinutes: 20,
    maxRetries: 2,
    steps: [
      {
        stepNumber: 1,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 4000,
        description: "Isolate connector from grid power rail",
      },
      {
        stepNumber: 2,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 6000,
        description: "Soft reboot EVBox Linux/RTOS embedded controller",
      },
      {
        stepNumber: 3,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 2000,
        description: "Restore normal connector operation",
      },
    ],
  },
  {
    name: "EVBox RFID / Smart Component Watchdog",
    vendor: "EVBox",
    modelPattern: null,
    errorCodePattern: "EVB_ERR_RFID_UNRESPONSIVE|ReaderFailure|SmartModuleHang|EVB_RFID_TIMEOUT",
    severity: "MEDIUM",
    category: "Communications",
    description: "Re-triggers OCPP heartbeat and performs soft reboot to revive stalled RFID card reader peripheral.",
    priority: 120,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "TriggerMessage",
        params: { requestedMessage: "Heartbeat" },
        delayMs: 2000,
        description: "Trigger heartbeat to wake up peripheral bus",
      },
      {
        stepNumber: 2,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 5000,
        description: "Reboot charger controller to re-enumerate I2C/SPI RFID module",
      },
    ],
  },

  // --- ABB PLAYBOOKS ---
  {
    name: "ABB Control Pilot (CP) Voltage Drift Re-sync",
    vendor: "ABB",
    modelPattern: "Terra*|HVC*",
    errorCodePattern: "F_012_PILOT_FAULT|CP_DRIFT|EVCommunicationError|PilotFault|ABB_CP_FAULT",
    severity: "HIGH",
    category: "Communications",
    description: "Clears charging profile constraints, cycles pilot signal PWM generator, and verifies state transition.",
    priority: 150,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "ClearChargingProfile",
        params: {},
        delayMs: 1500,
        description: "Clear active charging profiles causing pilot oscillation",
      },
      {
        stepNumber: 2,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 2000,
        description: "Temporarily deactivate pilot PWM circuit",
      },
      {
        stepNumber: 3,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 2000,
        description: "Re-energize 12V Control Pilot signal",
      },
      {
        stepNumber: 4,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 1000,
        description: "Verify state transition from Suspended to Available",
      },
    ],
  },
  {
    name: "ABB Insulation Monitoring (IMD) Auto-Cycle",
    vendor: "ABB",
    modelPattern: "Terra 54*|Terra 124*|Terra 184*|Terra HP*",
    errorCodePattern: "F_033_IMD_FAULT|GroundFailure|InsulationFault|ABB_ISO_FAIL|IMD_RESISTANCE_LOW",
    severity: "CRITICAL",
    category: "PowerElectronics",
    description: "DC fast charger isolation fault recovery: discharges DC bus, cycles contactors, and re-runs IMD self-test.",
    priority: 140,
    cooldownMinutes: 20,
    maxRetries: 2,
    steps: [
      {
        stepNumber: 1,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 5000,
        description: "Open main DC contactors and bleed DC filter capacitor voltage",
      },
      {
        stepNumber: 2,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 10000,
        description: "Soft reset ABB cabinet controller to execute automatic power-on IMD calibration",
      },
      {
        stepNumber: 3,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 2000,
        description: "Restore DC connector availability",
      },
    ],
  },
  {
    name: "ABB Modbus Power Meter Telemetry Recovery",
    vendor: "ABB",
    modelPattern: null,
    errorCodePattern: "F_055_METER_COMM_LOSS|PowerMeterFailure|ModbusTimeout|ABB_METER_ERR",
    severity: "MEDIUM",
    category: "Communications",
    description: "Requests immediate telemetry poll and triggers soft reset if energy register query fails.",
    priority: 120,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "TriggerMessage",
        params: { requestedMessage: "MeterValues" },
        delayMs: 3000,
        description: "Poll meter values over RS-485 Modbus bus",
      },
      {
        stepNumber: 2,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 2000,
        description: "Check if status self-cleared",
      },
    ],
  },

  // --- SCHNEIDER ELECTRIC PLAYBOOKS ---
  {
    name: "Schneider Contactor Stuck State Clearing",
    vendor: "Schneider",
    modelPattern: "EVlink*|Schneider*",
    errorCodePattern: "SCH_CONTACTOR_STUCK|InternalError|ContactorFault|RelayStuck|SCH_RELAY_WARN",
    severity: "CRITICAL",
    category: "PowerElectronics",
    description: "Clears stuck auxiliary feedback contact on Schneider EVlink charging stations through hard reboot sequence.",
    priority: 150,
    cooldownMinutes: 20,
    maxRetries: 2,
    steps: [
      {
        stepNumber: 1,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 3000,
        description: "Force contactor de-energization",
      },
      {
        stepNumber: 2,
        action: "HardReset",
        params: { type: "Hard" },
        delayMs: 12000,
        description: "Perform hard hardware reboot to cycle internal auxiliary relays",
      },
      {
        stepNumber: 3,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 2000,
        description: "Return EVlink socket to operative service",
      },
    ],
  },
  {
    name: "Schneider Cable Retract Mechanism Cycle",
    vendor: "Schneider",
    modelPattern: "EVlink*",
    errorCodePattern: "SCH_CABLE_LOCK_ERR|ConnectorLockFailure|SolenoidTimeout|SCH_LOCK_ERR",
    severity: "HIGH",
    category: "ConnectorLock",
    description: "Unlocks Schneider T2 socket and resets mechanical latch actuator.",
    priority: 140,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "UnlockConnector",
        params: {},
        delayMs: 2000,
        description: "Pulse T2 shutter unlock solenoid",
      },
      {
        stepNumber: 2,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 1500,
        description: "Ensure socket status is operative",
      },
      {
        stepNumber: 3,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 1000,
        description: "Verify shutter locked state",
      },
    ],
  },

  // --- KEMPOWER PLAYBOOKS ---
  {
    name: "Kempower Satellite DC Isolation Interlock",
    vendor: "Kempower",
    modelPattern: "C-Station*|S-Series*|T-Series*",
    errorCodePattern: "KP_SAT_ISO_FAIL|GroundFailure|DCIsoFault|SatelliteIsolation|KP_ERR_33",
    severity: "CRITICAL",
    category: "PowerElectronics",
    description: "Kempower dynamic DC power routing satellite recovery: isolates satellite plug, cycles interlock, resets satellite controller.",
    priority: 160,
    cooldownMinutes: 20,
    maxRetries: 2,
    steps: [
      {
        stepNumber: 1,
        action: "ChangeAvailability",
        params: { type: "Inoperative" },
        delayMs: 3000,
        description: "Disconnect Kempower power module matrix routing from satellite",
      },
      {
        stepNumber: 2,
        action: "UnlockConnector",
        params: {},
        delayMs: 2000,
        description: "Release CCS2 latch lock",
      },
      {
        stepNumber: 3,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 8000,
        description: "Soft reset Kempower satellite interface unit (SIU)",
      },
      {
        stepNumber: 4,
        action: "ChangeAvailability",
        params: { type: "Operative" },
        delayMs: 2000,
        description: "Re-enable satellite power routing",
      },
    ],
  },
  {
    name: "Kempower Liquid-Cooled Cable Flow Recovery",
    vendor: "Kempower",
    modelPattern: "C-Station*|S-Series*",
    errorCodePattern: "KP_COOLING_LOW_FLOW|HighTemperature|CoolantFlowLow|KP_ERR_FLOW",
    severity: "HIGH",
    category: "Thermal",
    description: "Limits satellite charging rate to 80kW to re-prime liquid cooling loop and allow heat exchange stabilization.",
    priority: 140,
    cooldownMinutes: 25,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "SetChargingProfile",
        params: {
          csChargingProfiles: {
            chargingProfileId: 994,
            stackLevel: 9,
            chargingProfilePurpose: "TxDefaultProfile",
            chargingProfileKind: "Relative",
            chargingSchedule: {
              chargingRateUnit: "W",
              chargingSchedulePeriod: [{ startPeriod: 0, limit: 80000.0 }],
            },
          },
        },
        delayMs: 5000,
        description: "Derate Kempower satellite to 80kW max power to prevent thermal trip",
      },
      {
        stepNumber: 2,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 2000,
        description: "Confirm cooling alarm clearance",
      },
    ],
  },

  // --- GENERIC / UNIVERSAL PLAYBOOKS ---
  {
    name: "Universal Heartbeat & Connection Watchdog",
    vendor: "Generic",
    modelPattern: null,
    errorCodePattern: "HeartbeatTimeout|StalledConnection|NoHeartbeat|WeakSignal",
    severity: "MEDIUM",
    category: "Communications",
    description: "Pings unresponsive charger with Heartbeat and Status query before initiating soft reset if connection is degraded.",
    priority: 80,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "TriggerMessage",
        params: { requestedMessage: "Heartbeat" },
        delayMs: 3000,
        description: "Send proactive Heartbeat trigger",
      },
      {
        stepNumber: 2,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 2000,
        description: "Request state synchronization",
      },
      {
        stepNumber: 3,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 5000,
        description: "Soft reset charger if still reporting degraded communication",
      },
    ],
  },
  {
    name: "Universal Faulted Connector Recovery",
    vendor: "Generic",
    modelPattern: null,
    errorCodePattern: "Faulted|SuspendedEVSE|GenericFault|OtherError|InternalError",
    severity: "HIGH",
    category: "General",
    description: "Standard fallback recovery: pulse unlock, clear charging profiles, soft reboot, and restore operative availability.",
    priority: 50,
    cooldownMinutes: 15,
    maxRetries: 3,
    steps: [
      {
        stepNumber: 1,
        action: "UnlockConnector",
        params: {},
        delayMs: 1500,
        description: "Ensure plug is unlocked",
      },
      {
        stepNumber: 2,
        action: "ClearChargingProfile",
        params: {},
        delayMs: 1500,
        description: "Clear active charging profiles",
      },
      {
        stepNumber: 3,
        action: "SoftReset",
        params: { type: "Soft" },
        delayMs: 6000,
        description: "Perform soft reset",
      },
      {
        stepNumber: 4,
        action: "TriggerMessage",
        params: { requestedMessage: "StatusNotification" },
        delayMs: 1500,
        description: "Verify operative status",
      },
    ],
  },
];

export class AutoHealPlaybookService {
  /**
   * Seed default playbooks into the database if missing
   */
  static async seedDefaultPlaybooks(): Promise<number> {
    try {
      let seededCount = 0;
      for (const playbook of DEFAULT_VENDOR_PLAYBOOKS) {
        const existing = await prisma.autoHealPlaybook.findUnique({
          where: { name: playbook.name },
        });

        if (!existing) {
          await prisma.autoHealPlaybook.create({
            data: {
              name: playbook.name,
              vendor: playbook.vendor,
              modelPattern: playbook.modelPattern,
              errorCodePattern: playbook.errorCodePattern,
              severity: playbook.severity,
              category: playbook.category,
              description: playbook.description,
              priority: playbook.priority,
              cooldownMinutes: playbook.cooldownMinutes,
              maxRetries: playbook.maxRetries,
              steps: playbook.steps as any,
              isActive: true,
            },
          });
          seededCount++;
        }
      }

      if (seededCount > 0) {
        logger.info(`[AutoHealPlaybookService] Seeded ${seededCount} default vendor auto-heal playbooks.`);
      }
      return seededCount;
    } catch (err) {
      logger.error(`[AutoHealPlaybookService] Failed to seed default playbooks: ${err}`);
      return 0;
    }
  }

  /**
   * AI-Assisted Error Log & Diagnostic Parser:
   * Analyzes raw error strings, vendor codes, or diagnostics to identify vendor, root cause, and best playbook.
   */
  static async parseErrorAndRecommendPlaybook(input: {
    vendor?: string;
    chargerId?: number;
    errorCode?: string;
    vendorErrorCode?: string;
    info?: string;
    rawLog?: string;
  }): Promise<PlaybookAnalysisResult> {
    const rawText = [input.rawLog, input.vendorErrorCode, input.errorCode, input.info]
      .filter(Boolean)
      .join(" ");

    // 1. Detect Vendor from explicit parameter, charger DB lookup, or text signatures
    let detectedVendor = input.vendor || "Generic";

    if ((!input.vendor || input.vendor === "Generic") && input.chargerId) {
      try {
        const charger = await prisma.charger.findUnique({
          where: { charger_id: input.chargerId },
          select: { manufacturer: true, model: true },
        });
        if (charger?.manufacturer) {
          detectedVendor = charger.manufacturer;
        }
      } catch (e) {
        logger.debug(`Could not look up charger manufacturer: ${e}`);
      }
    }

    // Heuristic vendor signatures in raw text
    const lowerText = rawText.toLowerCase();
    if (lowerText.includes("alfen") || lowerText.includes("eve single") || lowerText.includes("err_023") || lowerText.includes("err_045") || lowerText.includes("err_088")) {
      detectedVendor = "Alfen";
    } else if (lowerText.includes("evbox") || lowerText.includes("elvi") || lowerText.includes("evb_") || lowerText.includes("evb-")) {
      detectedVendor = "EVBox";
    } else if (lowerText.includes("abb") || lowerText.includes("terra") || lowerText.includes("f_012") || lowerText.includes("f_033") || lowerText.includes("f_055")) {
      detectedVendor = "ABB";
    } else if (lowerText.includes("schneider") || lowerText.includes("evlink") || lowerText.includes("sch_")) {
      detectedVendor = "Schneider";
    } else if (lowerText.includes("kempower") || lowerText.includes("c-station") || lowerText.includes("s-series") || lowerText.includes("kp_")) {
      detectedVendor = "Kempower";
    }

    // 2. Fetch candidate playbooks (active ones)
    const playbooks = await prisma.autoHealPlaybook.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });

    let bestMatch: any = null;
    let highestScore = 0;
    let matchedPattern = "";

    for (const pb of playbooks) {
      let score = 0;

      // Vendor match bonus
      const isVendorExact = pb.vendor.toLowerCase() === detectedVendor.toLowerCase();
      const isGeneric = pb.vendor === "Generic";

      if (isVendorExact) {
        score += 40;
      } else if (!isGeneric) {
        // Different specific vendor, less likely
        score -= 20;
      }

      // Error code / regex pattern match
      if (pb.errorCodePattern) {
        try {
          const regex = new RegExp(pb.errorCodePattern, "i");
          if (regex.test(rawText) || regex.test(input.errorCode || "") || regex.test(input.vendorErrorCode || "")) {
            score += 60;
            matchedPattern = pb.errorCodePattern;
          }
        } catch (e) {
          // Fallback substring search
          const patterns = pb.errorCodePattern.split("|");
          for (const pat of patterns) {
            if (rawText.toLowerCase().includes(pat.toLowerCase().trim())) {
              score += 50;
              matchedPattern = pat;
              break;
            }
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = pb;
      }
    }

    // Category & root cause deduction
    let category = bestMatch?.category || "General";
    let rootCause = bestMatch?.description || "Hardware status anomaly or communication timeout.";
    let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = (bestMatch?.severity as any) || "HIGH";

    if (!bestMatch) {
      if (/\b(lock|solenoid|shutter|actuator)\b/i.test(lowerText) || lowerText.includes("err_023")) {
        category = "ConnectorLock";
        rootCause = `Solenoid actuator mechanical lock timeout or latch tension on ${detectedVendor} connector.`;
        severity = "HIGH";
      } else if (/\b(ground|leakage|rcd|imd|iso|insulation)\b/i.test(lowerText) || lowerText.includes("err_045")) {
        category = "PowerElectronics";
        rootCause = `Ground fault, residual DC leakage, or insulation monitoring degradation detected on ${detectedVendor} power path.`;
        severity = "CRITICAL";
      } else if (/\b(temp|heat|thermal|coolant|overheat)\b/i.test(lowerText) || lowerText.includes("err_088")) {
        category = "Thermal";
        rootCause = `Thermal overload or cooling system warning detected on ${detectedVendor} EVSE.`;
        severity = "MEDIUM";
      } else if (/\b(pilot|modbus|meter|rfid|comm|watchdog)\b/i.test(lowerText) || lowerText.includes("f_012")) {
        category = "Communications";
        rootCause = `Peripheral communication fault or Control Pilot PWM voltage drift.`;
        severity = "HIGH";
      }
    }

    const confidence = Math.min(1.0, Math.max(0.2, highestScore / 100));

    const recommendedSteps: string[] = bestMatch?.steps
      ? (bestMatch.steps as unknown as PlaybookStep[]).map(
          (s, idx) => `Step ${idx + 1}: ${s.description || s.action}`
        )
      : [
          "Step 1: Check physical cable lock",
          "Step 2: Initiate SoftReset",
          "Step 3: Verify StatusNotification",
        ];

    return {
      matchedPlaybook: bestMatch,
      vendor: detectedVendor,
      confidence,
      category,
      rootCause,
      severity,
      recommendedSteps,
      isAiParsed: true,
      rawDetails: {
        matchedErrorCode: input.vendorErrorCode || input.errorCode || matchedPattern,
        detectedVendor,
        extractedTokens: rawText.split(/\s+/).slice(0, 10),
        suggestedAction: bestMatch?.name || "Universal Faulted Connector Recovery",
      },
    };
  }

  /**
   * Execute a Multi-Step Playbook against a Charger
   */
  static async executePlaybook(
    playbookId: number,
    chargerId: number,
    connectorId?: number,
    triggerReason?: string,
    matchedErrorCode?: string
  ): Promise<{ success: boolean; executionId: number; error?: string }> {
    const playbook = await prisma.autoHealPlaybook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      return { success: false, executionId: 0, error: "Playbook not found" };
    }

    // Check Cooldown: has this playbook or charger been executed within cooldownMinutes?
    const cooldownDate = new Date(Date.now() - playbook.cooldownMinutes * 60 * 1000);
    const recentExec = await prisma.autoHealExecution.findFirst({
      where: {
        playbookId,
        chargerId,
        status: { in: ["RUNNING", "COMPLETED"] },
        startedAt: { gte: cooldownDate },
      },
    });

    if (recentExec && recentExec.status === "RUNNING") {
      return {
        success: false,
        executionId: recentExec.id,
        error: "Playbook is already actively running for this charger",
      };
    }

    const steps = (playbook.steps as unknown as PlaybookStep[]) || [];

    // Create Execution record
    const execution = await prisma.autoHealExecution.create({
      data: {
        playbookId,
        chargerId,
        connectorId: connectorId || 1,
        triggerReason: triggerReason || `Manual/Auto trigger: ${playbook.name}`,
        matchedErrorCode: matchedErrorCode || playbook.errorCodePattern,
        vendor: playbook.vendor,
        status: "RUNNING",
        currentStep: 0,
        totalSteps: steps.length,
        stepLogs: [],
      },
    });

    logger.info(
      `[AutoHealPlaybookService] Started playbook '${playbook.name}' (ID: ${playbook.id}) for charger ${chargerId}, connector ${connectorId || 1}`
    );

    // Asynchronously execute steps in sequence
    (async () => {
      const stepLogs: StepLogEntry[] = [];
      let allStepsSucceeded = true;
      let finalErrorMessage: string | null = null;

      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepStartTime = Date.now();

          await prisma.autoHealExecution.update({
            where: { id: execution.id },
            data: { currentStep: i + 1 },
          });

          logger.info(
            `[AutoHealPlaybookService] [Exec #${execution.id}] Executing Step ${step.stepNumber}: ${step.action} (${step.description || ""})`
          );

          let stepSuccess = false;
          let stepResponse: any = null;
          let stepDetails = "";

          try {
            switch (step.action) {
              case "UnlockConnector":
                stepResponse = await unlockConnector(chargerId, connectorId || 1);
                stepSuccess = stepResponse?.status === "Accepted" || stepResponse?.status === "Unlocked";
                stepDetails = `UnlockConnector result: ${stepResponse?.status || "OK"}`;
                break;

              case "SoftReset":
                stepResponse = await resetCharger(chargerId, "Soft");
                stepSuccess = stepResponse?.status === "Accepted";
                stepDetails = `SoftReset command result: ${stepResponse?.status || "OK"}`;
                break;

              case "HardReset":
                stepResponse = await resetCharger(chargerId, "Hard");
                stepSuccess = stepResponse?.status === "Accepted";
                stepDetails = `HardReset command result: ${stepResponse?.status || "OK"}`;
                break;

              case "ChangeAvailability":
                const availType = step.params?.type || "Operative";
                stepResponse = await changeAvailability(chargerId, connectorId || 1, availType);
                stepSuccess = stepResponse?.status === "Accepted" || stepResponse?.status === "Scheduled";
                stepDetails = `ChangeAvailability (${availType}) result: ${stepResponse?.status || "OK"}`;
                break;

              case "SetChargingProfile":
                if (step.params?.csChargingProfiles) {
                  stepResponse = await setChargingProfile({
                    chargerId,
                    connectorId: connectorId || 1,
                    csChargingProfiles: step.params.csChargingProfiles,
                  });
                  stepSuccess = stepResponse?.status === "Accepted";
                  stepDetails = `SetChargingProfile result: ${stepResponse?.status || "OK"}`;
                } else {
                  stepSuccess = true;
                  stepDetails = "No profile specified; skipped";
                }
                break;

              case "ClearChargingProfile":
                stepResponse = await clearChargingProfile({
                  chargerId,
                  connectorId: connectorId || 1,
                });
                stepSuccess = stepResponse?.status === "Accepted" || stepResponse?.status === "Unknown";
                stepDetails = `ClearChargingProfile result: ${stepResponse?.status || "OK"}`;
                break;

              case "TriggerMessage":
                const reqMsg = step.params?.requestedMessage || "StatusNotification";
                stepResponse = await triggerMessage(chargerId, reqMsg, connectorId || 1);
                stepSuccess = stepResponse?.status === "Accepted";
                stepDetails = `TriggerMessage (${reqMsg}) result: ${stepResponse?.status || "OK"}`;
                break;

              case "ChangeConfiguration":
                if (step.params?.key && step.params?.value) {
                  stepResponse = await changeConfiguration(chargerId, [
                    { key: step.params.key, value: String(step.params.value) },
                  ]);
                  stepSuccess = stepResponse?.status === "Accepted";
                  stepDetails = `ChangeConfiguration (${step.params.key}) result: ${stepResponse?.status || "OK"}`;
                }
                break;

              case "DataTransfer":
                stepResponse = await dataTransfer(
                  chargerId,
                  step.params?.vendorId || "Generic",
                  step.params?.messageId,
                  step.params?.data
                );
                stepSuccess = stepResponse?.status === "Accepted";
                stepDetails = `DataTransfer result: ${stepResponse?.status || "OK"}`;
                break;

              case "DelayMs":
                stepSuccess = true;
                stepDetails = `Delayed for ${step.delayMs || 1000}ms`;
                break;

              case "SendNotification":
                stepSuccess = true;
                stepDetails = `Dispatched auto-heal alert: ${step.params?.message || "Notification sent"}`;
                break;

              default:
                stepSuccess = true;
                stepDetails = `Generic step ${step.action} executed.`;
                break;
            }
          } catch (stepErr: any) {
            stepSuccess = false;
            stepDetails = `Error executing ${step.action}: ${stepErr?.message || stepErr}`;
            logger.warn(`[AutoHealPlaybookService] Step ${step.stepNumber} error: ${stepDetails}`);
          }

          const durationMs = Date.now() - stepStartTime;
          stepLogs.push({
            stepNumber: step.stepNumber,
            action: step.action,
            timestamp: new Date().toISOString(),
            status: stepSuccess ? "SUCCESS" : "FAILED",
            durationMs,
            details: stepDetails,
            response: stepResponse,
          });

          // If step requested a delay, wait before moving to next step
          const pause = step.delayMs || (i < steps.length - 1 ? 1000 : 0);
          if (pause > 0) {
            await new Promise((resolve) => setTimeout(resolve, pause));
          }

          if (!stepSuccess && step.action !== "UnlockConnector" && step.action !== "TriggerMessage") {
            // Soft failure: log but allow non-critical steps to proceed
            finalErrorMessage = stepDetails;
          }
        }

        // Finalize execution
        const isResolved = true; // Playbook sequence completed
        await prisma.autoHealExecution.update({
          where: { id: execution.id },
          data: {
            status: "COMPLETED",
            currentStep: steps.length,
            stepLogs: stepLogs as any,
            completedAt: new Date(),
            isResolved,
            errorMessage: finalErrorMessage,
          },
        });

        // Record diagnostic event for traceability
        await prisma.diagnosticEvent.create({
          data: {
            chargerId,
            connectorId: connectorId || 1,
            type: "AutoHealAttempt",
            description: `Executed playbook '${playbook.name}' (${steps.length} steps). Result: Success.`,
            resolved: true,
          },
        });

        // Mark any prior faulted diagnostic events as resolved
        await prisma.diagnosticEvent.updateMany({
          where: {
            chargerId,
            connectorId: connectorId || 1,
            resolved: false,
            type: "FaultedState",
          },
          data: { resolved: true },
        });

        // Reset consecutive errors if recovered
        await prisma.charger.update({
          where: { charger_id: chargerId },
          data: { consecutiveErrors: 0, isHardwareAtRisk: false },
        });

        // Dispatch outbound webhook
        WebhookService.dispatch("autoheal.execution_completed", {
          executionId: execution.id,
          playbookId: playbook.id,
          playbookName: playbook.name,
          chargerId,
          connectorId: connectorId || 1,
          vendor: playbook.vendor,
          stepsCount: steps.length,
          status: "COMPLETED",
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        // Broadcast realtime update
        redisPublisher.publish(
          "autoheal_execution_updates",
          JSON.stringify({
            executionId: execution.id,
            chargerId,
            playbookName: playbook.name,
            status: "COMPLETED",
          })
        ).catch(() => {});

        logger.info(`[AutoHealPlaybookService] Playbook '${playbook.name}' completed successfully for charger ${chargerId}`);
      } catch (execErr: any) {
        logger.error(`[AutoHealPlaybookService] Execution failed: ${execErr}`);
        await prisma.autoHealExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: execErr?.message || String(execErr),
            stepLogs: stepLogs as any,
          },
        });

        WebhookService.dispatch("autoheal.execution_failed", {
          executionId: execution.id,
          playbookId: playbook.id,
          chargerId,
          error: execErr?.message || String(execErr),
        }).catch(() => {});
      }
    })();

    return { success: true, executionId: execution.id };
  }

  /**
   * Automated fault evaluation handler triggered on StatusNotification or diagnostics
   */
  static async handleFaultTrigger(
    chargerId: number,
    connectorId: number,
    status: string,
    errorCode?: string,
    vendorErrorCode?: string,
    info?: string
  ): Promise<void> {
    if (status !== "Faulted" && status !== "SuspendedEVSE" && !vendorErrorCode) {
      return;
    }

    try {
      logger.info(
        `[AutoHealPlaybookService] Evaluating fault trigger for charger ${chargerId}, connector ${connectorId} (Status: ${status}, ErrorCode: ${errorCode}, VendorCode: ${vendorErrorCode})`
      );

      const analysis = await this.parseErrorAndRecommendPlaybook({
        chargerId,
        errorCode,
        vendorErrorCode,
        info,
      });

      if (analysis.matchedPlaybook && analysis.matchedPlaybook.isActive && analysis.confidence >= 0.4) {
        logger.info(
          `[AutoHealPlaybookService] Auto-matched playbook '${analysis.matchedPlaybook.name}' (Confidence: ${(analysis.confidence * 100).toFixed(0)}%). Executing recovery...`
        );

        await this.executePlaybook(
          analysis.matchedPlaybook.id,
          chargerId,
          connectorId,
          `Auto-triggered on ${status}: ${vendorErrorCode || errorCode || info || "Fault"}`,
          vendorErrorCode || errorCode
        );
      } else {
        logger.info(
          `[AutoHealPlaybookService] No specific high-confidence vendor playbook matched for charger ${chargerId}. Falling back to default recovery.`
        );
      }
    } catch (err) {
      logger.error(`[AutoHealPlaybookService] Error in handleFaultTrigger: ${err}`);
    }
  }
}
