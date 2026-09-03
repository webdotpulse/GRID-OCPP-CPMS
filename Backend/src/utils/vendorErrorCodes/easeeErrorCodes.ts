/**
 * Easee (Home, Charge, Charge Lite, Charge Max) Vendor Error Codes
 * Routes ReasonForNoCurrent enumeration directly into StatusNotification.vendorErrorCode
 */

export interface EaseeReasonInfo {
  code: number | string;
  enumName: string;
  statusContext: "Normal" | "SuspendedEVSE" | "SuspendedEV" | "Faulted" | "Unavailable" | "Informational";
  meaning: string;
  action: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "PowerElectronics" | "GridFault" | "Thermal" | "ConnectorLock" | "Communications" | "General";
  ocppErrorCodeMapped: string;
  isHealthy: boolean;
}

export const EASEE_REASONS: Record<string, EaseeReasonInfo> = {
  "0": {
    code: 0,
    enumName: "ChargerFine",
    statusContext: "Normal",
    meaning: "Operating normally / no active restriction.",
    action: "None. Charger operating as expected.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: true,
  },
  "1": {
    code: 1,
    enumName: "LoadBalancing",
    statusContext: "SuspendedEVSE",
    meaning: "Circuit or dynamic load balancing limit too low / fuse limited.",
    action: "Check dynamic load balancing configuration and active circuit allocation.",
    severity: "MEDIUM",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "2": {
    code: 2,
    enumName: "LoadBalancingPhaseLimit",
    statusContext: "SuspendedEVSE",
    meaning: "Single-phase load balancing limit reached.",
    action: "Check site phase allocation or balance active chargers.",
    severity: "MEDIUM",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "3": {
    code: 3,
    enumName: "LoadBalancingCircuitLimit",
    statusContext: "SuspendedEVSE",
    meaning: "Circuit fuse capacity reached.",
    action: "Check site master breaker limit in Easee Equalizer / CPMS Load Management.",
    severity: "MEDIUM",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "4": {
    code: 4,
    enumName: "LoadBalancingSiteLimit",
    statusContext: "SuspendedEVSE",
    meaning: "Total site dynamic power budget exhausted.",
    action: "Awaiting other vehicles to ramp down or solar surplus increase.",
    severity: "MEDIUM",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "7": {
    code: 7,
    enumName: "IllegalGridType",
    statusContext: "Faulted",
    meaning: "Automatic grid type detection failure (IT vs TN mismatch).",
    action: "Verify physical earthing arrangement (IT vs TN) and set grid type explicitly in Easee installer app.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "GroundFailure",
    isHealthy: false,
  },
  "8": {
    code: 8,
    enumName: "NoCurrentRequest",
    statusContext: "SuspendedEV",
    meaning: "Secondary unit has not requested current.",
    action: "Vehicle has stopped drawing current or is waiting for smart charge schedule.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "9": {
    code: 9,
    enumName: "MasterCommsLost",
    statusContext: "SuspendedEVSE",
    meaning: "Radio/mesh link to master charger lost.",
    action: "Check Easee mesh radio coverage or reposition master charger; reboot satellite.",
    severity: "HIGH",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
    isHealthy: false,
  },
  "10": {
    code: 10,
    enumName: "EqualizerCurrentTooLow",
    statusContext: "SuspendedEVSE",
    meaning: "Equalizer EMS limit throttled charger to 0A.",
    action: "Equalizer has throttled available current below 6A due to heavy building load.",
    severity: "MEDIUM",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "11": {
    code: 11,
    enumName: "PhaseNotConnected",
    statusContext: "Faulted",
    meaning: "Selected phase has no incoming voltage.",
    action: "Check phase fuse and terminal wiring; verify 230V line-to-neutral on all phases.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "PowerMeterFailure",
    isHealthy: false,
  },
  "25": {
    code: 25,
    enumName: "CircuitCurrentLimits",
    statusContext: "SuspendedEVSE",
    meaning: "Dynamic offline fallback or circuit fuse limits hit.",
    action: "Check circuit fuse rating and offline fallback current setting.",
    severity: "MEDIUM",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "53": {
    code: 53,
    enumName: "ChargerDisabled",
    statusContext: "Unavailable",
    meaning: "Charger disabled via app, API, or operator.",
    action: "Change availability to Operative or enable charger via Easee cloud API / CPMS.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "54": {
    code: 54,
    enumName: "PendingSchedule",
    statusContext: "SuspendedEVSE",
    meaning: "Delayed start active awaiting programmed schedule.",
    action: "Awaiting scheduled dynamic charging window (e.g. off-peak EPEX spot tariff).",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "55": {
    code: 55,
    enumName: "PendingAuthorization",
    statusContext: "SuspendedEVSE",
    meaning: "Awaiting RFID swipe or cloud authorization.",
    action: "Authorize via RFID tag, app QR code, or remote start from back office.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "56": {
    code: 56,
    enumName: "ChargerInError",
    statusContext: "Faulted",
    meaning: "General hardware or relay safety trip.",
    action: "Soft reboot charger via OCPP. If fault persists, check internal safety contactors.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerSwitchFailure",
    isHealthy: false,
  },
  "57": {
    code: 57,
    enumName: "ErraticEV",
    statusContext: "SuspendedEV",
    meaning: "Vehicle Control Pilot signal unstable or fluttering.",
    action: "Instruct driver to reseat cable. Check for moisture or damaged CP pin in vehicle inlet.",
    severity: "HIGH",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
    isHealthy: false,
  },
  "75": {
    code: 75,
    enumName: "CableRatingLimit",
    statusContext: "Informational",
    meaning: "Output current clamped by Type 2 cable PP resistor rating.",
    action: "Informing operator that cable is clamped (e.g. 20A / 13.8kW cable plugged into 22kW socket).",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "79": {
    code: 79,
    enumName: "CarLimit",
    statusContext: "SuspendedEV",
    meaning: "Vehicle stopped drawing power or battery full.",
    action: "Vehicle battery management system (BMS) reached 100% SoC or paused charging.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "81": {
    code: 81,
    enumName: "CarLimitSecondary",
    statusContext: "SuspendedEV",
    meaning: "Vehicle onboard charger paused charging session.",
    action: "Vehicle internal charger paused session.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
    isHealthy: false,
  },
  "100": {
    code: 100,
    enumName: "UndefinedError",
    statusContext: "Faulted",
    meaning: "Unspecified internal system error.",
    action: "Perform soft reset and review system firmware update status.",
    severity: "HIGH",
    category: "General",
    ocppErrorCodeMapped: "InternalError",
    isHealthy: false,
  },
};

export function getEaseeReasonInfo(codeOrEnum?: string | number | null): EaseeReasonInfo | undefined {
  if (codeOrEnum === undefined || codeOrEnum === null) return undefined;
  const str = String(codeOrEnum).trim();

  // 1. Direct key match
  if (EASEE_REASONS[str]) {
    return EASEE_REASONS[str];
  }

  // 2. Enum name match (e.g. "IllegalGridType", "ChargerFine")
  const upper = str.toUpperCase();
  for (const info of Object.values(EASEE_REASONS)) {
    if (info.enumName.toUpperCase() === upper || upper.includes(info.enumName.toUpperCase())) {
      return info;
    }
  }

  // 3. Sub-range handling (e.g. 1..4 or 25..30)
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 4) return EASEE_REASONS["1"];
    if (num >= 25 && num <= 30) return EASEE_REASONS["25"];
  }

  return undefined;
}
