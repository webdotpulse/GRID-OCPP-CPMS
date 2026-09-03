/**
 * Alfen Eve Series (Single, Double, Twin) Vendor Error Codes (Frontend)
 */

export interface AlfenErrorCodeInfo {
  code: string;
  domain: "Internal" | "Installation" | "EV Side" | "External";
  name: string;
  description: string;
  rootCause: string;
  action: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "PowerElectronics" | "GridFault" | "Thermal" | "ConnectorLock" | "Communications" | "General";
  ocppErrorCodeMapped: string;
}

export const ALFEN_ERROR_CODES: Record<string, AlfenErrorCodeInfo> = {
  "101": {
    code: "101",
    domain: "Internal",
    name: "6mA DC RCD Fault",
    description: "DC residual current leakage detected",
    rootCause: "DC residual current leakage detected (>=6mA DC).",
    action: "Check car onboard charger or power board. Power cycle after disconnecting cable.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "GroundFailure",
  },
  "102": {
    code: "102",
    domain: "Internal",
    name: "Power Switch Failure",
    description: "Relay/contactor welded or unexpected voltage on output",
    rootCause: "Relay/contactor contacts welded shut or output sensing voltage anomaly.",
    action: "Inspect power relay contacts; soft reset charger. Replace mainboard switch module if persistent.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerSwitchFailure",
  },
  "104": {
    code: "104",
    domain: "Internal",
    name: "Low 12V Supply",
    description: "Internal power supply voltage rail too low",
    rootCause: "Secondary 12V internal auxiliary power rail dropped below operational threshold.",
    action: "Inspect internal 12V power supply rail and control board power connector.",
    severity: "HIGH",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "InternalError",
  },
  "105": {
    code: "105",
    domain: "Internal",
    name: "Internal Meter Failure",
    description: "Communication lost with internal MID energy meter",
    rootCause: "RS-485 Modbus communication with internal MID certified energy meter timed out.",
    action: "Soft reset Alfen controller CPU to re-initialize internal MID energy register.",
    severity: "HIGH",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerMeterFailure",
  },
  "106": {
    code: "106",
    domain: "Internal",
    name: "AC RCD Tripped",
    description: "Internal Type-A 30mA AC RCD tripped",
    rootCause: "Internal Type-A 30mA AC residual current breaker tripped.",
    action: "Check vehicle and charging cable for AC leakage. Perform local hardware reset on RCD breaker.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "GroundFailure",
  },
  "109": {
    code: "109",
    domain: "Internal",
    name: "RFID Reader Failure",
    description: "Communication lost with the RFID reader board",
    rootCause: "SPI / serial bus communication lost with internal RFID antenna module.",
    action: "Perform soft reboot. Verify RFID reader ribbon cable connection.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "ReaderFailure",
  },
  "201": {
    code: "201",
    domain: "Installation",
    name: "Installation / Phase Wiring",
    description: "Incorrect phase wiring or phase rotation error",
    rootCause: "Incorrect mains phase rotation (L1-L2-L3) or floating neutral detected during self-test.",
    action: "Check physical terminal wiring and verify clockwise phase rotation on incoming feed.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "PowerMeterFailure",
  },
  "202": {
    code: "202",
    domain: "Installation",
    name: "Input Under-Voltage",
    description: "Supply voltage dropped below 210 VAC",
    rootCause: "Supply mains voltage dropped below 210 VAC nominal threshold.",
    action: "Check grid feed voltage with multimeter. Check upstream breaker and contact utility if grid sag persists.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "UnderVoltage",
  },
  "206": {
    code: "206",
    domain: "Installation",
    name: "EMS / Modbus Timeout",
    description: "Loss of Modbus TCP/IP meter communication",
    rootCause: "External Energy Management System (EMS) or Modbus TCP meter communication timeout.",
    action: "Verify Ethernet/RS-485 link to external energy meter. Operating in 6A safe fallback mode.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
  },
  "211": {
    code: "211",
    domain: "Installation",
    name: "Actuator / Lock Motor Fault",
    description: "Socket lock motor failed self-test or cannot engage",
    rootCause: "Motorized socket lock actuator failed optical sensor self-test or pin cannot engage.",
    action: "Trigger UnlockConnector sequence. Check socket for physical debris or alignment issues.",
    severity: "HIGH",
    category: "ConnectorLock",
    ocppErrorCodeMapped: "ConnectorLockFailure",
  },
  "212": {
    code: "212",
    domain: "Installation",
    name: "Missing Phase",
    description: "Supply missing phase (typically L2 or L3)",
    rootCause: "Incoming power supply missing one or more phases (typically L2 or L3 blown fuse).",
    action: "Check upstream distribution fuses and circuit breakers on L2 and L3.",
    severity: "HIGH",
    category: "GridFault",
    ocppErrorCodeMapped: "PowerMeterFailure",
  },
  "213": {
    code: "213",
    domain: "Installation",
    name: "TIC Smart Meter Lost",
    description: "Tele-Information Client communication lost",
    rootCause: "Tele-Information Client (TIC) link to smart meter lost. Safe mode throttled to 6A.",
    action: "Check TIC interface wiring and smart meter port signal. Charger fallback limit set to 6A.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
  },
  "214": {
    code: "214",
    domain: "Installation",
    name: "Tariff Missing",
    description: "Eichrecht ad-hoc payment tariffs not configured",
    rootCause: "Legal metrology Eichrecht ad-hoc tariff data table is not provisioned.",
    action: "Provision active tariff table in CPMS or ACE Service Installer.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "OtherError",
  },
  "301": {
    code: "301",
    domain: "EV Side",
    name: "Vehicle Communication Fault",
    description: "Control Pilot (CP) signal out of spec or vehicle handshake failed",
    rootCause: "Control Pilot (CP) PWM signal out of tolerance or vehicle handshake failed.",
    action: "Inspect EV charging cable and connector pins. Reinsert plug into vehicle inlet.",
    severity: "HIGH",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
  },
  "302": {
    code: "302",
    domain: "EV Side",
    name: "Diode Fault",
    description: "Car diode test failed (shorted CP diode)",
    rootCause: "Vehicle-side protective diode test failed (diode shorted or missing on Control Pilot).",
    action: "Inspect EV onboard charging inlet. Reconnect cable after vehicle powers down.",
    severity: "HIGH",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OtherError",
  },
  "304": {
    code: "304",
    domain: "EV Side",
    name: "Session Timeout",
    description: "Cable plugged in for >2 minutes without authorization",
    rootCause: "Charging cable plugged in for more than 2 minutes without user RFID/app authorization.",
    action: "Swipe authorized RFID card or start remote session via CPMS app.",
    severity: "LOW",
    category: "General",
    ocppErrorCodeMapped: "NoError",
  },
  "401": {
    code: "401",
    domain: "External",
    name: "High Temperature",
    description: "Internal charger temperature >70°C; charging derated/stopped",
    rootCause: "Internal enclosure temperature exceeded 70°C safety threshold.",
    action: "Safely derate charging current to 6A to allow passive heat dissipation; check ventilation.",
    severity: "HIGH",
    category: "Thermal",
    ocppErrorCodeMapped: "HighTemperature",
  },
  "402": {
    code: "402",
    domain: "External",
    name: "Socket Lock Jammed",
    description: "Plug not inserted deeply enough or foreign object blocking pin",
    rootCause: "Charging plug not seated deeply enough or foreign object obstructing locking pin.",
    action: "Execute dual-pulse UnlockConnector sequence to release latch; instruct driver to reseat cable firmly.",
    severity: "HIGH",
    category: "ConnectorLock",
    ocppErrorCodeMapped: "ConnectorLockFailure",
  },
  "405": {
    code: "405",
    domain: "External",
    name: "Cable PP Resistor Out of Spec",
    description: "Proximity Pilot (PP) resistance invalid under IEC 61851",
    rootCause: "Proximity Pilot (PP) resistance invalid under IEC 61851 cable rating standards.",
    action: "Inspect Type 2 charging cable and replace if PP resistor is damaged.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "EVCommunicationError",
  },
};

export function getAlfenErrorInfo(code?: string | null): AlfenErrorCodeInfo | undefined {
  if (!code) return undefined;
  const clean = code.trim().replace(/^Err_/i, "").replace(/^0+/, "");
  if (ALFEN_ERROR_CODES[clean]) return ALFEN_ERROR_CODES[clean];

  for (const [k, v] of Object.entries(ALFEN_ERROR_CODES)) {
    const reg = new RegExp(`\\b(${k}|Err_${k})\\b`, "i");
    if (reg.test(code) || code.toLowerCase().includes(v.name.toLowerCase())) {
      return v;
    }
  }
  return undefined;
}
