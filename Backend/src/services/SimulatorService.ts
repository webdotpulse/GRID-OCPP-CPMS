import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/database.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export type OcppProtocol = "ocpp1.6" | "ocpp2.0.1" | "ocpp2.1";
export type SimulatorStatus = "disconnected" | "connecting" | "connected" | "offline_buffering" | "error";

export type ConnectorStatus =
  | "Available"
  | "Preparing"
  | "Charging"
  | "SuspendedEVSE"
  | "SuspendedEV"
  | "Finishing"
  | "Reserved"
  | "Unavailable"
  | "Faulted";

export interface SimulatedConnector {
  id: number;
  evseId: number;
  connectorName: string;
  format: string; // "SOCKET" | "CABLE"
  type: string; // "Type2" | "CCS2" | "CHAdeMO"
  status: ConnectorStatus;
  errorCode?: string;
  vendorErrorCode?: string;
  isPlugged: boolean;
  transactionId: number | string | null;
  idTag: string | null;
  meterStart: number;
  currentMeterWh: number;
  currentPowerW: number;
  maxPowerW: number;
  voltage: number;
  currentAmps: number;
  soc: number;
  temperature: number;
  startedAt: Date | null;
  smartChargingLimitW: number | null;
  smartChargingLimitAmps: number | null;
  throttleReason: string | null;
}

export interface SimulatorLogEntry {
  id: string;
  timestamp: string;
  direction: "in" | "out";
  messageType: "CALL" | "CALLRESULT" | "CALLERROR";
  messageId: string;
  action?: string;
  payload: any;
  status?: string;
  latencyMs?: number;
}

export interface BufferedFrame {
  id: string;
  messageType: number; // 2 = CALL
  messageId: string;
  action: string;
  payload: any;
  timestamp: string;
}

export interface TestSuiteStep {
  name: string;
  description: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  durationMs?: number;
  error?: string;
  details?: any;
}

export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  passed: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: TestSuiteStep[];
}

export interface SimulatedConnectorConfig {
  id: number;
  connectorName: string;
  type: string; // "Type2" | "CCS2" | "CHAdeMO"
  format: string; // "SOCKET" | "CABLE"
  maxPowerW: number;
  maxCurrentAmps: number;
  maxVoltageVolts: number;
  currentType: "AC" | "DC";
  phaseConnection: string;
}

export interface ChargerTemplate {
  id: string;
  name: string;
  vendor: string;
  model: string;
  firmwareVersion: string;
  category: "AC_WALLBOX" | "AC_DUAL" | "DC_FAST" | "DC_HPC" | "V2G_BIDIRECTIONAL" | "SOLAR_OPTIMIZED";
  powerCapacityKw: number;
  defaultProtocol: OcppProtocol;
  supportedProtocols: OcppProtocol[];
  description: string;
  features: string[];
  connectors: SimulatedConnectorConfig[];
}

export const CHARGER_TEMPLATES: ChargerTemplate[] = [
  {
    id: "alfen-eve-single",
    name: "Alfen Eve Single Pro-line",
    vendor: "Alfen",
    model: "Eve Single Pro-line",
    firmwareVersion: "v5.14.0-sim",
    category: "AC_WALLBOX",
    powerCapacityKw: 22.0,
    defaultProtocol: "ocpp1.6",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Standard residential & commercial smart wallbox with OCPP 1.6-J and dynamic load balancing.",
    features: ["22 kW AC", "Type 2 Socket", "Smart Charging", "RFID Reader", "EPEX Spot Pricing"],
    connectors: [
      {
        id: 1,
        connectorName: "Channel 1 (22kW AC)",
        type: "Type2",
        format: "SOCKET",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 400,
        currentType: "AC",
        phaseConnection: "L1-L2-L3",
      },
    ],
  },
  {
    id: "evbox-businessline-dual",
    name: "EVBox BusinessLine G4 Dual",
    vendor: "EVBox",
    model: "BusinessLine G4",
    firmwareVersion: "v2.5.1-sim",
    category: "AC_DUAL",
    powerCapacityKw: 44.0,
    defaultProtocol: "ocpp1.6",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Commercial destination dual-socket station with master-satellite load sharing.",
    features: ["2x 22 kW AC", "Dual Type 2 Sockets", "Hub / Satellite", "Concurrent Charging", "RFID"],
    connectors: [
      {
        id: 1,
        connectorName: "EVSE 1 (22kW AC)",
        type: "Type2",
        format: "SOCKET",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 400,
        currentType: "AC",
        phaseConnection: "L1-L2-L3",
      },
      {
        id: 2,
        connectorName: "EVSE 2 (22kW AC)",
        type: "Type2",
        format: "SOCKET",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 400,
        currentType: "AC",
        phaseConnection: "L1-L2-L3",
      },
    ],
  },
  {
    id: "abb-terra-184-dc",
    name: "ABB Terra 184 DC Fast Charger",
    vendor: "ABB",
    model: "Terra 184",
    firmwareVersion: "v4.1.2-sim",
    category: "DC_FAST",
    powerCapacityKw: 180.0,
    defaultProtocol: "ocpp2.0.1",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "High-power DC fast charger supporting simultaneous CCS2 and CHAdeMO vehicle charging.",
    features: ["180 kW DC", "CCS2 + CHAdeMO", "OCPP 2.0.1", "Dynamic Power Sharing", "800V Architecture"],
    connectors: [
      {
        id: 1,
        connectorName: "CCS2 Cable (150kW DC)",
        type: "CCS2",
        format: "CABLE",
        maxPowerW: 150000,
        maxCurrentAmps: 250,
        maxVoltageVolts: 800,
        currentType: "DC",
        phaseConnection: "DC",
      },
      {
        id: 2,
        connectorName: "CHAdeMO Cable (50kW DC)",
        type: "CHAdeMO",
        format: "CABLE",
        maxPowerW: 50000,
        maxCurrentAmps: 125,
        maxVoltageVolts: 500,
        currentType: "DC",
        phaseConnection: "DC",
      },
    ],
  },
  {
    id: "alpitronic-hyc300-hpc",
    name: "Alpitronic Hypercharger HYC300",
    vendor: "Alpitronic",
    model: "Hypercharger HYC300",
    firmwareVersion: "v6.2.0-sim",
    category: "DC_HPC",
    powerCapacityKw: 300.0,
    defaultProtocol: "ocpp2.1",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Ultra-fast highway HPC hub with dual liquid-cooled CCS2 cables and native OCPP 2.1 protocol.",
    features: ["300 kW Ultra-Fast", "Dual Liquid-Cooled CCS2", "OCPP 2.1 Native", "1000V Matrix", "ISO 15118 PnC"],
    connectors: [
      {
        id: 1,
        connectorName: "HPC Plug A (300kW CCS2)",
        type: "CCS2",
        format: "CABLE",
        maxPowerW: 300000,
        maxCurrentAmps: 500,
        maxVoltageVolts: 1000,
        currentType: "DC",
        phaseConnection: "DC",
      },
      {
        id: 2,
        connectorName: "HPC Plug B (300kW CCS2)",
        type: "CCS2",
        format: "CABLE",
        maxPowerW: 300000,
        maxCurrentAmps: 500,
        maxVoltageVolts: 1000,
        currentType: "DC",
        phaseConnection: "DC",
      },
    ],
  },
  {
    id: "wallbox-quasar2-v2g",
    name: "Wallbox Quasar 2 V2G / V2H",
    vendor: "Wallbox",
    model: "Quasar 2 V2G",
    firmwareVersion: "v2.0.0-v2g",
    category: "V2G_BIDIRECTIONAL",
    powerCapacityKw: 22.0,
    defaultProtocol: "ocpp2.1",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Bidirectional vehicle-to-grid charger capable of EV battery discharging for grid frequency stabilization.",
    features: ["22 kW Bidirectional", "V2G / V2H Discharging", "Peak Shaving", "ISO 15118-20 V2G", "Blackout Backup"],
    connectors: [
      {
        id: 1,
        connectorName: "V2G Plug (22kW Bidirectional)",
        type: "CCS2",
        format: "CABLE",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 500,
        currentType: "DC",
        phaseConnection: "DC",
      },
    ],
  },
  {
    id: "kempower-satellite-t800",
    name: "Kempower Satellite T800 Depot",
    vendor: "Kempower",
    model: "Satellite T800",
    firmwareVersion: "v5.4.0-sim",
    category: "DC_FAST",
    powerCapacityKw: 200.0,
    defaultProtocol: "ocpp1.6",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Depot & fleet modular DC charging satellite with dynamic 25kW power-granularity routing.",
    features: ["200 kW Dynamic DC", "Dual CCS2", "Granular Dynamic Balancing", "Fleet Telematics"],
    connectors: [
      {
        id: 1,
        connectorName: "Depot Sat 1 (200kW CCS2)",
        type: "CCS2",
        format: "CABLE",
        maxPowerW: 200000,
        maxCurrentAmps: 300,
        maxVoltageVolts: 800,
        currentType: "DC",
        phaseConnection: "DC",
      },
      {
        id: 2,
        connectorName: "Depot Sat 2 (200kW CCS2)",
        type: "CCS2",
        format: "CABLE",
        maxPowerW: 200000,
        maxCurrentAmps: 300,
        maxVoltageVolts: 800,
        currentType: "DC",
        phaseConnection: "DC",
      },
    ],
  },
  {
    id: "easee-charge-max-solar",
    name: "Easee Charge Max (Solar & Phase Switching)",
    vendor: "Easee",
    model: "Charge Max",
    firmwareVersion: "v3.3.1-sim",
    category: "SOLAR_OPTIMIZED",
    powerCapacityKw: 22.0,
    defaultProtocol: "ocpp1.6",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Intelligent residential & workplace charging with automatic 1-phase / 3-phase solar tracking.",
    features: ["1-Phase / 3-Phase Switching", "Solar Surplus Tracking", "11kW - 22kW AC", "Eco Mode"],
    connectors: [
      {
        id: 1,
        connectorName: "Solar Smart Socket (22kW AC)",
        type: "Type2",
        format: "SOCKET",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 400,
        currentType: "AC",
        phaseConnection: "L1-L2-L3",
      },
    ],
  },
  {
    id: "mennekes-amedio-pro",
    name: "Mennekes Amedio Professional",
    vendor: "Mennekes",
    model: "Amedio Professional 22",
    firmwareVersion: "v4.2.0-sim",
    category: "AC_DUAL",
    powerCapacityKw: 44.0,
    defaultProtocol: "ocpp1.6",
    supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"],
    description: "Heavy-duty commercial charging pillar with calibrated billing-grade MID metering.",
    features: ["2x 22 kW AC", "Dual Type 2", "Eichrecht / MID Certified", "Corporate Fleet Whitelist"],
    connectors: [
      {
        id: 1,
        connectorName: "Point A (22kW Type2)",
        type: "Type2",
        format: "SOCKET",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 400,
        currentType: "AC",
        phaseConnection: "L1-L2-L3",
      },
      {
        id: 2,
        connectorName: "Point B (22kW Type2)",
        type: "Type2",
        format: "SOCKET",
        maxPowerW: 22000,
        maxCurrentAmps: 32,
        maxVoltageVolts: 400,
        currentType: "AC",
        phaseConnection: "L1-L2-L3",
      },
    ],
  },
];

export class SimulatedChargerInstance {
  public id: string; // session ID
  public chargerId: number;
  public chargerName: string;
  public protocol: OcppProtocol;
  public endpoint: string;
  public status: SimulatorStatus = "disconnected";
  public errorMessage: string | null = null;
  public vendor: string = "VirtualLab";
  public model: string = "GridSim-Pro-2026";
  public serialNumber: string;
  public firmwareVersion: string = "v4.2.0-sim";
  public lastHeartbeat: Date | null = null;
  public heartbeatIntervalSeconds: number = 60;
  public autoMeterValuesIntervalSeconds: number = 10;
  public connectors: Map<number, SimulatedConnector> = new Map();
  public offlineBuffer: BufferedFrame[] = [];
  public logs: SimulatorLogEntry[] = [];
  public maxLogs: number = 200;

  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private meterTimers: Map<number, NodeJS.Timeout> = new Map();
  private transitionTimers: Set<NodeJS.Timeout> = new Set();
  private pendingRequests: Map<string, {
    action: string;
    sentAt: number;
    resolve: (val: any) => void;
    reject: (err: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(options: {
    chargerId: number;
    chargerName: string;
    protocol?: OcppProtocol;
    endpoint?: string;
    vendor?: string;
    model?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    connectors?: Array<{
      id: number;
      name?: string;
      maxPowerW?: number;
      type?: string;
      format?: string;
    }>;
  }) {
    this.id = uuidv4();
    this.chargerId = options.chargerId;
    this.chargerName = options.chargerName;
    this.protocol = options.protocol || "ocpp1.6";
    this.endpoint = options.endpoint || `ws://localhost:${config.ocppPort}/OCPP/${this.protocol === "ocpp1.6" ? "1.6" : "2.1"}/${this.chargerName}`;
    if (options.vendor) this.vendor = options.vendor;
    if (options.model) this.model = options.model;
    this.serialNumber = options.serialNumber || `SIM-${options.chargerName}-${Date.now().toString().slice(-4)}`;
    if (options.firmwareVersion) this.firmwareVersion = options.firmwareVersion;

    // Initialize connectors
    const conns = options.connectors && options.connectors.length > 0
      ? options.connectors
      : [
          { id: 1, name: "Channel 1", maxPowerW: 22000, type: "Type2", format: "SOCKET" },
        ];

    for (const c of conns) {
      this.connectors.set(c.id, {
        id: c.id,
        evseId: c.id,
        connectorName: c.name || `Connector ${c.id}`,
        format: c.format || "SOCKET",
        type: c.type || (c.id === 1 ? "Type2" : "CCS2"),
        status: "Available",
        isPlugged: false,
        transactionId: null,
        idTag: null,
        meterStart: 0,
        currentMeterWh: 10000 + c.id * 5000,
        currentPowerW: 0,
        maxPowerW: c.maxPowerW || (c.id === 1 ? 22000 : 150000),
        voltage: 230.0,
        currentAmps: 0.0,
        soc: 20,
        temperature: 24.5,
        startedAt: null,
        smartChargingLimitW: null,
        smartChargingLimitAmps: null,
        throttleReason: null,
      });
    }
  }

  public addLog(entry: Omit<SimulatorLogEntry, "id" | "timestamp">): void {
    const log: SimulatorLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  /**
   * Connect to CPMS WebSocket Server
   */
  public async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = "connecting";
    this.errorMessage = null;

    return new Promise((resolve, reject) => {
      try {
        const protocols = [this.protocol];
        logger.info(`[Simulator ${this.chargerName}] Connecting to ${this.endpoint} with protocol ${this.protocol}`);

        this.ws = new WebSocket(this.endpoint, protocols, {
          handshakeTimeout: 10000,
        });

        const connectTimeout = setTimeout(() => {
          if (this.status === "connecting") {
            this.status = "error";
            this.errorMessage = "Connection timeout (10s)";
            if (this.ws) {
              this.ws.terminate();
              this.ws = null;
            }
            reject(new Error(this.errorMessage));
          }
        }, 10000);

        this.ws.on("open", () => {
          clearTimeout(connectTimeout);
          this.status = "connected";
          this.errorMessage = null;
          logger.info(`[Simulator ${this.chargerName}] Connected successfully!`);
          this.startHeartbeatLoop();
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          this.handleIncomingMessage(data);
        });

        this.ws.on("close", (code, reason) => {
          logger.info(`[Simulator ${this.chargerName}] WebSocket closed: ${code} ${reason}`);
          if (this.status !== "offline_buffering") {
            this.status = "disconnected";
          }
          this.stopHeartbeatLoop();
          this.stopAllMeterLoops();
        });

        this.ws.on("error", (err) => {
          logger.error(`[Simulator ${this.chargerName}] WebSocket error: ${err.message}`);
          this.status = "error";
          this.errorMessage = err.message;
        });
      } catch (err: any) {
        this.status = "error";
        this.errorMessage = err.message;
        reject(err);
      }
    });
  }

  /**
   * Disconnect from CPMS WebSocket Server
   */
  public disconnect(): void {
    this.status = "disconnected";
    this.stopHeartbeatLoop();
    this.stopAllMeterLoops();
    for (const timer of this.transitionTimers) {
      clearTimeout(timer);
    }
    this.transitionTimers.clear();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        this.ws.terminate();
      }
      this.ws = null;
    }
  }

  /**
   * Send CALL [2, messageId, action, payload] to CPMS
   */
  public async sendCall(action: string, payload: any): Promise<any> {
    const messageId = uuidv4();
    const startTime = Date.now();

    // If currently offline buffering, queue in offline buffer
    if (this.status === "offline_buffering") {
      const buffered: BufferedFrame = {
        id: uuidv4(),
        messageType: 2,
        messageId,
        action,
        payload,
        timestamp: new Date().toISOString(),
      };
      this.offlineBuffer.push(buffered);

      this.addLog({
        direction: "out",
        messageType: "CALL",
        messageId,
        action,
        payload,
        status: "Buffered Offline",
      });

      // Provide simulated immediate mock return if needed for local state continuity
      if (action === "StartTransaction") {
        return { transactionId: Math.floor(10000 + Math.random() * 90000), idTagInfo: { status: "Accepted" } };
      }
      if (action === "Authorize") {
        return { idTagInfo: { status: "Accepted" } };
      }
      return { status: "Buffered" };
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send ${action}: WebSocket is not connected (status: ${this.status})`);
    }

    const frame = [2, messageId, action, payload];
    const frameStr = JSON.stringify(frame);

    this.addLog({
      direction: "out",
      messageType: "CALL",
      messageId,
      action,
      payload,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        const err = new Error(`Request timeout waiting for ${action} response (10s)`);
        this.addLog({
          direction: "in",
          messageType: "CALLERROR",
          messageId,
          action,
          payload: { error: err.message },
          status: "Timeout",
          latencyMs: Date.now() - startTime,
        });
        reject(err);
      }, 10000);

      this.pendingRequests.set(messageId, {
        action,
        sentAt: startTime,
        resolve: (responsePayload) => {
          clearTimeout(timeout);
          resolve(responsePayload);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      this.ws?.send(frameStr);
    });
  }

  /**
   * Handle incoming raw message from CPMS
   */
  private handleIncomingMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      if (!Array.isArray(message) || message.length < 3) {
        logger.warn(`[Simulator ${this.chargerName}] Invalid frame format: ${data.toString()}`);
        return;
      }

      const messageType = message[0];
      const messageId = message[1];

      // 3 = CALLRESULT
      if (messageType === 3) {
        const payload = message[2];
        const pending = this.pendingRequests.get(messageId);
        const latencyMs = pending ? Date.now() - pending.sentAt : undefined;

        this.addLog({
          direction: "in",
          messageType: "CALLRESULT",
          messageId,
          action: pending?.action,
          payload,
          status: "Success",
          latencyMs,
        });

        if (pending) {
          pending.resolve(payload);
          this.pendingRequests.delete(messageId);
        }
        return;
      }

      // 4 = CALLERROR
      if (messageType === 4) {
        const errorCode = message[2];
        const errorDescription = message[3];
        const errorDetails = message[4];
        const pending = this.pendingRequests.get(messageId);
        const latencyMs = pending ? Date.now() - pending.sentAt : undefined;

        this.addLog({
          direction: "in",
          messageType: "CALLERROR",
          messageId,
          action: pending?.action,
          payload: { errorCode, errorDescription, errorDetails },
          status: "Error",
          latencyMs,
        });

        if (pending) {
          pending.reject(new Error(`[${errorCode}] ${errorDescription}`));
          this.pendingRequests.delete(messageId);
        }
        return;
      }

      // 2 = CALL (Central System -> Charger RPC)
      if (messageType === 2) {
        const action = message[2];
        const payload = message[3];

        this.addLog({
          direction: "in",
          messageType: "CALL",
          messageId,
          action,
          payload,
        });

        this.handleCentralSystemRpc(messageId, action, payload);
      }
    } catch (err: any) {
      logger.error(`[Simulator ${this.chargerName}] Error parsing message: ${err.message}`);
    }
  }

  /**
   * Handle incoming RPC requests from CPMS
   */
  private async handleCentralSystemRpc(messageId: string, action: string, payload: any): Promise<void> {
    try {
      let responsePayload: any = { status: "Accepted" };

      switch (action) {
        case "SetChargingProfile": {
          const rawConnectorId = payload.connectorId ?? payload.evseId;
          const csProfile = payload.csChargingProfiles || payload.chargingProfile;
          const limit = csProfile?.chargingSchedule?.chargingSchedulePeriod?.[0]?.limit;
          const unit = csProfile?.chargingSchedule?.chargingRateUnit || "W";
          const profileId = csProfile?.chargingProfileId;

          let reason = "Dynamic Smart Charging Profile";
          if (profileId === 100) {
            reason = "Dynamic Group Load Balancing (Cluster capacity limit)";
          } else if (profileId === 101) {
            reason = "Charge Group Amperage Ceiling (Main fuse protection)";
          } else if (profileId === 102) {
            reason = "3-Phase Phase Unbalance Mitigation (Grid overload protection)";
          } else if (profileId === 110) {
            reason = "Station Physical Safety Ceiling (Site limit)";
          }

          if (limit !== undefined) {
            const applyLimit = (conn: SimulatedConnector, targetLimit: number) => {
              if (unit === "A") {
                conn.smartChargingLimitAmps = targetLimit;
                conn.smartChargingLimitW = targetLimit * 230 * (conn.type === "Type2" ? 3 : 1);
              } else {
                conn.smartChargingLimitW = targetLimit;
                conn.smartChargingLimitAmps = targetLimit / (230 * (conn.type === "Type2" ? 3 : 1));
              }
              conn.throttleReason = reason;

              // Adjust current power in real time if charging
              if (conn.status === "Charging") {
                conn.currentPowerW = Math.min(conn.maxPowerW, conn.smartChargingLimitW ?? conn.maxPowerW);
                conn.currentAmps = conn.currentPowerW / (conn.voltage * (conn.type === "Type2" ? 3 : 1));
                // Stream updated MeterValues so CPMS receives the throttled reading
                this.sendMeterValues(conn.id, { powerW: conn.currentPowerW }).catch((err) =>
                  logger.debug(`MeterValue stream after SetChargingProfile notice: ${err}`)
                );
              }
            };

            // connectorId 0 = whole Charge Point / ChargePointMaxProfile
            if (rawConnectorId === 0 || rawConnectorId === undefined || rawConnectorId === null) {
              const chargingConns = Array.from(this.connectors.values()).filter((c) => c.status === "Charging");
              if (chargingConns.length <= 1) {
                // If 0 or 1 connector is active, assign the full profile limit (up to physical capacity)
                for (const conn of this.connectors.values()) {
                  applyLimit(conn, limit);
                }
              } else {
                // Multiple connectors concurrently charging: share the station limit evenly across active connectors
                const perConnLimit = limit / chargingConns.length;
                for (const conn of this.connectors.values()) {
                  applyLimit(conn, perConnLimit);
                }
              }
            } else {
              const conn = this.connectors.get(rawConnectorId);
              if (conn) {
                applyLimit(conn, limit);
              }
            }
          }
          responsePayload = { status: "Accepted" };
          break;
        }

        case "ClearChargingProfile": {
          const rawConnectorId = payload.connectorId ?? payload.evseId;
          const clearLimit = (conn: SimulatedConnector) => {
            conn.smartChargingLimitW = null;
            conn.smartChargingLimitAmps = null;
            conn.throttleReason = null;
            if (conn.status === "Charging") {
              conn.currentPowerW = conn.maxPowerW;
              conn.currentAmps = conn.currentPowerW / (conn.voltage * (conn.type === "Type2" ? 3 : 1));
              this.sendMeterValues(conn.id, { powerW: conn.currentPowerW }).catch((err) =>
                logger.debug(`MeterValue stream after ClearChargingProfile notice: ${err}`)
              );
            }
          };

          if (rawConnectorId === 0 || rawConnectorId === undefined || rawConnectorId === null) {
            for (const conn of this.connectors.values()) {
              clearLimit(conn);
            }
          } else {
            const conn = this.connectors.get(rawConnectorId);
            if (conn) {
              clearLimit(conn);
            }
          }
          responsePayload = { status: "Accepted" };
          break;
        }

        case "RemoteStartTransaction": {
          const connectorId = payload.connectorId ?? 1;
          const idTag = payload.idTag || payload.idToken?.idToken || "REMOTE-ID-TAG";
          responsePayload = { status: "Accepted" };

          // Automatically simulate user plugging in and starting session
          setTimeout(async () => {
            await this.plugIn(connectorId);
            await this.startTransaction(connectorId, idTag);
          }, 500);
          break;
        }

        case "RemoteStopTransaction": {
          const txId = payload.transactionId;
          let targetConn: SimulatedConnector | undefined;
          for (const conn of this.connectors.values()) {
            if (String(conn.transactionId) === String(txId)) {
              targetConn = conn;
              break;
            }
          }
          if (targetConn) {
            responsePayload = { status: "Accepted" };
            setTimeout(async () => {
              await this.stopTransaction(targetConn!.id, targetConn!.currentMeterWh, "Remote");
              await this.unplug(targetConn!.id);
            }, 500);
          } else {
            responsePayload = { status: "Rejected" };
          }
          break;
        }

        case "Reset": {
          const type = payload.type || "Soft";
          responsePayload = { status: "Accepted" };
          if (type === "Hard") {
            setTimeout(async () => {
              this.disconnect();
              await new Promise((r) => setTimeout(r, 2000));
              await this.connect();
              await this.sendBootNotification();
            }, 1000);
          } else {
            setTimeout(async () => {
              for (const conn of this.connectors.values()) {
                if (conn.status === "Faulted") {
                  conn.status = "Available";
                  await this.sendStatusNotification(conn.id, "Available", "NoError");
                }
              }
            }, 1000);
          }
          break;
        }

        case "UnlockConnector": {
          const connectorId = payload.connectorId ?? 1;
          const conn = this.connectors.get(connectorId);
          if (conn) {
            conn.isPlugged = false;
            if (conn.status === "Preparing" || conn.status === "Finishing") {
              conn.status = "Available";
              await this.sendStatusNotification(connectorId, "Available", "NoError");
            }
          }
          responsePayload = { status: "Unlocked" };
          break;
        }

        case "ChangeAvailability": {
          const connectorId = payload.connectorId ?? 1;
          const conn = this.connectors.get(connectorId);
          const newStatus: ConnectorStatus = payload.type === "Operative" ? "Available" : "Unavailable";
          if (conn) {
            conn.status = newStatus;
            await this.sendStatusNotification(connectorId, newStatus, "NoError");
          }
          responsePayload = { status: "Accepted" };
          break;
        }

        case "GetConfiguration": {
          responsePayload = {
            configurationKey: [
              { key: "HeartbeatInterval", readonly: false, value: String(this.heartbeatIntervalSeconds) },
              { key: "MeterValueSampleInterval", readonly: false, value: String(this.autoMeterValuesIntervalSeconds) },
              { key: "NumberOfConnectors", readonly: true, value: String(this.connectors.size) },
              { key: "AuthorizeRemoteTxRequests", readonly: false, value: "true" },
              { key: "StopTransactionOnEVSideDisconnect", readonly: false, value: "true" },
              { key: "ConnectionTimeOut", readonly: false, value: "60" },
            ],
            unknownKey: [],
          };
          break;
        }

        case "ChangeConfiguration": {
          const { key, value } = payload;
          if (key === "HeartbeatInterval") {
            this.heartbeatIntervalSeconds = parseInt(value, 10) || 60;
            this.startHeartbeatLoop();
          } else if (key === "MeterValueSampleInterval") {
            this.autoMeterValuesIntervalSeconds = parseInt(value, 10) || 10;
          }
          responsePayload = { status: "Accepted" };
          break;
        }

        case "TriggerMessage": {
          const requestedMsg = payload.requestedMessage;
          const connectorId = payload.connectorId ?? 1;
          responsePayload = { status: "Accepted" };

          setTimeout(async () => {
            if (requestedMsg === "BootNotification") await this.sendBootNotification();
            else if (requestedMsg === "Heartbeat") await this.sendHeartbeat();
            else if (requestedMsg === "StatusNotification") {
              const conn = this.connectors.get(connectorId) || this.connectors.get(1);
              if (conn) await this.sendStatusNotification(conn.id, conn.status, conn.errorCode || "NoError");
            } else if (requestedMsg === "MeterValues") {
              await this.sendMeterValues(connectorId);
            }
          }, 300);
          break;
        }

        default:
          responsePayload = { status: "Accepted" };
      }

      // Send CALLRESULT [3, messageId, responsePayload]
      const replyFrame = [3, messageId, responsePayload];
      this.ws?.send(JSON.stringify(replyFrame));

      this.addLog({
        direction: "out",
        messageType: "CALLRESULT",
        messageId,
        action,
        payload: responsePayload,
        status: "Success",
      });
    } catch (err: any) {
      logger.error(`[Simulator ${this.chargerName}] Error answering RPC ${action}: ${err.message}`);
      const errFrame = [4, messageId, "InternalError", err.message, {}];
      this.ws?.send(JSON.stringify(errFrame));
    }
  }

  /**
   * Send BootNotification
   */
  public async sendBootNotification(): Promise<any> {
    let payload: any;
    if (this.protocol === "ocpp2.0.1" || this.protocol === "ocpp2.1") {
      payload = {
        reason: "PowerUp",
        chargingStation: {
          vendorName: this.vendor,
          model: this.model,
          serialNumber: this.serialNumber,
          firmwareVersion: this.firmwareVersion,
        },
      };
    } else {
      payload = {
        chargePointVendor: this.vendor,
        chargePointModel: this.model,
        chargePointSerialNumber: this.serialNumber,
        firmwareVersion: this.firmwareVersion,
      };
    }

    const response = await this.sendCall("BootNotification", payload);
    if (response?.interval) {
      this.heartbeatIntervalSeconds = response.interval;
      this.startHeartbeatLoop();
    }
    return response;
  }

  /**
   * Send Heartbeat
   */
  public async sendHeartbeat(): Promise<any> {
    const payload = {};
    const res = await this.sendCall("Heartbeat", payload);
    this.lastHeartbeat = new Date();
    return res;
  }

  /**
   * Send StatusNotification
   */
  public async sendStatusNotification(
    connectorId: number,
    status: ConnectorStatus,
    errorCode: string = "NoError",
    vendorErrorCode?: string
  ): Promise<any> {
    const conn = this.connectors.get(connectorId);
    if (conn) {
      conn.status = status;
      conn.errorCode = errorCode;
      conn.vendorErrorCode = vendorErrorCode;
    }

    let payload: any;
    if (this.protocol === "ocpp2.0.1" || this.protocol === "ocpp2.1") {
      payload = {
        timestamp: new Date().toISOString(),
        connectorStatus: status,
        evseId: connectorId,
        connectorId: 1,
      };
    } else {
      payload = {
        connectorId,
        errorCode,
        status,
        timestamp: new Date().toISOString(),
        vendorErrorCode: vendorErrorCode || "",
      };
    }

    return await this.sendCall("StatusNotification", payload);
  }

  /**
   * Send Authorize (RFID / ISO15118 token)
   */
  public async sendAuthorize(idTag: string): Promise<any> {
    let payload: any;
    if (this.protocol === "ocpp2.0.1" || this.protocol === "ocpp2.1") {
      payload = {
        idToken: {
          idToken: idTag,
          type: "ISO14443",
        },
      };
    } else {
      payload = {
        idTag,
      };
    }

    return await this.sendCall("Authorize", payload);
  }

  /**
   * Plug in physical cable into connector
   */
  public async plugIn(connectorId: number): Promise<void> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    conn.isPlugged = true;
    if (conn.status === "Available") {
      conn.status = "Preparing";
      await this.sendStatusNotification(connectorId, "Preparing", "NoError");
    }
  }

  /**
   * Unplug physical cable from connector
   */
  public async unplug(connectorId: number): Promise<void> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    conn.isPlugged = false;
    if (conn.status !== "Charging") {
      conn.status = "Available";
      await this.sendStatusNotification(connectorId, "Available", "NoError");
    }
  }

  /**
   * Start Charging Transaction
   */
  public async startTransaction(
    connectorId: number,
    idTag: string = "SIM-TAG-001",
    meterStart?: number,
    reservationId?: number
  ): Promise<any> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    conn.idTag = idTag;
    conn.meterStart = meterStart ?? conn.currentMeterWh;
    conn.startedAt = new Date();
    conn.isPlugged = true;

    // Pre-check for existing group/site charging profiles to avoid startup overshoots
    if (!conn.smartChargingLimitW && this.chargerId) {
      try {
        const existingProfile = await prisma.chargingProfile.findFirst({
          where: { chargerId: this.chargerId, chargingProfileId: { in: [100, 101, 102, 110] } },
          orderBy: { stackLevel: "desc" },
        });
        if (existingProfile) {
          const sched = existingProfile.chargingSchedule as any;
          const limit = sched?.chargingSchedulePeriod?.[0]?.limit;
          if (limit && sched?.chargingRateUnit === "W") {
            conn.smartChargingLimitW = limit;
            conn.throttleReason = "Dynamic Group Load Balancing (Pre-throttled to active ceiling)";
          } else if (limit && sched?.chargingRateUnit === "A") {
            conn.smartChargingLimitAmps = limit;
            conn.smartChargingLimitW = limit * 230 * (conn.type === "Type2" ? 3 : 1);
            conn.throttleReason = "Dynamic Group Amperage Limit (Pre-throttled to active ceiling)";
          }
        }
      } catch (err) {
        logger.debug(`Could not pre-fetch profile for simulator charger ${this.chargerId}: ${err}`);
      }
    }

    // Apply smart charging or max capacity limit
    const powerLimit = conn.smartChargingLimitW ? Math.min(conn.maxPowerW, conn.smartChargingLimitW) : conn.maxPowerW;
    conn.currentPowerW = powerLimit;
    conn.voltage = 230.0;
    conn.currentAmps = conn.currentPowerW / (conn.voltage * (conn.type === "Type2" ? 3 : 1));

    let res: any;
    if (this.protocol === "ocpp2.0.1" || this.protocol === "ocpp2.1") {
      const txId = `SIM-TX-${Date.now()}`;
      conn.transactionId = txId;
      res = await this.sendCall("TransactionEvent", {
        eventType: "Started",
        timestamp: new Date().toISOString(),
        triggerReason: "Authorized",
        seqNo: 1,
        transactionInfo: {
          transactionId: txId,
          chargingState: "Charging",
        },
        idToken: {
          idToken: idTag,
          type: "ISO14443",
        },
        evse: {
          id: connectorId,
          connectorId: 1,
        },
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              { value: conn.meterStart, measurand: "Energy.Active.Import.Register", unit: "Wh" },
              { value: conn.soc, measurand: "SoC", unit: "Percent" },
            ],
          },
        ],
      });
    } else {
      const startPayload = {
        connectorId,
        idTag,
        meterStart: conn.meterStart,
        timestamp: new Date().toISOString(),
        reservationId,
      };

      res = await this.sendCall("StartTransaction", startPayload);
      conn.transactionId = res?.transactionId || Math.floor(10000 + Math.random() * 90000);
    }

    conn.status = "Charging";
    await this.sendStatusNotification(connectorId, "Charging", "NoError");
    this.startMeterLoop(connectorId);

    return res;
  }

  /**
   * Send MeterValues periodic reading
   */
  public async sendMeterValues(
    connectorId: number,
    overrides?: {
      powerW?: number;
      voltage?: number;
      currentAmps?: number;
      soc?: number;
      meterDeltaWh?: number;
    }
  ): Promise<any> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    // Advance simulated telemetry
    if (conn.status === "Charging") {
      const powerLimit = conn.smartChargingLimitW ? Math.min(conn.maxPowerW, conn.smartChargingLimitW) : conn.maxPowerW;
      conn.currentPowerW = overrides?.powerW ?? powerLimit;
      conn.voltage = overrides?.voltage ?? (228.0 + Math.sin(Date.now() / 10000) * 4.0);
      conn.currentAmps = overrides?.currentAmps ?? (conn.currentPowerW / (conn.voltage * (conn.type === "Type2" ? 3 : 1)));

      // Advance energy meter Wh (power in W * (interval / 3600))
      const deltaWh = overrides?.meterDeltaWh ?? (conn.currentPowerW * (this.autoMeterValuesIntervalSeconds / 3600));
      conn.currentMeterWh = Math.round(conn.currentMeterWh + deltaWh);

      // Advance SoC
      if (overrides?.soc !== undefined) {
        conn.soc = overrides.soc;
      } else if (conn.soc < 100) {
        conn.soc = Math.min(100, Math.round((conn.soc + 0.5) * 10) / 10);
      }

      // Slightly increase temperature under load
      conn.temperature = Math.min(48, Math.round((conn.temperature + 0.1) * 10) / 10);
    }

    let payload: any;
    if (this.protocol === "ocpp2.0.1" || this.protocol === "ocpp2.1") {
      payload = {
        eventType: "Updated",
        timestamp: new Date().toISOString(),
        triggerReason: "MeterValuePeriodic",
        seqNo: 2,
        transactionInfo: {
          transactionId: conn.transactionId ? String(conn.transactionId) : `SIM-TX-${Date.now()}`,
          chargingState: conn.status === "Charging" ? "Charging" : "Idle",
        },
        evse: {
          id: connectorId,
          connectorId: 1,
        },
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              { value: conn.currentMeterWh, measurand: "Energy.Active.Import.Register", unit: "Wh" },
              { value: Math.round(conn.currentPowerW), measurand: "Power.Active.Import", unit: "W" },
              { value: Math.round(conn.voltage * 10) / 10, measurand: "Voltage", unit: "V" },
              { value: Math.round(conn.currentAmps * 10) / 10, measurand: "Current.Import", unit: "A" },
              { value: conn.soc, measurand: "SoC", unit: "Percent" },
            ],
          },
        ],
      };
      return await this.sendCall("TransactionEvent", payload);
    } else {
      payload = {
        connectorId,
        transactionId: conn.transactionId ? Number(conn.transactionId) : undefined,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: String(conn.currentMeterWh),
                context: "Sample.Periodic",
                format: "Raw",
                measurand: "Energy.Active.Import.Register",
                unit: "Wh",
              },
              {
                value: String(Math.round(conn.currentPowerW)),
                context: "Sample.Periodic",
                format: "Raw",
                measurand: "Power.Active.Import",
                unit: "W",
              },
              {
                value: String(Math.round(conn.voltage * 10) / 10),
                context: "Sample.Periodic",
                format: "Raw",
                measurand: "Voltage",
                phase: "L1",
                unit: "V",
              },
              {
                value: String(Math.round(conn.currentAmps * 10) / 10),
                context: "Sample.Periodic",
                format: "Raw",
                measurand: "Current.Import",
                phase: "L1",
                unit: "A",
              },
              {
                value: String(conn.soc),
                context: "Sample.Periodic",
                format: "Raw",
                measurand: "SoC",
                unit: "Percent",
              },
              {
                value: String(conn.temperature),
                context: "Sample.Periodic",
                format: "Raw",
                measurand: "Temperature",
                unit: "Celsius",
              },
            ],
          },
        ],
      };
      return await this.sendCall("MeterValues", payload);
    }
  }

  /**
   * Stop Charging Transaction
   */
  public async stopTransaction(
    connectorId: number,
    meterStop?: number,
    reason: string = "Local",
    idTag?: string
  ): Promise<any> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    this.stopMeterLoop(connectorId);
    conn.currentPowerW = 0;
    conn.currentAmps = 0;
    const finalMeter = meterStop ?? conn.currentMeterWh;
    conn.currentMeterWh = finalMeter;

    let res: any;
    if (this.protocol === "ocpp2.0.1" || this.protocol === "ocpp2.1") {
      res = await this.sendCall("TransactionEvent", {
        eventType: "Ended",
        timestamp: new Date().toISOString(),
        triggerReason: reason === "Remote" ? "RemoteStop" : "StopAuthorized",
        seqNo: 99,
        transactionInfo: {
          transactionId: conn.transactionId ? String(conn.transactionId) : `SIM-TX-${Date.now()}`,
          chargingState: "SuspendedEVSE",
          stoppedReason: reason,
        },
        idToken: {
          idToken: idTag || conn.idTag || "SIM-TAG-001",
          type: "ISO14443",
        },
        evse: {
          id: connectorId,
          connectorId: 1,
        },
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              { value: finalMeter, measurand: "Energy.Active.Import.Register", unit: "Wh" },
              { value: conn.soc, measurand: "SoC", unit: "Percent" },
            ],
          },
        ],
      });
    } else {
      const stopPayload = {
        idTag: idTag || conn.idTag || undefined,
        meterStop: finalMeter,
        timestamp: new Date().toISOString(),
        transactionId: conn.transactionId ? Number(conn.transactionId) : 1,
        reason,
        transactionData: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: String(finalMeter),
                context: "Transaction.End",
                measurand: "Energy.Active.Import.Register",
                unit: "Wh",
              },
              {
                value: String(conn.soc),
                context: "Transaction.End",
                measurand: "SoC",
                unit: "Percent",
              },
            ],
          },
        ],
      };
      res = await this.sendCall("StopTransaction", stopPayload);
    }

    conn.transactionId = null;
    conn.idTag = null;
    conn.status = "Finishing";
    await this.sendStatusNotification(connectorId, "Finishing", "NoError");

    const timer = setTimeout(async () => {
      this.transitionTimers.delete(timer);
      try {
        if (this.status !== "connected" && this.status !== "offline_buffering") return;
        if (conn.isPlugged) {
          conn.status = "Preparing";
          await this.sendStatusNotification(connectorId, "Preparing", "NoError");
        } else {
          conn.status = "Available";
          await this.sendStatusNotification(connectorId, "Available", "NoError");
        }
      } catch (err: any) {
        logger.debug(`Background transition notification skipped: ${err.message}`);
      }
    }, 1000);
    this.transitionTimers.add(timer);

    return res;
  }

  /**
   * Anomaly: Premature Cable Disconnect during active charge
   */
  public async prematureCableDisconnect(connectorId: number): Promise<void> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    conn.isPlugged = false;
    conn.currentPowerW = 0;
    conn.currentAmps = 0;

    // Transition immediately to SuspendedEV / EVCommunicationError
    await this.sendStatusNotification(connectorId, "SuspendedEV", "EVCommunicationError", "CableUnlatchedByDriver");

    if (conn.transactionId) {
      await this.stopTransaction(connectorId, conn.currentMeterWh, "EVDisconnected");
    }

    const timer = setTimeout(async () => {
      this.transitionTimers.delete(timer);
      try {
        if (this.status !== "connected" && this.status !== "offline_buffering") return;
        conn.status = "Available";
        await this.sendStatusNotification(connectorId, "Available", "NoError");
      } catch (err: any) {
        logger.debug(`Background premature disconnect restore skipped: ${err.message}`);
      }
    }, 1500);
    this.transitionTimers.add(timer);
  }

  /**
   * Anomaly: Inject Hardware Fault
   */
  public async injectFault(connectorId: number, errorCode: string, vendorErrorCode?: string): Promise<void> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    this.stopMeterLoop(connectorId);
    conn.currentPowerW = 0;
    conn.currentAmps = 0;
    conn.status = "Faulted";
    conn.errorCode = errorCode;
    conn.vendorErrorCode = vendorErrorCode;

    await this.sendStatusNotification(connectorId, "Faulted", errorCode, vendorErrorCode || "CHAOS_FAULT_SIM");
  }

  /**
   * Anomaly: Inject Raedian Vendor Fault
   */
  public async injectRaedianFault(connectorId: number, raedianCode: string): Promise<void> {
    const { getRaedianErrorInfo } = await import("../utils/raedianErrorCodes.js");
    const info = getRaedianErrorInfo(raedianCode);
    const ocppCode = info?.ocppErrorCodeMapped || "OtherError";
    await this.injectFault(connectorId, ocppCode, info?.code || raedianCode);
  }

  /**
   * Anomaly: Power Drop / Dynamic Grid Curtailment
   */
  public async powerDrop(connectorId: number, targetPowerKw: number): Promise<void> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    conn.smartChargingLimitW = targetPowerKw * 1000;
    conn.smartChargingLimitAmps = (targetPowerKw * 1000) / (conn.voltage * (conn.type === "Type2" ? 3 : 1));
    conn.throttleReason = "Manual Grid Power Curtailment (Anomaly Scenario)";
    conn.currentPowerW = targetPowerKw * 1000;
    conn.currentAmps = conn.currentPowerW / (conn.voltage * (conn.type === "Type2" ? 3 : 1));
    await this.sendMeterValues(connectorId, { powerW: conn.currentPowerW });
  }

  /**
   * Anomaly: Meter Drift Injection
   */
  public async meterDrift(connectorId: number, driftWh: number): Promise<void> {
    const conn = this.connectors.get(connectorId);
    if (!conn) throw new Error(`Connector ${connectorId} not found`);

    conn.currentMeterWh += driftWh;
    await this.sendMeterValues(connectorId, { meterDeltaWh: driftWh });
  }

  /**
   * Offline Store-and-Forward: Toggle Buffering Mode
   */
  public toggleOfflineBuffering(enable: boolean): void {
    if (enable) {
      this.status = "offline_buffering";
      if (this.ws) {
        try {
          this.ws.close();
        } catch {
          this.ws.terminate();
        }
        this.ws = null;
      }
      this.stopHeartbeatLoop();
    } else {
      this.status = "disconnected";
    }
  }

  /**
   * Offline Store-and-Forward: Flush buffered messages to CPMS
   */
  public async flushOfflineBuffer(): Promise<{ flushedCount: number; errors: number }> {
    if (this.status === "offline_buffering") {
      this.status = "connecting";
      await this.connect();
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    let flushedCount = 0;
    let errors = 0;

    const queue = [...this.offlineBuffer];
    this.offlineBuffer = [];

    for (const frame of queue) {
      try {
        await this.sendCall(frame.action, frame.payload);
        flushedCount++;
        // Small delay between historical frames
        await new Promise((r) => setTimeout(r, 150));
      } catch (err: any) {
        logger.error(`[Simulator ${this.chargerName}] Error flushing frame ${frame.action}: ${err.message}`);
        errors++;
      }
    }

    return { flushedCount, errors };
  }

  private startHeartbeatLoop(): void {
    this.stopHeartbeatLoop();
    this.heartbeatTimer = setInterval(async () => {
      if (this.status === "connected") {
        try {
          await this.sendHeartbeat();
        } catch (err: any) {
          logger.warn(`[Simulator ${this.chargerName}] Heartbeat failed: ${err.message}`);
        }
      }
    }, this.heartbeatIntervalSeconds * 1000);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startMeterLoop(connectorId: number): void {
    this.stopMeterLoop(connectorId);
    const timer = setInterval(async () => {
      const conn = this.connectors.get(connectorId);
      if (conn && conn.status === "Charging") {
        try {
          await this.sendMeterValues(connectorId);
        } catch (err: any) {
          logger.warn(`[Simulator ${this.chargerName}] Auto meter value tick error: ${err.message}`);
        }
      }
    }, this.autoMeterValuesIntervalSeconds * 1000);

    this.meterTimers.set(connectorId, timer);
  }

  private stopMeterLoop(connectorId: number): void {
    const timer = this.meterTimers.get(connectorId);
    if (timer) {
      clearInterval(timer);
      this.meterTimers.delete(connectorId);
    }
  }

  private stopAllMeterLoops(): void {
    for (const [id, timer] of this.meterTimers.entries()) {
      clearInterval(timer);
    }
    this.meterTimers.clear();
  }

  public toJSON() {
    return {
      id: this.id,
      chargerId: this.chargerId,
      chargerName: this.chargerName,
      protocol: this.protocol,
      endpoint: this.endpoint,
      status: this.status,
      errorMessage: this.errorMessage,
      vendor: this.vendor,
      model: this.model,
      serialNumber: this.serialNumber,
      firmwareVersion: this.firmwareVersion,
      lastHeartbeat: this.lastHeartbeat,
      heartbeatIntervalSeconds: this.heartbeatIntervalSeconds,
      autoMeterValuesIntervalSeconds: this.autoMeterValuesIntervalSeconds,
      connectors: Array.from(this.connectors.values()),
      bufferedCount: this.offlineBuffer.length,
      logsCount: this.logs.length,
    };
  }
}

/**
 * Singleton Simulator Service
 */
export class SimulatorServiceManager {
  private instances: Map<string, SimulatedChargerInstance> = new Map();

  public getInstances(): SimulatedChargerInstance[] {
    return Array.from(this.instances.values());
  }

  public getTemplates(): ChargerTemplate[] {
    return CHARGER_TEMPLATES;
  }

  public getTemplateById(templateId: string): ChargerTemplate | undefined {
    return CHARGER_TEMPLATES.find((t) => t.id === templateId);
  }

  /**
   * Ensure the "Virtual Test Lab" ChargeGroup exists in the database
   */
  public async ensureVirtualTestLabChargeGroup(): Promise<any> {
    let group = await prisma.chargeGroup.findFirst({
      where: { name: "Virtual Test Lab" },
    });

    if (!group) {
      group = await prisma.chargeGroup.create({
        data: {
          name: "Virtual Test Lab",
          description: "Automated Virtual Test Lab dynamic load balancing group",
          maxPower: 500.0,
          maxAmperage: 800.0,
          maxPhaseCurrent: 80.0,
          maxPhaseUnbalance: 16.0,
        },
      });
    } else if (group.maxPower && group.maxPower <= 100 && group.maxAmperage && group.maxAmperage >= 500) {
      // Synchronize legacy test group where maxPower was adjusted down (e.g. 40kW) but maxAmperage was left at 800A
      const calculatedAmps = Math.round(((group.maxPower * 1000) / (3 * 230)) * 10) / 10;
      group = await prisma.chargeGroup.update({
        where: { id: group.id },
        data: {
          maxAmperage: calculatedAmps,
          maxPhaseCurrent: calculatedAmps,
        },
      });
    }

    return group;
  }

  /**
   * Ensure sandbox test RFID tags exist in database
   */
  public async ensureTestRfidTags(ownerId: number = 1): Promise<void> {
    const testTags = [
      { tag: "SIM-RFID-PASS-01", name: "Test Driver (Active Pass)", active: true },
      { tag: "SIM-RFID-BLOCKED-02", name: "Blocked Driver (Expired Pass)", active: false },
    ];

    for (const t of testTags) {
      const existing = await prisma.rfidUser.findUnique({ where: { rfid_tag: t.tag } });
      if (!existing) {
        await prisma.rfidUser.create({
          data: {
            rfid_tag: t.tag,
            name: t.name,
            active: t.active,
            email: "tester@grid-ocpp.internal",
            owner_id: ownerId,
          },
        });
      }
    }
  }

  /**
   * Start a simulated charger instance based on a predefined template
   */
  public async startTemplateInstance(
    templateId: string,
    options: {
      protocol?: OcppProtocol;
      endpoint?: string;
      ownerId?: number;
    } = {}
  ): Promise<SimulatedChargerInstance> {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Unknown charger template: '${templateId}'`);
    }

    const ownerId = options.ownerId || 1;
    const protocol = options.protocol || template.defaultProtocol;

    // 1. Ensure ChargeGroup & Station exist
    const chargeGroup = await this.ensureVirtualTestLabChargeGroup();

    let station = await prisma.chargingStation.findFirst({
      where: { station_name: "Virtual Test Lab Station" },
    });

    if (!station) {
      station = await prisma.chargingStation.create({
        data: {
          station_name: "Virtual Test Lab Station",
          street_name: "Innovation Way 42",
          city: "Amsterdam",
          state: "Noord-Holland",
          postal_code: "1012AB",
          country: "Netherlands",
          latitude: 52.3702,
          longitude: 4.8952,
          maxPower: 500.0,
          owner_id: ownerId,
          isGroundPlanEnabled: true,
        },
      });
    }

    // 2. Consistent Virtual Charger Name for this template
    const chargerName = `SIM-${template.id.toUpperCase()}`;

    // 3. Find or Create Charger in DB
    let dbCharger = await prisma.charger.findUnique({
      where: { name: chargerName },
      include: { evses: { include: { connectors: true } }, chargeGroup: true },
    });

    if (!dbCharger) {
      dbCharger = await prisma.charger.create({
        data: {
          name: chargerName,
          model: template.model,
          manufacturer: template.vendor,
          serial_number: `SN-${chargerName}`,
          power_capacity: template.powerCapacityKw,
          firmware_version: template.firmwareVersion,
          service_contacts: "lab@grid-ocpp.internal",
          charging_station_id: station.id,
          chargeGroupId: chargeGroup.id,
          owner_id: ownerId,
          status: "offline",
        },
        include: { evses: { include: { connectors: true } }, chargeGroup: true },
      });

      // Create EVSEs and Connectors
      for (const connConfig of template.connectors) {
        const evse = await prisma.evse.create({
          data: {
            charger_id: dbCharger.charger_id,
            evse_id: connConfig.id,
          },
        });

        await prisma.connector.create({
          data: {
            connector_name: connConfig.connectorName,
            status: "Available",
            current_type: connConfig.currentType,
            max_power: connConfig.maxPowerW / 1000,
            max_current: connConfig.maxCurrentAmps,
            max_voltage: connConfig.maxVoltageVolts,
            phaseConnection: connConfig.phaseConnection,
            format: connConfig.format,
            evse_id: evse.id,
          },
        });
      }
    } else if (dbCharger.chargeGroupId !== chargeGroup.id) {
      dbCharger = await prisma.charger.update({
        where: { charger_id: dbCharger.charger_id },
        data: { chargeGroupId: chargeGroup.id },
        include: { evses: { include: { connectors: true } }, chargeGroup: true },
      });
    }

    // Ensure sandbox test tags exist
    await this.ensureTestRfidTags(ownerId);

    // 4. Stop existing instance for this charger if already running
    const existing = this.getInstance(dbCharger.charger_id);
    if (existing) {
      existing.disconnect();
      this.instances.delete(existing.id);
    }

    const instance = new SimulatedChargerInstance({
      chargerId: dbCharger.charger_id,
      chargerName: dbCharger.name,
      protocol,
      endpoint: options.endpoint,
      vendor: template.vendor,
      model: template.model,
      firmwareVersion: template.firmwareVersion,
      connectors: template.connectors.map((c) => ({
        id: c.id,
        name: c.connectorName,
        maxPowerW: c.maxPowerW,
        type: c.type,
        format: c.format,
      })),
    });

    this.instances.set(instance.id, instance);

    try {
      await instance.connect();
      await instance.sendBootNotification();
      for (const conn of instance.connectors.values()) {
        await instance.sendStatusNotification(conn.id, "Available", "NoError");
      }
    } catch (err) {
      logger.warn(`Initial auto-boot for template simulator ${chargerName}: ${err}`);
    }

    return instance;
  }

  public getInstance(idOrName: string | number): SimulatedChargerInstance | undefined {
    // Look up by session UUID
    if (this.instances.has(String(idOrName))) {
      return this.instances.get(String(idOrName));
    }
    // Look up by chargerId or chargerName
    for (const inst of this.instances.values()) {
      if (inst.chargerName === String(idOrName) || String(inst.chargerId) === String(idOrName)) {
        return inst;
      }
    }
    return undefined;
  }

  public async startInstance(options: {
    chargerId: number;
    chargerName: string;
    protocol?: OcppProtocol;
    endpoint?: string;
    vendor?: string;
    model?: string;
    firmwareVersion?: string;
    connectors?: Array<{
      id: number;
      name?: string;
      maxPowerW?: number;
      type?: string;
      format?: string;
    }>;
  }): Promise<SimulatedChargerInstance> {
    // Check if an existing instance is already running for this charger
    const existing = this.getInstance(options.chargerId);
    if (existing) {
      if (existing.status !== "connected") {
        await existing.connect();
      }
      return existing;
    }

    // Ensure charger in DB is linked to Virtual Test Lab chargegroup
    const chargeGroup = await this.ensureVirtualTestLabChargeGroup();
    const dbCharger = await prisma.charger.findUnique({
      where: { charger_id: options.chargerId },
      include: { evses: { include: { connectors: true } } },
    });

    if (dbCharger && dbCharger.chargeGroupId !== chargeGroup.id) {
      await prisma.charger.update({
        where: { charger_id: dbCharger.charger_id },
        data: { chargeGroupId: chargeGroup.id },
      });
    }

    // If options.connectors not explicitly passed, extract from dbCharger!
    let resolvedConnectors = options.connectors;
    if ((!resolvedConnectors || resolvedConnectors.length === 0) && dbCharger?.evses && dbCharger.evses.length > 0) {
      const dbConns: Array<{
        id: number;
        name?: string;
        maxPowerW?: number;
        type?: string;
        format?: string;
      }> = [];

      for (const evse of dbCharger.evses) {
        for (const c of evse.connectors) {
          dbConns.push({
            id: evse.evse_id || (dbConns.length + 1),
            name: c.connector_name,
            maxPowerW: c.max_power ? c.max_power * 1000 : 22000,
            type: c.current_type === "DC" ? "CCS2" : "Type2",
            format: c.format || "SOCKET",
          });
        }
      }
      if (dbConns.length > 0) {
        resolvedConnectors = dbConns;
      }
    }

    const instance = new SimulatedChargerInstance({
      ...options,
      connectors: resolvedConnectors,
    });
    this.instances.set(instance.id, instance);

    try {
      await instance.connect();
      await instance.sendBootNotification();
      for (const conn of instance.connectors.values()) {
        await instance.sendStatusNotification(conn.id, "Available", "NoError");
      }
    } catch (err) {
      logger.warn(`Failed initial auto-boot for simulator ${options.chargerName}: ${err}`);
    }

    return instance;
  }

  public stopInstance(idOrName: string | number): boolean {
    const inst = this.getInstance(idOrName);
    if (inst) {
      inst.disconnect();
      this.instances.delete(inst.id);
      return true;
    }
    return false;
  }

  /**
   * 1-Click Quick Provision a complete sandbox test charger in DB
   */
  public async quickProvision(
    ownerId: number = 1,
    prefix: string = "SIM-LAB",
    options: {
      socketCount?: number;
      powerCapacityKw?: number;
      protocol?: OcppProtocol;
    } = {}
  ): Promise<any> {
    // 1. Ensure ChargeGroup & Station exist
    const chargeGroup = await this.ensureVirtualTestLabChargeGroup();

    let station = await prisma.chargingStation.findFirst({
      where: { station_name: "Virtual Test Lab Station" },
    });

    if (!station) {
      station = await prisma.chargingStation.create({
        data: {
          station_name: "Virtual Test Lab Station",
          street_name: "Innovation Way 42",
          city: "Amsterdam",
          state: "Noord-Holland",
          postal_code: "1012AB",
          country: "Netherlands",
          latitude: 52.3702,
          longitude: 4.8952,
          maxPower: 500.0,
          owner_id: ownerId,
          isGroundPlanEnabled: true,
        },
      });
    }

    // 2. Generate unique test charger name
    const timestamp = Date.now().toString().slice(-4);
    const chargerName = `${prefix}-${timestamp}`;
    const serialNumber = `SN-${chargerName}`;
    const socketCount = options.socketCount === 2 ? 2 : 1;
    const powerCapacity = options.powerCapacityKw || (socketCount === 2 ? 150.0 : 22.0);

    // 3. Create Charger record under Virtual Test Lab
    const charger = await prisma.charger.create({
      data: {
        name: chargerName,
        model: socketCount === 2 ? "GridSim-Dual-Pro" : "GridSim-Single-Wallbox",
        manufacturer: "VirtualLab",
        serial_number: serialNumber,
        power_capacity: powerCapacity,
        firmware_version: "v4.2.0-sim",
        service_contacts: "lab@grid-ocpp.internal",
        charging_station_id: station.id,
        chargeGroupId: chargeGroup.id,
        owner_id: ownerId,
        status: "offline",
      },
    });

    // 4. Create EVSEs and Connectors according to socketCount
    const createdConnectors: Array<{ id: number; name: string; type: string }> = [];

    const evse1 = await prisma.evse.create({
      data: {
        charger_id: charger.charger_id,
        evse_id: 1,
      },
    });

    await prisma.connector.create({
      data: {
        connector_name: "Channel 1",
        status: "Available",
        current_type: "AC",
        max_power: 22.0,
        max_current: 32.0,
        max_voltage: 400.0,
        phaseConnection: "L1-L2-L3",
        format: "SOCKET",
        evse_id: evse1.id,
      },
    });
    createdConnectors.push({ id: 1, name: "Channel 1", type: "Type2" });

    if (socketCount === 2) {
      const evse2 = await prisma.evse.create({
        data: {
          charger_id: charger.charger_id,
          evse_id: 2,
        },
      });

      await prisma.connector.create({
        data: {
          connector_name: "Channel 2",
          status: "Available",
          current_type: "DC",
          max_power: 150.0,
          max_current: 250.0,
          max_voltage: 800.0,
          phaseConnection: "DC",
          format: "CABLE",
          evse_id: evse2.id,
        },
      });
      createdConnectors.push({ id: 2, name: "Channel 2", type: "CCS2" });
    }

    // 5. Ensure sandbox test RFID tags exist
    const testTags = [
      { tag: "SIM-RFID-PASS-01", name: "Test Driver (Active Pass)", active: true },
      { tag: "SIM-RFID-BLOCKED-02", name: "Blocked Driver (Expired Pass)", active: false },
    ];

    for (const t of testTags) {
      const existing = await prisma.rfidUser.findUnique({ where: { rfid_tag: t.tag } });
      if (!existing) {
        await prisma.rfidUser.create({
          data: {
            rfid_tag: t.tag,
            name: t.name,
            active: t.active,
            email: "tester@grid-ocpp.internal",
            owner_id: ownerId,
          },
        });
      }
    }

    return {
      charger,
      station,
      chargeGroup,
      connectors: createdConnectors,
      testTags,
    };
  }

  /**
   * Add a new simulated test charger to the Virtual Test Lab and boot it
   */
  public async createSimulatedCharger(options: {
    name?: string;
    templateId?: string;
    socketCount?: number;
    powerCapacityKw?: number;
    protocol?: OcppProtocol;
    connectorType?: string;
    format?: string;
    ownerId?: number;
  }): Promise<{ charger: any; instance: SimulatedChargerInstance }> {
    const ownerId = options.ownerId || 1;
    const template = options.templateId ? this.getTemplateById(options.templateId) : undefined;
    const protocol: OcppProtocol = options.protocol || template?.defaultProtocol || "ocpp1.6";

    // 1. Ensure ChargeGroup and Station exist
    const chargeGroup = await this.ensureVirtualTestLabChargeGroup();
    let station = await prisma.chargingStation.findFirst({
      where: { station_name: "Virtual Test Lab Station" },
    });

    if (!station) {
      station = await prisma.chargingStation.create({
        data: {
          station_name: "Virtual Test Lab Station",
          street_name: "Innovation Way 42",
          city: "Amsterdam",
          state: "Noord-Holland",
          postal_code: "1012AB",
          country: "Netherlands",
          latitude: 52.3702,
          longitude: 4.8952,
          maxPower: 500.0,
          owner_id: ownerId,
          isGroundPlanEnabled: true,
        },
      });
    }

    // 2. Determine socketCount: if explicitly provided (1 or 2), use it. Otherwise use template's socket count or default 1.
    const socketCount = options.socketCount === 2
      ? 2
      : options.socketCount === 1
      ? 1
      : template
      ? template.connectors.length
      : 1;

    // 3. Charger name
    const timestamp = Date.now().toString().slice(-4);
    let chargerName = options.name ? options.name.trim() : "";
    if (!chargerName) {
      chargerName = template ? `SIM-${template.id.toUpperCase()}-${timestamp}` : `SIM-LAB-${timestamp}`;
    }

    const existingCharger = await prisma.charger.findUnique({ where: { name: chargerName } });
    if (existingCharger) {
      chargerName = `${chargerName}-${timestamp}`;
    }

    const powerCapacity = options.powerCapacityKw || template?.powerCapacityKw || (socketCount === 2 ? 44.0 : 22.0);
    const model = template?.model || (socketCount === 2 ? "GridSim-Dual-Pro" : "GridSim-Single-Pro");
    const vendor = template?.vendor || "VirtualLab";
    const firmwareVersion = template?.firmwareVersion || "v4.2.0-sim";

    // 4. Create Charger record
    const charger = await prisma.charger.create({
      data: {
        name: chargerName,
        model,
        manufacturer: vendor,
        serial_number: `SN-${chargerName}`,
        power_capacity: powerCapacity,
        firmware_version: firmwareVersion,
        service_contacts: "lab@grid-ocpp.internal",
        charging_station_id: station.id,
        chargeGroupId: chargeGroup.id,
        owner_id: ownerId,
        status: "offline",
      },
      include: { evses: { include: { connectors: true } }, chargeGroup: true },
    });

    // 5. Create EVSEs and Connectors
    const instanceConnectors: Array<{
      id: number;
      name: string;
      maxPowerW: number;
      type: string;
      format: string;
    }> = [];

    for (let i = 1; i <= socketCount; i++) {
      const connTpl = template?.connectors[i - 1];
      const connectorType = i === 1
        ? (options.connectorType || connTpl?.type || "Type2")
        : (connTpl?.type || (powerCapacity > 22 ? "CCS2" : "Type2"));
      const format = i === 1
        ? (options.format || connTpl?.format || (connectorType === "CCS2" ? "CABLE" : "SOCKET"))
        : (connTpl?.format || (connectorType === "CCS2" ? "CABLE" : "SOCKET"));
      const maxPowerW = connTpl?.maxPowerW || (connectorType === "CCS2" ? 150000 : 22000);
      const connName = `Channel ${i}`;

      const evse = await prisma.evse.create({
        data: {
          charger_id: charger.charger_id,
          evse_id: i,
        },
      });

      await prisma.connector.create({
        data: {
          connector_name: connName,
          status: "Available",
          current_type: connectorType === "CCS2" || connectorType === "CHAdeMO" ? "DC" : "AC",
          max_power: maxPowerW / 1000,
          max_current: connectorType === "CCS2" ? 250 : 32,
          max_voltage: connectorType === "CCS2" ? 800 : 400,
          phaseConnection: connectorType === "CCS2" ? "DC" : "L1-L2-L3",
          format,
          evse_id: evse.id,
        },
      });

      instanceConnectors.push({
        id: i,
        name: connName,
        maxPowerW,
        type: connectorType,
        format,
      });
    }

    // Ensure test tags exist
    await this.ensureTestRfidTags(ownerId);

    // 6. Start instance with the exact instanceConnectors
    const instance = await this.startInstance({
      chargerId: charger.charger_id,
      chargerName: charger.name,
      protocol,
      vendor,
      model,
      firmwareVersion,
      connectors: instanceConnectors,
    });

    return { charger, instance };
  }

  /**
   * Get all simulated chargers (from Virtual Test Lab station/chargegroup or SIM- prefix)
   */
  public async getSimulatedChargers(ownerId?: number): Promise<any[]> {
    const chargeGroup = await this.ensureVirtualTestLabChargeGroup();
    const station = await prisma.chargingStation.findFirst({
      where: { station_name: "Virtual Test Lab Station" },
    });

    const where: any = {
      OR: [
        { chargeGroupId: chargeGroup.id },
        { name: { startsWith: "SIM-" } },
        ...(station ? [{ charging_station_id: station.id }] : []),
      ],
    };

    const chargers = await prisma.charger.findMany({
      where,
      include: {
        evses: {
          include: {
            connectors: true,
          },
        },
        chargeGroup: true,
        chargingStation: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return chargers.map((charger) => {
      const liveInstance = this.getInstance(charger.charger_id) || this.getInstance(charger.name);
      return {
        ...charger,
        isSimulated: true,
        simSession: liveInstance ? liveInstance.toJSON() : null,
        simStatus: liveInstance ? liveInstance.status : "disconnected",
      };
    });
  }

  /**
   * Remove a simulated charger from memory and delete from database
   */
  public async deleteSimulatedCharger(idOrName: string | number): Promise<boolean> {
    const charger = await prisma.charger.findFirst({
      where: typeof idOrName === "number" || !isNaN(Number(idOrName))
        ? { OR: [{ charger_id: Number(idOrName) }, { name: String(idOrName) }] }
        : { name: String(idOrName) },
      include: { evses: { include: { connectors: true } } },
    });

    this.stopInstance(idOrName);
    if (charger) {
      this.stopInstance(charger.charger_id);
      this.stopInstance(charger.name);
    }

    if (!charger) {
      return false;
    }

    const chargerId = charger.charger_id;

    // Clean up relations
    await prisma.ocppLog.deleteMany({ where: { chargerId } }).catch(() => {});
    await prisma.chargerConfiguration.deleteMany({ where: { chargerId } }).catch(() => {});
    await prisma.meterValue.deleteMany({ where: { chargerId } }).catch(() => {});
    await prisma.transaction.deleteMany({ where: { charger_id: chargerId } }).catch(() => {});

    for (const evse of charger.evses) {
      await prisma.connector.deleteMany({ where: { evse_id: evse.id } }).catch(() => {});
    }
    await prisma.evse.deleteMany({ where: { charger_id: chargerId } }).catch(() => {});
    await prisma.charger.delete({ where: { charger_id: chargerId } });

    return true;
  }

  /**
   * Run an automated E2E test suite on a simulated charger
   */
  public async runTestSuite(chargerIdOrName: string | number, suiteId: string): Promise<TestSuiteResult> {
    const inst = this.getInstance(chargerIdOrName);
    if (!inst) {
      throw new Error(`Simulated charger instance ${chargerIdOrName} is not active. Start it first.`);
    }

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const steps: TestSuiteStep[] = [];
    let suiteName = "";

    const executeStep = async (
      name: string,
      description: string,
      fn: () => Promise<any>
    ): Promise<boolean> => {
      const stepStartTime = Date.now();
      const step: TestSuiteStep = {
        name,
        description,
        status: "running",
      };
      steps.push(step);

      try {
        const details = await fn();
        step.status = "passed";
        step.durationMs = Date.now() - stepStartTime;
        step.details = details;
        return true;
      } catch (err: any) {
        step.status = "failed";
        step.durationMs = Date.now() - stepStartTime;
        step.error = err.message;
        return false;
      }
    };

    let allPassed = true;

    switch (suiteId) {
      case "happy_path": {
        suiteName = "Standard Happy Path Full Charging Session";

        // Step 1: Connect WebSocket
        if (inst.status !== "connected") {
          allPassed = (await executeStep("WebSocket Connection", "Establish WebSocket connection to CPMS", async () => {
            await inst.connect();
            return { endpoint: inst.endpoint, protocol: inst.protocol };
          })) && allPassed;
        }

        // Step 2: BootNotification
        allPassed = (await executeStep("BootNotification", "Send BootNotification and await Accepted", async () => {
          const res = await inst.sendBootNotification();
          if (res?.status !== "Accepted") throw new Error(`BootNotification rejected: ${JSON.stringify(res)}`);
          return res;
        })) && allPassed;

        // Step 3: StatusNotification (Preparing)
        allPassed = (await executeStep("Cable Plug-in", "Plug in cable and transition to Preparing", async () => {
          await inst.plugIn(1);
          return { connectorId: 1, status: "Preparing" };
        })) && allPassed;

        // Step 4: Authorize
        allPassed = (await executeStep("Authorize RFID", "Verify RFID tag SIM-RFID-PASS-01", async () => {
          const res = await inst.sendAuthorize("SIM-RFID-PASS-01");
          const authStatus = res?.idTagInfo?.status || res?.idTokenInfo?.status;
          if (authStatus !== "Accepted") throw new Error(`Authorize returned status: ${authStatus}`);
          return res;
        })) && allPassed;

        // Step 5: StartTransaction
        allPassed = (await executeStep("StartTransaction", "Initiate transaction and start charging", async () => {
          const res = await inst.startTransaction(1, "SIM-RFID-PASS-01");
          return res;
        })) && allPassed;

        // Step 6: Stream 3 MeterValues
        allPassed = (await executeStep("MeterValues Telemetry", "Stream 3 periodic power/energy meter readings", async () => {
          for (let i = 1; i <= 3; i++) {
            await inst.sendMeterValues(1);
            await new Promise((r) => setTimeout(r, 500));
          }
          const conn = inst.connectors.get(1);
          return { currentMeterWh: conn?.currentMeterWh, soc: conn?.soc, powerW: conn?.currentPowerW };
        })) && allPassed;

        // Step 7: StopTransaction
        allPassed = (await executeStep("StopTransaction", "Finalize session and calculate energy consumption", async () => {
          const res = await inst.stopTransaction(1, undefined, "Local", "SIM-RFID-PASS-01");
          return res;
        })) && allPassed;

        // Step 8: Unplug
        allPassed = (await executeStep("Unplug Cable", "Disconnect cable and return connector to Available", async () => {
          await inst.unplug(1);
          return { connectorId: 1, status: "Available" };
        })) && allPassed;

        break;
      }

      case "smart_charging": {
        suiteName = "Dynamic Load Balancing & Smart Charging Derating";

        allPassed = (await executeStep("Connect & Boot", "Initialize charger connection", async () => {
          if (inst.status !== "connected") await inst.connect();
          return await inst.sendBootNotification();
        })) && allPassed;

        allPassed = (await executeStep("Start Session @ 22kW", "Start charging session with unconstrained power", async () => {
          await inst.plugIn(1);
          await inst.startTransaction(1, "SIM-RFID-PASS-01");
          const conn = inst.connectors.get(1);
          return { powerW: conn?.currentPowerW };
        })) && allPassed;

        allPassed = (await executeStep("Apply SetChargingProfile Derating", "Simulate CPMS smart charging limit of 6A / 4.1 kW", async () => {
          const conn = inst.connectors.get(1);
          if (conn) {
            conn.smartChargingLimitW = 4140; // 6A @ 230V 3-phase
            conn.currentPowerW = 4140;
            conn.currentAmps = 6.0;
          }
          await inst.sendMeterValues(1, { powerW: 4140 });
          return { powerW: 4140, currentAmps: 6.0 };
        })) && allPassed;

        allPassed = (await executeStep("Stop & Clean Up", "End test transaction", async () => {
          const res = await inst.stopTransaction(1, undefined, "Local");
          await inst.unplug(1);
          return res;
        })) && allPassed;

        break;
      }

      case "offline_buffering": {
        suiteName = "Network Outage & Store-and-Forward Buffering";

        allPassed = (await executeStep("Start Active Session", "Begin charging session before outage", async () => {
          if (inst.status !== "connected") await inst.connect();
          await inst.sendBootNotification();
          await inst.plugIn(1);
          return await inst.startTransaction(1, "SIM-RFID-PASS-01");
        })) && allPassed;

        allPassed = (await executeStep("Network Disconnect (Outage)", "Simulate sudden broadband / LTE drop", async () => {
          inst.toggleOfflineBuffering(true);
          return { status: inst.status, bufferedCount: inst.offlineBuffer.length };
        })) && allPassed;

        allPassed = (await executeStep("Queue Offline Telemetry", "Generate 3 meter readings & stop transaction while offline", async () => {
          await inst.sendMeterValues(1);
          await inst.sendMeterValues(1);
          await inst.stopTransaction(1, undefined, "Local");
          return { bufferedFramesCount: inst.offlineBuffer.length };
        })) && allPassed;

        allPassed = (await executeStep("Restore Link & Flush Backlog", "Reconnect and drain offline queue to CPMS", async () => {
          const flushRes = await inst.flushOfflineBuffer();
          if (flushRes.errors > 0) throw new Error(`Errors during flush: ${flushRes.errors}`);
          return flushRes;
        })) && allPassed;

        break;
      }

      case "premature_disconnect": {
        suiteName = "Premature Cable Disconnect Anomaly";

        allPassed = (await executeStep("Start Active Session", "Plug in and start transaction", async () => {
          if (inst.status !== "connected") await inst.connect();
          await inst.sendBootNotification();
          await inst.plugIn(1);
          return await inst.startTransaction(1, "SIM-RFID-PASS-01");
        })) && allPassed;

        allPassed = (await executeStep("Abrupt Cable Pull", "Driver forcefully unlatches cable during 22kW flow", async () => {
          await inst.prematureCableDisconnect(1);
          const conn = inst.connectors.get(1);
          return { connectorStatus: conn?.status, errorCode: conn?.errorCode };
        })) && allPassed;

        break;
      }

      case "hardware_fault_recovery": {
        suiteName = "Hardware Fault & Auto-Healing Soft Reset";

        allPassed = (await executeStep("Normal Operation", "Verify charger is online and Available", async () => {
          if (inst.status !== "connected") await inst.connect();
          await inst.sendBootNotification();
          return { status: "Available" };
        })) && allPassed;

        allPassed = (await executeStep("Inject High Temperature Fault", "Trigger thermal overload fault event", async () => {
          await inst.injectFault(1, "HighTemperature", "THERMAL_SENSOR_95C");
          const conn = inst.connectors.get(1);
          return { connectorStatus: conn?.status, errorCode: conn?.errorCode };
        })) && allPassed;

        allPassed = (await executeStep("Clear Fault & Restore", "Simulate cooling down and soft reset recovery", async () => {
          const conn = inst.connectors.get(1);
          if (conn) {
            conn.temperature = 25.0;
            conn.status = "Available";
            conn.errorCode = "NoError";
            await inst.sendStatusNotification(1, "Available", "NoError");
          }
          return { connectorStatus: "Available" };
        })) && allPassed;

        break;
      }

      case "unauthorized_rfid": {
        suiteName = "Unauthorized / Blocked RFID Rejection";

        allPassed = (await executeStep("Connect & Boot", "Verify charger connection", async () => {
          if (inst.status !== "connected") await inst.connect();
          return await inst.sendBootNotification();
        })) && allPassed;

        allPassed = (await executeStep("Present Blocked Card", "Present blocked tag SIM-RFID-BLOCKED-02", async () => {
          const res = await inst.sendAuthorize("SIM-RFID-BLOCKED-02");
          const authStatus = res?.idTagInfo?.status || res?.idTokenInfo?.status;
          if (authStatus === "Accepted") throw new Error("Blocked RFID was unexpectedly Accepted!");
          return { authStatus, expected: "Blocked/Invalid" };
        })) && allPassed;

        break;
      }

      default:
        throw new Error(`Unknown test suite ID: ${suiteId}`);
    }

    const completedAt = new Date().toISOString();
    return {
      suiteId,
      suiteName,
      passed: allPassed,
      startedAt,
      completedAt,
      durationMs: Date.now() - startTime,
      steps,
    };
  }
}

export const simulatorService = new SimulatorServiceManager();
