/**
 * Peblar Vendor Error & Warning Codes (Frontend)
 */

export interface PeblarCodeInfo {
  code: string;
  type: "Error" | "Warning";
  name: string;
  description: string;
  resolution: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "PowerElectronics" | "GridFault" | "Thermal" | "ConnectorLock" | "Communications" | "General";
  ocppErrorCodeMapped: string;
}

export const PEBLAR_CODES: Record<string, PeblarCodeInfo> = {
  "1000": {
    code: "1000",
    type: "Error",
    name: "Lock Motor Failure",
    description: "Lock motor failed to lock/unlock socket",
    resolution: "Check socket for physical obstructions; send remote unlock pulse; cycle power.",
    severity: "HIGH",
    category: "ConnectorLock",
    ocppErrorCodeMapped: "ConnectorLockFailure",
  },
  "1001": {
    code: "1001",
    type: "Error",
    name: "Relay Contactor Failure",
    description: "Relay contactor failure (welded/stuck)",
    resolution: "Hard reset via back office; inspect power contactor; contact service if persistent.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerSwitchFailure",
  },
  "1002": {
    code: "1002",
    type: "Error",
    name: "Output Short Circuit",
    description: "Output short circuit detected",
    resolution: "Unplug cable; check vehicle inlet and cable conductors for physical damage.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OtherError",
  },
  "1003": {
    code: "1003",
    type: "Error",
    name: "Plug Short Circuit",
    description: "Plug short circuit detected",
    resolution: "Replace charging cable and verify resistance between phase pins.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OtherError",
  },
  "1004": {
    code: "1004",
    type: "Error",
    name: "Control Pilot Fault",
    description: "Control Pilot fault (EV communication error)",
    resolution: "EV inlet communication error; inspect vehicle side CP pin.",
    severity: "HIGH",
    category: "Communications",
    ocppErrorCodeMapped: "OtherError",
  },
  "1005": {
    code: "1005",
    type: "Error",
    name: "EV Communication Timeout",
    description: "EV communication timeout",
    resolution: "Check if vehicle has entered deep sleep mode or completed charge.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "OtherError",
  },
  "1050": {
    code: "1050",
    type: "Error",
    name: "Mainboard Integrity Fault",
    description: "Internal boot / mainboard integrity fault",
    resolution: "Power cycle wallbox; verify latest Peblar firmware image.",
    severity: "CRITICAL",
    category: "General",
    ocppErrorCodeMapped: "InternalError",
  },
  "1057": {
    code: "1057",
    type: "Error",
    name: "Earth Leakage Detected",
    description: "Earth leakage detected (residual DC/AC current)",
    resolution: "Residual current trip; disconnect cable and inspect EV onboard charger.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "GroundFailure",
  },
  "1058": {
    code: "1058",
    type: "Error",
    name: "Internal Relay Error",
    description: "Internal relay error",
    resolution: "Reboot / power cycle; replace power module if recurring.",
    severity: "CRITICAL",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "PowerSwitchFailure",
  },
  "1059": {
    code: "1059",
    type: "Error",
    name: "Over-Temperature Condition",
    description: "Over-temperature condition detected",
    resolution: "Wait 15 minutes to cool down; derate charging current; check ventilation.",
    severity: "HIGH",
    category: "Thermal",
    ocppErrorCodeMapped: "HighTemperature",
  },
  "1061": {
    code: "1061",
    type: "Error",
    name: "Ground Monitoring Error",
    description: "Ground monitoring error (PE connection lost)",
    resolution: "Check upstream earth resistance and protective earth (PE) terminal connection.",
    severity: "CRITICAL",
    category: "GridFault",
    ocppErrorCodeMapped: "GroundFailure",
  },
  "1065": {
    code: "1065",
    type: "Error",
    name: "Open PEN Disconnection",
    description: "PEN fault detected (Open PEN disconnection)",
    resolution: "Neutral/Earth potential difference fault; inspect grid PE and neutral line integrity.",
    severity: "CRITICAL",
    category: "GridFault",
    ocppErrorCodeMapped: "OtherError",
  },
  "1252": {
    code: "1252",
    type: "Error",
    name: "Installation Current Limit Exceeded",
    description: "Cable, phase, or installation current limit exceeded",
    resolution: "Check dynamic load balancing configuration and breaker sizing.",
    severity: "HIGH",
    category: "PowerElectronics",
    ocppErrorCodeMapped: "OverCurrentFailure",
  },

  // 5-Digit Warning Codes
  "10000": {
    code: "10000",
    type: "Warning",
    name: "Back-Office Connectivity Lost",
    description: "Back-office connectivity lost (operating autonomously offline)",
    resolution: "Check cellular/Ethernet connection; charger stores transactions in local memory.",
    severity: "LOW",
    category: "Communications",
    ocppErrorCodeMapped: "NoError",
  },
  "10200": {
    code: "10200",
    type: "Warning",
    name: "Group Load Balancing Comms Drop",
    description: "Group load balancing communication fault (RS-485 daisy-chain or Ethernet drop)",
    resolution: "Check RS-485 termination resistors and Ethernet patch cables between group chargers.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "NoError",
  },
  "10250": {
    code: "10250",
    type: "Warning",
    name: "CT Coil Measurement Missing",
    description: "External CT coil measurement missing or disconnected",
    resolution: "Inspect current transformer (CT) clamps on incoming mains cable.",
    severity: "MEDIUM",
    category: "GridFault",
    ocppErrorCodeMapped: "NoError",
  },
  "10260": {
    code: "10260",
    type: "Warning",
    name: "P1 Smart Meter Interface Fault",
    description: "P1 smart meter / DSMR interface communication fault",
    resolution: "Check RJ12 cable connection to smart meter P1 port and verify DSMR telegrams.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "NoError",
  },
  "10270": {
    code: "10270",
    type: "Warning",
    name: "Modbus Meter Unreachable",
    description: "External Modbus TCP / RTU energy meter unreachable",
    resolution: "Verify Modbus IP address and slave ID settings on local network.",
    severity: "MEDIUM",
    category: "Communications",
    ocppErrorCodeMapped: "NoError",
  },
  "10300": {
    code: "10300",
    type: "Warning",
    name: "NTP Time Sync Failure",
    description: "NTP time synchronization failure",
    resolution: "Check firewall UDP port 123 access for legal metrology clock synchronization.",
    severity: "LOW",
    category: "Communications",
    ocppErrorCodeMapped: "NoError",
  },
};

export function getPeblarCodeInfo(code?: string | number | null): PeblarCodeInfo | undefined {
  if (code === undefined || code === null) return undefined;
  const str = String(code).trim();
  if (PEBLAR_CODES[str]) return PEBLAR_CODES[str];

  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    if (num >= 1050 && num <= 1056) return PEBLAR_CODES["1050"];
    if (num >= 1252 && num <= 1256) return PEBLAR_CODES["1252"];
    if (num >= 10200 && num <= 10220) return PEBLAR_CODES["10200"];
    if (num >= 10250 && num <= 10253) return PEBLAR_CODES["10250"];
    if (num >= 10260 && num <= 10264) return PEBLAR_CODES["10260"];
    if (num >= 10270 && num <= 10275) return PEBLAR_CODES["10270"];
  }

  for (const [k, v] of Object.entries(PEBLAR_CODES)) {
    if (str.includes(k) || str.toLowerCase().includes(v.name.toLowerCase())) {
      return v;
    }
  }
  return undefined;
}
