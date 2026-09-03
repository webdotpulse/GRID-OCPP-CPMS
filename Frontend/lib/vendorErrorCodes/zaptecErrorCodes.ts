/**
 * Zaptec 32-bit hardware status bitmask (Frontend)
 */

export interface ZaptecBitmaskFlag {
  bit: number;
  value: number;
  name: string;
  description: string;
  action: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "PowerElectronics" | "GridFault" | "Thermal" | "ConnectorLock" | "Communications" | "General";
  ocppErrorCodeMapped: string;
}

export const ZAPTEC_FLAGS: Record<number, ZaptecBitmaskFlag> = {
  1: {
    bit: 0,
    value: 1,
    name: "CONTACTOR_WELDED",
    description: "Contactor / relay welded or output switch stuck open",
    action: "Soft reboot charger to release coil drive; if contacts remain welded, service relay.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerSwitchFailure",
  },
  2: {
    bit: 1,
    value: 2,
    name: "DC_RCD_FAULT",
    description: "DC RCD leakage fault detected (>=6mA DC)",
    action: "Disconnect vehicle cable; power cycle charger to re-zero DC transducer.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "GroundFailure",
  },
  8: {
    bit: 3,
    value: 8,
    name: "PHASE_MISSING",
    description: "Phase missing / supply under-voltage (e.g. L2/L3 missing on 3-phase)",
    action: "Check incoming 3-phase line fuses and main breaker supply voltage.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "UnderVoltage",
  },
  256: {
    bit: 8,
    value: 256,
    name: "LOCK_ACTUATOR_FAULT",
    description: "Lock actuator failed to secure cable lock pin",
    action: "Send dual UnlockConnector pulse to relieve mechanical pin tension.",
    severity: "HIGH",
    category: "ConnectorLock",
    ocppErrorCodeMapped: "ConnectorLockFailure",
  },
  65536: {
    bit: 16,
    value: 65536,
    name: "TEMPERATURE_DERATE_SHUTDOWN",
    description: "Internal over-temperature derating / thermal shutdown",
    action: "Derate charging current to 6A to allow passive heat dissipation.",
    severity: "HIGH",
    category: "Thermal",
    ocppErrorCodeMapped: "HighTemperature",
  },
  134217728: {
    bit: 27,
    value: 134217728,
    name: "GRID_ANOMALY_NO_VOLTAGE",
    description: "Multi-phase grid anomaly (NO_VOLTAGE_L2_L3 or floating neutral)",
    action: "Inspect installation earthing and neutral conductor integrity.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "PowerMeterFailure",
  },
};

export function decodeZaptecBitmask(val: number | string): ZaptecBitmaskFlag[] {
  const num = typeof val === "number" ? val : parseInt(String(val).trim(), 10);
  if (isNaN(num) || num <= 0) return [];

  const matched: ZaptecBitmaskFlag[] = [];
  for (const flag of Object.values(ZAPTEC_FLAGS)) {
    if ((num & flag.value) === flag.value) {
      matched.push(flag);
    }
  }
  return matched;
}

export function getZaptecErrorInfo(code?: string | number | null): {
  primaryFlag?: ZaptecBitmaskFlag;
  flags: ZaptecBitmaskFlag[];
  summary: string;
} | undefined {
  if (code === undefined || code === null) return undefined;
  const num = typeof code === "number" ? code : parseInt(String(code).trim(), 10);

  if (!isNaN(num) && num > 0) {
    const flags = decodeZaptecBitmask(num);
    if (flags.length > 0) {
      const primaryFlag = flags.find(f => f.severity === "CRITICAL") || flags[0];
      const summary = flags.map(f => `[Bit ${f.bit}: ${f.name}] ${f.description}`).join(" | ");
      return { primaryFlag, flags, summary };
    }
  }

  const str = String(code).toUpperCase();
  for (const flag of Object.values(ZAPTEC_FLAGS)) {
    if (str.includes(flag.name) || str.includes(String(flag.value))) {
      return { primaryFlag: flag, flags: [flag], summary: `[Bit ${flag.bit}: ${flag.name}] ${flag.description}` };
    }
  }

  return undefined;
}
