/**
 * Raedian EV Charger Vendor Error Codes & Remediation Definitions
 * Models supported: Raedian NEX (7.4kW/11kW/22kW AC Smart Wallbox) & Raedian Gemini (Commercial Dual-Socket AC)
 *
 * Real OCPP 1.6-J messages from Raedian chargers include:
 * - vendorId: "RAEDIAN"
 * - vendorErrorCode: 16-bit hex code string (e.g. "0x0000" for NoError, "0x0008" for Overvoltage, "0x2010" for Phase loss & Undervoltage)
 * - info: JSON string with telemetry channels (e.g. "{\"channel\": 16, \"current\": 10}")
 */

export interface RaedianErrorCodeInfo {
  code: string;           // E-code format e.g. "E00008"
  hexCode: string;        // Hex string e.g. "0x0008"
  bitmask: number;        // Integer bitmask e.g. 0x0008
  errorType: string;
  possibleReason: string;
  solution: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "PowerElectronics" | "GridFault" | "Thermal" | "ConnectorLock" | "Communications" | "General";
  ocppErrorCodeMapped: string;
  autoHealPlaybookName: string;
}

export const RAEDIAN_ERROR_CODES: Record<string, RaedianErrorCodeInfo> = {
  E00002: {
    code: "E00002",
    hexCode: "0x0002",
    bitmask: 0x0002,
    errorType: "Residual current detected",
    possibleReason: "Vehicle electrical leakage",
    solution: "Reinsert the charging cable in the car and restart charging. If the fault reoccurs, contact the customer support of EV.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "GroundFailure",
    autoHealPlaybookName: "Raedian Residual Current & Vehicle Leakage Clearance",
  },
  E00008: {
    code: "E00008",
    hexCode: "0x0008",
    bitmask: 0x0008,
    errorType: "Overvoltage",
    possibleReason: "The voltage input is greater than or equal to 120% of the nominal voltage (276V).",
    solution: "Restart charging after a while. If the fault reoccurs, power off the wallbox and use the multimeter to check the voltage on the power input. If the voltage is greater than or equal to 120% of the nominal voltage (276V), contact local utility company.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "OverVoltage",
    autoHealPlaybookName: "Raedian Grid Voltage Anomaly Protection",
  },
  E00010: {
    code: "E00010",
    hexCode: "0x0010",
    bitmask: 0x0010,
    errorType: "Undervoltage",
    possibleReason: "The voltage input is lower than or equal to 80% of the nominal voltage (184V).",
    solution: "Restart charging after a while. If the fault reoccurs, power off the wallbox and use the multimeter to check the voltage on the power input. If the voltage is lower than or equal to 80% of the nominal voltage (184V), contact local utility company.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "UnderVoltage",
    autoHealPlaybookName: "Raedian Grid Voltage Anomaly Protection",
  },
  E00020: {
    code: "E00020",
    hexCode: "0x0020",
    bitmask: 0x0020,
    errorType: "Overcurrent",
    possibleReason: "The extracted current from the vehicle side is greater than 110% of the rated current.",
    solution: "Restart charging after a while. If the fault reoccurs, contact the customer support of EV.",
    severity: "HIGH",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OverCurrentFailure",
    autoHealPlaybookName: "Raedian Overcurrent & Vehicle Load Derating",
  },
  E00040: {
    code: "E00040",
    hexCode: "0x0040",
    bitmask: 0x0040,
    errorType: "Severe overcurrent",
    possibleReason: "The extracted current from the vehicle side is greater than 125% of the rated current.",
    solution: "Restart charging after a while. If the fault reoccurs, contact the customer support of EV.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OverCurrentFailure",
    autoHealPlaybookName: "Raedian Overcurrent & Vehicle Load Derating",
  },
  E00080: {
    code: "E00080",
    hexCode: "0x0080",
    bitmask: 0x0080,
    errorType: "Overheat warning",
    possibleReason: "Elevated internal temperature caused by high ambient temperature or direct sunlight. Internal fault of wallbox or charging cable.",
    solution: "Check whether the EV charging cable is securely and fully connected. Ensure the ambient temperature is within the nominal temperature range and without intense direct sunlight. Restart charging; if the fault reoccurs, contact customer support.",
    severity: "MEDIUM",
    category: "Thermal",
    ocppErrorCodeMapped: "HighTemperature",
    autoHealPlaybookName: "Raedian Internal Overheat Thermal Cool-Down",
  },
  E00100: {
    code: "E00100",
    hexCode: "0x0100",
    bitmask: 0x0100,
    errorType: "Vehicle-side diode short circuit",
    possibleReason: "Diode Missing or Diode Short Circuit in Charging Unit or Simulator of EV.",
    solution: "Restart charging after a while. For EV, if the fault reoccurs, contact customer support of EV. For simulator, replace it.",
    severity: "HIGH",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OtherError",
    autoHealPlaybookName: "Raedian Vehicle Diode Circuit Reset",
  },
  E00400: {
    code: "E00400",
    hexCode: "0x0400",
    bitmask: 0x0400,
    errorType: "Relay error",
    possibleReason: "The relay cannot close, or the closed relay cannot open caused by abnormal electrical condition or improper operation.",
    solution: "Re-power on the wallbox. If the wallbox is in regular operation, monitor it for a while if the fault reoccurs. If yes, contact local utility company. If the fault reoccurs instantly for several times, contact customer support.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerSwitchFailure",
    autoHealPlaybookName: "Raedian Contactor & Relay Coil Power Cycle",
  },
  E01000: {
    code: "E01000",
    hexCode: "0x1000",
    bitmask: 0x1000,
    errorType: "Electronic lock error",
    possibleReason: "The charging cable is not fully inserted into the wallbox.",
    solution: "Reinsert the charging cable and ensure it's fully inserted. If the fault reoccurs, contact customer support.",
    severity: "HIGH",
    category: "ConnectorLock",
    ocppErrorCodeMapped: "ConnectorLockFailure",
    autoHealPlaybookName: "Raedian Motorized Lock Latch Pulse",
  },
  E02000: {
    code: "E02000",
    hexCode: "0x2000",
    bitmask: 0x2000,
    errorType: "Phase loss error",
    possibleReason: "Phase loss for three-phase network.",
    solution: "Power off the wallbox. Check the wiring of power line. Power on the wallbox and upgrade the software to the latest version. Restart charging. If the fault reoccurs, contact customer support.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "PowerMeterFailure",
    autoHealPlaybookName: "Raedian Phase Loss & Network Inspection",
  },
  E02010: {
    code: "E02010",
    hexCode: "0x2010",
    bitmask: 0x2010, // 0x2000 (Phase loss) | 0x0010 (Undervoltage)
    errorType: "Phase loss and undervoltage",
    possibleReason: "Phase loss for three-phase network and the voltage input is lower than or equal to 80% of nominal voltage (184V). It's highly likely due to the IT network.",
    solution: "Inquire the local electrician if the electrical network type is an IT network. If yes, power off the wallbox and ensure the wiring of power line is proper for IT network. Ensure the software is of the latest version and the circuit type is set as IT on RAEDIAN app. Restart charging. If the fault reoccurs, contact customer support.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "UnderVoltage",
    autoHealPlaybookName: "Raedian Phase Loss & Network Inspection",
  },
  E04000: {
    code: "E04000",
    hexCode: "0x4000",
    bitmask: 0x4000,
    errorType: "CC detection error",
    possibleReason: "The wallbox did not detect the CC signal from the charging cable.",
    solution: "Reinsert the charging cable and ensure it's fully inserted. If the fault reoccurs, replace the charging cable.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
    autoHealPlaybookName: "Raedian Control Cable (CC) Signal Recovery",
  },
};

/**
 * Fast lookup from hex string (e.g. "0x0008", "0x2010") to Raedian code
 */
export const HEX_TO_RAEDIAN_CODE: Record<string, string> = {
  "0X0002": "E00002",
  "0X2": "E00002",
  "0X0008": "E00008",
  "0X8": "E00008",
  "0X0010": "E00010",
  "0X10": "E00010",
  "0X0020": "E00020",
  "0X20": "E00020",
  "0X0040": "E00040",
  "0X40": "E00040",
  "0X0080": "E00080",
  "0X80": "E00080",
  "0X0100": "E00100",
  "0X100": "E00100",
  "0X0400": "E00400",
  "0X400": "E00400",
  "0X1000": "E01000",
  "0X2000": "E02000",
  "0X2010": "E02010",
  "0X4000": "E04000",
};

/**
 * Helper to get Raedian error information by error code, hex code, or message text
 * Supports:
 * - Hex code format: "0x0008", "0x2010", "0x1000"
 * - E-code format: "E00008", "E02010"
 * - Plain integer bitmask
 * - Raw string containing code
 */
export function getRaedianErrorInfo(code?: string | null): RaedianErrorCodeInfo | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();

  // "0x0000" or "0" means NoError in Raedian firmware
  if (upper === "0X0000" || upper === "0X0" || upper === "0" || upper === "NOERROR") {
    return undefined;
  }

  // 1. Direct match by E-code key
  if (RAEDIAN_ERROR_CODES[upper]) {
    return RAEDIAN_ERROR_CODES[upper];
  }

  // 2. Direct match by hex code table
  if (HEX_TO_RAEDIAN_CODE[upper]) {
    return RAEDIAN_ERROR_CODES[HEX_TO_RAEDIAN_CODE[upper]];
  }

  // 3. Hex integer parsing (e.g. "0x0008", "0x2010")
  if (upper.startsWith("0X")) {
    const parsedHex = parseInt(upper, 16);
    if (!isNaN(parsedHex) && parsedHex > 0) {
      // Check composite 0x2010 first
      if ((parsedHex & 0x2010) === 0x2010) {
        return RAEDIAN_ERROR_CODES["E02010"];
      }
      // Check individual bitmasks
      for (const info of Object.values(RAEDIAN_ERROR_CODES)) {
        if (info.bitmask === parsedHex) {
          return info;
        }
      }
      // Check bitwise membership
      for (const info of Object.values(RAEDIAN_ERROR_CODES)) {
        if ((parsedHex & info.bitmask) === info.bitmask) {
          return info;
        }
      }
    }
  }

  // 4. Fallback search inside text
  for (const [k, v] of Object.entries(RAEDIAN_ERROR_CODES)) {
    if (upper.includes(k) || upper.includes(v.hexCode.toUpperCase()) || upper.includes(v.errorType.toUpperCase())) {
      return v;
    }
  }

  return undefined;
}

/**
 * Returns true if the string corresponds to a known Raedian error code (and is not 0x0000/NoError)
 */
export function isRaedianErrorCode(code?: string | null): boolean {
  return !!getRaedianErrorInfo(code);
}

/**
 * Decodes all active Raedian error codes from a compound bitmask string or number
 */
export function decodeRaedianBitmask(vendorErrorCode: string | number): RaedianErrorCodeInfo[] {
  const num = typeof vendorErrorCode === "number" ? vendorErrorCode : parseInt(vendorErrorCode, 16);
  if (isNaN(num) || num <= 0) return [];

  const matched: RaedianErrorCodeInfo[] = [];
  if ((num & 0x2010) === 0x2010) {
    matched.push(RAEDIAN_ERROR_CODES["E02010"]);
  }

  for (const [key, info] of Object.entries(RAEDIAN_ERROR_CODES)) {
    if (key === "E02010") continue;
    if ((num & info.bitmask) === info.bitmask && !matched.some(m => m.code === info.code)) {
      matched.push(info);
    }
  }

  return matched;
}

/**
 * Parses Raedian charger JSON info payload e.g. "{\"channel\": 16, \"current\": 10}"
 */
export function parseRaedianInfo(infoStr?: string | null): { channel?: number; current?: number; raw?: string } {
  if (!infoStr) return {};
  try {
    const parsed = JSON.parse(infoStr);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        channel: typeof parsed.channel === "number" ? parsed.channel : undefined,
        current: typeof parsed.current === "number" ? parsed.current : undefined,
        raw: infoStr,
      };
    }
  } catch {
    // not json
  }
  return { raw: infoStr };
}

/**
 * Formats a clean diagnostic summary string for Raedian error codes
 */
export function formatRaedianDiagnostic(code: string, infoStr?: string): string {
  const info = getRaedianErrorInfo(code);
  if (!info) return code;
  const parsedTelemetry = parseRaedianInfo(infoStr);
  const telemetryNote = parsedTelemetry.current
    ? ` [Current: ${parsedTelemetry.current}A, Channel: ${parsedTelemetry.channel || "N/A"}]`
    : "";
  return `[Raedian ${info.code} / ${info.hexCode}] ${info.errorType}${telemetryNote} - Cause: ${info.possibleReason} | Solution: ${info.solution}`;
}
