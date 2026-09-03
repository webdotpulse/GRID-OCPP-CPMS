import { jest } from "@jest/globals";

const mockPrisma: any = {
  autoHealPlaybook: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  autoHealExecution: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  charger: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  diagnosticEvent: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockRemoteControl: any = {
  unlockConnector: jest.fn(),
  resetCharger: jest.fn(),
  changeAvailability: jest.fn(),
  setChargingProfile: jest.fn(),
  clearChargingProfile: jest.fn(),
  triggerMessage: jest.fn(),
  changeConfiguration: jest.fn(),
  dataTransfer: jest.fn(),
};

const mockRedis: any = {
  redisPublisher: {
    publish: jest.fn().mockImplementation(() => Promise.resolve(1)),
  },
};

const mockWebhook: any = {
  WebhookService: {
    dispatch: jest.fn().mockImplementation(() => Promise.resolve()),
  },
};

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => mockRemoteControl);

jest.unstable_mockModule("../../config/redis.js", () => mockRedis);

jest.unstable_mockModule("../../services/WebhookService.js", () => mockWebhook);

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("AutoHealPlaybookService (Vendor-Specific Auto-Healing & AI Log Parser)", () => {
  let AutoHealPlaybookService: any;
  let DEFAULT_VENDOR_PLAYBOOKS: any[];

  beforeAll(async () => {
    const mod = await import("../../services/AutoHealPlaybookService.js");
    AutoHealPlaybookService = mod.AutoHealPlaybookService;
    DEFAULT_VENDOR_PLAYBOOKS = mod.DEFAULT_VENDOR_PLAYBOOKS;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Default Vendor Playbooks Catalog", () => {
    it("should provide comprehensive pre-seeded playbooks for major manufacturers", () => {
      expect(Array.isArray(DEFAULT_VENDOR_PLAYBOOKS)).toBe(true);
      expect(DEFAULT_VENDOR_PLAYBOOKS.length).toBeGreaterThanOrEqual(10);

      const vendors = DEFAULT_VENDOR_PLAYBOOKS.map((p: any) => p.vendor);
      expect(vendors).toContain("Alfen");
      expect(vendors).toContain("EVBox");
      expect(vendors).toContain("ABB");
      expect(vendors).toContain("Schneider");
      expect(vendors).toContain("Kempower");
      expect(vendors).toContain("Raedian");
      expect(vendors).toContain("Generic");
    });

    it("should have well-defined multi-step actions for each default playbook", () => {
      for (const pb of DEFAULT_VENDOR_PLAYBOOKS) {
        expect(pb.name).toBeTruthy();
        expect(pb.errorCodePattern).toBeTruthy();
        expect(Array.isArray(pb.steps)).toBe(true);
        expect(pb.steps.length).toBeGreaterThanOrEqual(2);
        for (const step of pb.steps) {
          expect(step.stepNumber).toBeGreaterThan(0);
          expect(step.action).toBeTruthy();
        }
      }
    });
  });

  describe("AI-Assisted Error Log & Diagnostic Parser", () => {
    it("should accurately identify Alfen vendor and socket lock issue from raw error string", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        rawLog: "Connector 1 reported lock timeout: Err_023 (Socket lock actuator timeout)",
      });

      expect(result.isAiParsed).toBe(true);
      expect(result.vendor).toBe("Alfen");
      expect(result.category).toBe("ConnectorLock");
      expect(result.severity).toBe("HIGH");
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.matchedPlaybook?.name).toContain("Alfen Socket Lock Retract Recovery");
    });

    it("should accurately identify ABB vendor and control pilot voltage drift", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorErrorCode: "F_012_PILOT_FAULT",
        info: "CP_DRIFT PWM voltage out of tolerance on EVSE channel 1",
      });

      expect(result.vendor).toBe("ABB");
      expect(result.category).toBe("Communications");
      expect(result.matchedPlaybook?.name).toContain("ABB Control Pilot");
    });

    it("should accurately identify Kempower DC isolation failure", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        rawLog: "Kempower C-Station satellite interlock fault: KP_SAT_ISO_FAIL (SatelliteIsolation)",
      });

      expect(result.vendor).toBe("Kempower");
      expect(result.category).toBe("PowerElectronics");
      expect(result.severity).toBe("CRITICAL");
      expect(result.matchedPlaybook?.name).toContain("Kempower Satellite DC Isolation");
    });

    it("should fallback to Generic faulted recovery on unknown hardware fault", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        errorCode: "GenericFault",
        info: "SuspendedEVSE unexpected interlock opening",
      });

      expect(result.category).toBe("General");
      expect(result.matchedPlaybook?.name).toContain("Universal");
    });

    it("should accurately identify and recommend MeterValues Telemetry recovery for missing SampleInterval or SampledData keys", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        info: "Missing MeterValueSampleInterval: The charger configuration 'MeterValueSampleInterval' is missing or set to 0. Missing MeterValuesSampledData Keys: 'Power.Active.Import' or 'Energy.Active.Import.Register' are missing.",
      });

      expect(result.category).toBe("Telemetry");
      expect(result.severity).toBe("HIGH");
      expect(result.matchedPlaybook?.name).toContain("MeterValues Telemetry & Interval Configuration Recovery");
    });

    it("should accurately identify Raedian vendor and overvoltage fault (E00008)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorErrorCode: "E00008",
        info: "Overvoltage: The voltage input is greater than or equal to 120% of the nominal voltage (276V)",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.category).toBe("GridFault");
      expect(result.severity).toBe("HIGH");
      expect(result.matchedPlaybook?.name).toContain("Raedian Grid Voltage Anomaly Protection");
      expect(result.rootCause).toContain("276V");
      expect(result.rootCause).toContain("contact local utility company");
    });

    it("should accurately identify Raedian electronic lock error (E01000)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        rawLog: "Raedian NEX reported Electronic lock error: E01000",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.category).toBe("ConnectorLock");
      expect(result.matchedPlaybook?.name).toContain("Raedian Motorized Lock Latch Pulse");
      expect(result.rootCause).toContain("charging cable is not fully inserted");
    });

    it("should accurately identify Raedian relay error (E00400)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorErrorCode: "E00400",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.category).toBe("PowerElectronics");
      expect(result.severity).toBe("CRITICAL");
      expect(result.matchedPlaybook?.name).toContain("Raedian Contactor & Relay Coil Power Cycle");
    });

    it("should accurately identify Raedian IT network phase loss & undervoltage (E02010)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorErrorCode: "E02010",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.category).toBe("GridFault");
      expect(result.matchedPlaybook?.name).toContain("Raedian Phase Loss & Network Inspection");
      expect(result.rootCause).toContain("IT network");
    });

    it("should accurately identify Raedian charger via vendorId 'RAEDIAN' and 16-bit hex code '0x0008'", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorId: "RAEDIAN",
        vendorErrorCode: "0x0008",
        info: "{\"channel\": 16, \"current\": 10}",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.category).toBe("GridFault");
      expect(result.severity).toBe("HIGH");
      expect(result.matchedPlaybook?.name).toContain("Raedian Grid Voltage Anomaly Protection");
      expect(result.rootCause).toContain("276V");
    });

    it("should handle regular Raedian message with '0x0000' as healthy NoError state", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorId: "RAEDIAN",
        vendorErrorCode: "0x0000",
        errorCode: "NoError",
        info: "{\"channel\": 16, \"current\": 10}",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.matchedPlaybook).toBeNull();
      expect(result.severity).toBe("LOW");
      expect(result.rootCause).toContain("NoError");
    });

    it("should accurately resolve compound hex code '0x2010' to Raedian Phase Loss & Undervoltage", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendorId: "RAEDIAN",
        vendorErrorCode: "0x2010",
      });

      expect(result.vendor).toBe("Raedian");
      expect(result.category).toBe("GridFault");
      expect(result.matchedPlaybook?.name).toContain("Raedian Phase Loss & Network Inspection");
      expect(result.rootCause).toContain("IT network");
    });

    // --- ALFEN TESTS ---
    it("should accurately resolve Alfen 6mA DC RCD Fault (101)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Alfen",
        vendorErrorCode: "101",
      });

      expect(result.vendor).toBe("Alfen");
      expect(result.category).toBe("PowerElectronics");
      expect(result.severity).toBe("CRITICAL");
      expect(result.matchedPlaybook?.name).toContain("Alfen Earth Leakage / MID Meter Recovery");
      expect(result.rootCause).toContain("6mA DC RCD Fault");
    });

    it("should accurately resolve Alfen Missing Phase (212)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Alfen",
        vendorErrorCode: "212",
      });

      expect(result.vendor).toBe("Alfen");
      expect(result.category).toBe("GridFault");
      expect(result.matchedPlaybook?.name).toContain("Alfen Phase Wiring & Supply Loss Recovery");
      expect(result.rootCause).toContain("Missing Phase");
    });

    it("should accurately resolve Alfen Vehicle Diode Fault (302)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Alfen",
        vendorErrorCode: "302",
      });

      expect(result.vendor).toBe("Alfen");
      expect(result.category).toBe("PowerElectronics");
      expect(result.matchedPlaybook?.name).toContain("Alfen Vehicle Diode & Handshake Recovery");
      expect(result.rootCause).toContain("Diode Fault");
    });

    // --- EASEE TESTS ---
    it("should handle Easee ReasonForNoCurrent 0 (ChargerFine) as healthy state", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Easee",
        vendorErrorCode: "0",
      });

      expect(result.vendor).toBe("Easee");
      expect(result.matchedPlaybook).toBeNull();
      expect(result.severity).toBe("LOW");
      expect(result.rootCause).toContain("healthy state");
    });

    it("should accurately resolve Easee IllegalGridType (7)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Easee",
        vendorErrorCode: "7",
      });

      expect(result.vendor).toBe("Easee");
      expect(result.category).toBe("GridFault");
      expect(result.matchedPlaybook?.name).toContain("Easee Grid & Phase Configuration Recovery");
      expect(result.rootCause).toContain("IllegalGridType");
    });

    it("should accurately resolve Easee ChargerInError (56)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Easee",
        vendorErrorCode: "56",
      });

      expect(result.vendor).toBe("Easee");
      expect(result.category).toBe("PowerElectronics");
      expect(result.matchedPlaybook?.name).toContain("Easee Hardware Safety Trip & Master Comms Reset");
      expect(result.rootCause).toContain("ChargerInError");
    });

    // --- ZAPTEC TESTS ---
    it("should accurately resolve Zaptec Contactor Welded bitmask (Bit 0 / Value 1)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Zaptec",
        vendorErrorCode: "1",
      });

      expect(result.vendor).toBe("Zaptec");
      expect(result.category).toBe("PowerElectronics");
      expect(result.severity).toBe("CRITICAL");
      expect(result.matchedPlaybook?.name).toContain("Zaptec Contactor Weld & Power Switch Recovery");
      expect(result.rootCause).toContain("CONTACTOR_WELDED");
    });

    it("should accurately resolve Zaptec Lock Actuator Fault bitmask (Bit 8 / Value 256)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Zaptec",
        vendorErrorCode: "256",
      });

      expect(result.vendor).toBe("Zaptec");
      expect(result.category).toBe("ConnectorLock");
      expect(result.matchedPlaybook?.name).toContain("Zaptec Motorized Pin Lock Retract");
      expect(result.rootCause).toContain("LOCK_ACTUATOR_FAULT");
    });

    it("should accurately resolve composite Zaptec status bitmask (257 = 1 | 256)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Zaptec",
        vendorErrorCode: "257",
      });

      expect(result.vendor).toBe("Zaptec");
      expect(result.category).toBe("PowerElectronics");
      expect(result.rootCause).toContain("CONTACTOR_WELDED");
      expect(result.rootCause).toContain("LOCK_ACTUATOR_FAULT");
    });

    // --- PEBLAR TESTS ---
    it("should accurately resolve Peblar Lock Motor Failure (1000)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Peblar",
        vendorErrorCode: "1000",
      });

      expect(result.vendor).toBe("Peblar");
      expect(result.category).toBe("ConnectorLock");
      expect(result.matchedPlaybook?.name).toContain("Peblar Socket Lock Obstruction Release");
      expect(result.rootCause).toContain("Lock Motor Failure");
    });

    it("should accurately resolve Peblar Open PEN fault (1065)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Peblar",
        vendorErrorCode: "1065",
      });

      expect(result.vendor).toBe("Peblar");
      expect(result.category).toBe("GridFault");
      expect(result.matchedPlaybook?.name).toContain("Peblar Earth Leakage & Open PEN Recovery");
      expect(result.rootCause).toContain("Open PEN Disconnection");
    });

    it("should accurately resolve Peblar P1 Smart Meter interface warning (10260)", async () => {
      mockPrisma.autoHealPlaybook.findMany.mockResolvedValue(
        DEFAULT_VENDOR_PLAYBOOKS.map((p, idx) => ({ id: idx + 1, ...p, isActive: true }))
      );

      const result = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
        vendor: "Peblar",
        vendorErrorCode: "10260",
      });

      expect(result.vendor).toBe("Peblar");
      expect(result.category).toBe("Communications");
      expect(result.matchedPlaybook?.name).toContain("Peblar External Meter & Group Balancing Recovery");
      expect(result.rootCause).toContain("P1 Smart Meter Interface Fault");
    });
  });

  describe("Multi-Step Playbook Execution Engine", () => {
    it("should execute playbook steps sequentially and record execution log", async () => {
      const mockPlaybook = {
        id: 1,
        name: "Alfen Socket Lock Retract Recovery",
        vendor: "Alfen",
        errorCodePattern: "Err_023",
        severity: "HIGH",
        category: "ConnectorLock",
        cooldownMinutes: 15,
        maxRetries: 3,
        steps: [
          { stepNumber: 1, action: "UnlockConnector", delayMs: 10, description: "Unlock test" },
          { stepNumber: 2, action: "ChangeAvailability", params: { type: "Operative" }, delayMs: 10, description: "Avail test" },
        ],
      };

      mockPrisma.autoHealPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.autoHealExecution.findFirst.mockResolvedValue(null);

      const mockExec = {
        id: 42,
        playbookId: 1,
        chargerId: 101,
        status: "RUNNING",
        currentStep: 0,
        totalSteps: 2,
        stepLogs: [],
      };

      mockPrisma.autoHealExecution.create.mockResolvedValue(mockExec);
      mockPrisma.autoHealExecution.update.mockResolvedValue(mockExec);
      mockPrisma.diagnosticEvent.create.mockResolvedValue({ id: 99 });
      mockPrisma.diagnosticEvent.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.charger.update.mockResolvedValue({});

      mockRemoteControl.unlockConnector.mockResolvedValue({ status: "Accepted" });
      mockRemoteControl.changeAvailability.mockResolvedValue({ status: "Accepted" });

      const result = await AutoHealPlaybookService.executePlaybook(1, 101, 1, "Test Trigger", "Err_023");

      expect(result.success).toBe(true);
      expect(result.executionId).toBe(42);

      // Wait a moment for background step loop
      await new Promise((r) => setTimeout(r, 100));

      expect(mockPrisma.autoHealExecution.update).toHaveBeenCalled();
    });

    it("should prevent duplicate execution if already actively running", async () => {
      const mockPlaybook = {
        id: 1,
        name: "Test Playbook",
        cooldownMinutes: 15,
        steps: [],
      };

      mockPrisma.autoHealPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.autoHealExecution.findFirst.mockResolvedValue({
        id: 88,
        status: "RUNNING",
      });

      const result = await AutoHealPlaybookService.executePlaybook(1, 101, 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already actively running");
    });
  });
});
