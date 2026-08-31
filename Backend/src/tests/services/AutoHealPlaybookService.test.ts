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
