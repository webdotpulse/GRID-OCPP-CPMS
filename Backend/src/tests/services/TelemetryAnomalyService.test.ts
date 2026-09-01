import { jest } from "@jest/globals";
import { MeterValueJobData } from "../../queues/queueManager.js";

const mockPrisma: any = {
  anomalyEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  componentHealthScore: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  charger: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
  diagnosticEvent: {
    create: jest.fn(),
  },
};

const mockRemoteControl: any = {
  setChargingProfile: jest.fn(),
  clearChargingProfile: jest.fn(),
};

const mockRedis: any = {
  redisClient: {
    rpush: jest.fn(),
    ltrim: jest.fn(),
    expire: jest.fn(),
    lrange: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
  redisPublisher: {
    publish: jest.fn(),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    on: jest.fn(),
  },
};

const mockRealtime: any = {
  getIO: jest.fn(() => ({
    emit: jest.fn(),
  })),
};

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => mockRemoteControl);

jest.unstable_mockModule("../../config/redis.js", () => mockRedis);

jest.unstable_mockModule("../../ocpp/realtime.socket.js", () => mockRealtime);

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("TelemetryAnomalyService", () => {
  let TelemetryAnomalyService: any;

  beforeAll(async () => {
    const mod = await import("../../services/TelemetryAnomalyService.js");
    TelemetryAnomalyService = mod.TelemetryAnomalyService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("evaluatePhysicalMetrics", () => {
    it("should return healthy status for nominal 3-phase charging", () => {
      const now = new Date();
      const window: MeterValueJobData[] = [
        {
          transactionId: "tx-1",
          chargerId: 1,
          connectorId: 1,
          currentValue: 32,
          current_L1: 32,
          current_L2: 32,
          current_L3: 32,
          voltageValue: 230,
          voltage_L1: 230,
          voltage_L2: 230,
          voltage_L3: 230,
          temperatureValue: 35,
          timestamp: new Date(now.getTime() - 4000),
        },
        {
          transactionId: "tx-1",
          chargerId: 1,
          connectorId: 1,
          currentValue: 32,
          current_L1: 32,
          current_L2: 32,
          current_L3: 32,
          voltageValue: 230,
          voltage_L1: 230,
          voltage_L2: 230,
          voltage_L3: 230,
          temperatureValue: 36,
          timestamp: now,
        },
      ];

      const current = window[1];
      const result = TelemetryAnomalyService.evaluatePhysicalMetrics(window, current);

      expect(result.isAnomaly).toBe(false);
      expect(result.severity).toBe("LOW");
      expect(result.anomalyScore).toBeLessThan(0.5);
      expect(result.metrics.maxAsymmetricVoltageDrop_V).toBe(0);
    });

    it("should detect degrading contact resistance on asymmetric phase voltage drop", () => {
      const now = new Date();
      // Phase L2 has a 14V drop under 32A load => R_contact = 14 / 32 = 437 mΩ
      const sample: MeterValueJobData = {
        transactionId: "tx-100",
        chargerId: 2,
        connectorId: 1,
        currentValue: 32,
        current_L1: 32,
        current_L2: 32,
        current_L3: 32,
        voltageValue: 230,
        voltage_L1: 230,
        voltage_L2: 216, // Asymmetric voltage drop
        voltage_L3: 230,
        temperatureValue: 48,
        timestamp: now,
      };

      const window = [sample, sample, sample, sample, sample];
      const result = TelemetryAnomalyService.evaluatePhysicalMetrics(window, sample);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyType).toBe("CONTACT_RESISTANCE_SPIKE");
      expect(result.affectedPhase).toBe("L2");
      expect(result.severity).toBe("CRITICAL");
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0.85);
      expect(result.suggestedDerateAmps).toBe(16);
      expect(result.metrics.contactResistanceL2_mOhm).toBeGreaterThan(30);
    });

    it("should detect cooling degradation on rapid thermal rate of rise", () => {
      const now = new Date();
      // Temp rises from 50°C to 75°C in 2 minutes => slope = 12.5°C/min
      const window: MeterValueJobData[] = [
        {
          transactionId: "tx-200",
          chargerId: 3,
          connectorId: 1,
          currentValue: 32,
          current_L1: 32,
          voltage_L1: 230,
          temperatureValue: 50,
          timestamp: new Date(now.getTime() - 120000), // 2 mins ago
        },
        {
          transactionId: "tx-200",
          chargerId: 3,
          connectorId: 1,
          currentValue: 32,
          current_L1: 32,
          voltage_L1: 230,
          temperatureValue: 62,
          timestamp: new Date(now.getTime() - 60000), // 1 min ago
        },
        {
          transactionId: "tx-200",
          chargerId: 3,
          connectorId: 1,
          currentValue: 32,
          current_L1: 32,
          voltage_L1: 230,
          temperatureValue: 75,
          timestamp: now,
        },
      ];

      const current = window[2];
      const result = TelemetryAnomalyService.evaluatePhysicalMetrics(window, current);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyType).toBe("COOLING_DEGRADATION");
      expect(result.severity).toBe("CRITICAL");
      expect(result.suggestedDerateAmps).toBe(10);
      expect(result.metrics.thermalSlopeDegPerMin).toBeGreaterThan(2.2);
    });

    it("should detect cable wear from high harmonic distortion", () => {
      const now = new Date();
      const sample: MeterValueJobData = {
        transactionId: "tx-300",
        chargerId: 4,
        connectorId: 1,
        currentValue: 24,
        current_L1: 24,
        voltage_L1: 230,
        thd_current: 18.5, // 18.5% THD
        temperatureValue: 38,
        timestamp: now,
      };

      const window = [sample, sample, sample, sample, sample];
      const result = TelemetryAnomalyService.evaluatePhysicalMetrics(window, sample);

      expect(result.isAnomaly).toBe(true);
      expect(result.anomalyType).toBe("CABLE_WEAR_HARMONICS");
      expect(result.severity).toBe("MEDIUM");
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0.70);
    });

    it("should skip anomaly evaluations when charger is unloaded or idle (<4A)", () => {
      const now = new Date();
      const sample: MeterValueJobData = {
        transactionId: "tx-400",
        chargerId: 5,
        connectorId: 1,
        currentValue: 1.2,
        current_L1: 1.2,
        voltage_L1: 200,
        timestamp: now,
      };

      const window = [sample, sample, sample, sample, sample];
      const result = TelemetryAnomalyService.evaluatePhysicalMetrics(window, sample);

      expect(result.isAnomaly).toBe(false);
      expect(result.severity).toBe("LOW");
    });
  });

  describe("analyzeTelemetry & closed-loop derating", () => {
    it("should persist AnomalyEvent, mark charger at risk, and send SetChargingProfile when critical anomaly detected", async () => {
      mockRemoteControl.setChargingProfile.mockResolvedValue({
        status: "Accepted",
      });

      mockRedis.redisClient.rpush.mockResolvedValue(1);
      mockRedis.redisClient.ltrim.mockResolvedValue("OK");
      mockRedis.redisClient.expire.mockResolvedValue(1);
      mockRedis.redisClient.get.mockResolvedValue(null); // not debounced
      mockRedis.redisClient.set.mockResolvedValue("OK");

      const anomalySample: MeterValueJobData = {
        transactionId: "tx-999",
        chargerId: 10,
        connectorId: 1,
        currentValue: 32,
        current_L1: 32,
        current_L2: 32,
        current_L3: 32,
        voltageValue: 230,
        voltage_L1: 230,
        voltage_L2: 215, // 15V drop under 32A
        voltage_L3: 230,
        temperatureValue: 40,
        timestamp: new Date().toISOString(),
      };

      const windowJson = JSON.stringify(anomalySample);
      mockRedis.redisClient.lrange.mockResolvedValue([
        windowJson,
        windowJson,
        windowJson,
        windowJson,
        windowJson,
        windowJson,
      ]);

      mockPrisma.anomalyEvent.create.mockResolvedValue({
        id: 77,
        chargerId: 10,
        connectorId: 1,
        anomalyType: "CONTACT_RESISTANCE_SPIKE",
        severity: "CRITICAL",
        anomalyScore: 0.95,
        confidence: 0.95,
        rootCause: "Degraded contact resistance",
        affectedPhase: "L2",
        deratingApplied: true,
        deratedLimitAmps: 16,
        resolved: false,
        createdAt: new Date(),
      });

      mockPrisma.charger.update.mockResolvedValue({});
      mockPrisma.diagnosticEvent.create.mockResolvedValue({});
      mockPrisma.componentHealthScore.upsert.mockResolvedValue({});

      const result = await TelemetryAnomalyService.analyzeTelemetry(anomalySample);

      expect(result).not.toBeNull();
      expect(result?.isAnomaly).toBe(true);
      expect(mockRemoteControl.setChargingProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          chargerId: 10,
          connectorId: 1,
        })
      );
      expect(mockPrisma.anomalyEvent.create).toHaveBeenCalled();
      expect(mockPrisma.charger.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { charger_id: 10 },
          data: { isHardwareAtRisk: true },
        })
      );
      expect(mockPrisma.diagnosticEvent.create).toHaveBeenCalled();
      expect(mockPrisma.componentHealthScore.upsert).toHaveBeenCalled();
    });
  });
});
