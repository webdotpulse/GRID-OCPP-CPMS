import { jest } from "@jest/globals";
import * as simulatorController from "../../api/simulator/simulator.controller.js";
import { simulatorService, SimulatedChargerInstance } from "../../services/SimulatorService.js";
import { prisma } from "../../config/database.js";

describe("Simulator Controller Unit Tests (/api/simulator)", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      userRole: "admin",
      userId: 1,
      params: {},
      body: {},
      query: {},
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  describe("getSessions", () => {
    it("should return empty list when no simulator instances are active", async () => {
      jest.spyOn(simulatorService, "getInstances").mockReturnValue([]);

      await simulatorController.getSessions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it("should return serialized instances when active", async () => {
      const mockInst = new SimulatedChargerInstance({
        chargerId: 1,
        chargerName: "SIM-CP-01",
      });
      jest.spyOn(simulatorService, "getInstances").mockReturnValue([mockInst]);

      await simulatorController.getSessions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [expect.objectContaining({ chargerName: "SIM-CP-01" })],
        })
      );
    });
  });

  describe("getTemplates", () => {
    it("should return the catalog of predefined charger templates", async () => {
      await simulatorController.getTemplates(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: "alfen-eve-single" }),
            expect.objectContaining({ id: "abb-terra-184-dc" }),
          ]),
        })
      );
    });
  });

  describe("getSessionById", () => {
    it("should return 404 when session not found", async () => {
      mockReq.params = { id: "non-existent-id" };
      jest.spyOn(simulatorService, "getInstance").mockReturnValue(undefined);

      await simulatorController.getSessionById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it("should return session details and logs when found", async () => {
      const mockInst = new SimulatedChargerInstance({
        chargerId: 5,
        chargerName: "SIM-CP-05",
      });
      mockReq.params = { id: mockInst.id };
      jest.spyOn(simulatorService, "getInstance").mockReturnValue(mockInst);

      await simulatorController.getSessionById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ chargerName: "SIM-CP-05" }),
        })
      );
    });
  });

  describe("quickProvision", () => {
    it("should call quickProvision and return 201 with provisioned charger", async () => {
      mockReq.body = { prefix: "SIM-TEST" };
      jest.spyOn(simulatorService, "quickProvision").mockResolvedValue({
        charger: { charger_id: 123, name: "SIM-TEST-9999" },
        station: { id: 1 },
        connectors: [{ id: 1 }, { id: 2 }],
        testTags: [{ tag: "SIM-RFID-PASS-01" }],
      });

      await simulatorController.quickProvision(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            charger: { charger_id: 123, name: "SIM-TEST-9999" },
          }),
        })
      );
    });
  });

  describe("startSession", () => {
    it("should resolve charger from database and start simulator instance", async () => {
      mockReq.body = { chargerId: 42, protocol: "ocpp1.6" };

      jest.spyOn(prisma.charger, "findUnique").mockResolvedValue({
        charger_id: 42,
        name: "TEST-CP-42",
        manufacturer: "VirtualLab",
        model: "GridSim-Pro-2026",
        firmware_version: "v4.2.0-sim",
        evses: [],
      } as any);

      const mockInstance = new SimulatedChargerInstance({
        chargerId: 42,
        chargerName: "TEST-CP-42",
      });

      jest.spyOn(simulatorService, "startInstance").mockResolvedValue(mockInstance);

      await simulatorController.startSession(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ chargerId: 42, chargerName: "TEST-CP-42" }),
        })
      );
    });

    it("should start simulator instance directly from templateId", async () => {
      mockReq.body = { templateId: "alfen-eve-single", protocol: "ocpp1.6" };

      const mockInstance = new SimulatedChargerInstance({
        chargerId: 77,
        chargerName: "SIM-ALFEN-EVE-SINGLE",
      });

      jest.spyOn(simulatorService, "startTemplateInstance").mockResolvedValue(mockInstance);

      await simulatorController.startSession(mockReq, mockRes);

      expect(simulatorService.startTemplateInstance).toHaveBeenCalledWith("alfen-eve-single", expect.objectContaining({
        protocol: "ocpp1.6",
      }));
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ chargerName: "SIM-ALFEN-EVE-SINGLE" }),
        })
      );
    });
  });

  describe("sendAction", () => {
    it("should dispatch BootNotification action", async () => {
      const mockInst = new SimulatedChargerInstance({
        chargerId: 10,
        chargerName: "SIM-CP-10",
      });
      mockReq.params = { id: mockInst.id };
      mockReq.body = { action: "BootNotification" };

      jest.spyOn(simulatorService, "getInstance").mockReturnValue(mockInst);
      jest.spyOn(mockInst, "sendBootNotification").mockResolvedValue({ status: "Accepted" });

      await simulatorController.sendAction(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          action: "BootNotification",
          response: { status: "Accepted" },
        })
      );
    });
  });

  describe("triggerScenario", () => {
    it("should trigger premature cable disconnect scenario", async () => {
      const mockInst = new SimulatedChargerInstance({
        chargerId: 10,
        chargerName: "SIM-CP-10",
      });
      mockReq.params = { id: mockInst.id };
      mockReq.body = { scenario: "premature-cable-disconnect", connectorId: 1 };

      jest.spyOn(simulatorService, "getInstance").mockReturnValue(mockInst);
      jest.spyOn(mockInst, "prematureCableDisconnect").mockResolvedValue();

      await simulatorController.triggerScenario(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          scenario: "premature-cable-disconnect",
        })
      );
    });
  });

  describe("getSimulatedChargers", () => {
    it("should return simulated chargers from simulator service", async () => {
      jest.spyOn(simulatorService, "getSimulatedChargers").mockResolvedValue([
        { charger_id: 1, name: "SIM-01", isSimulated: true },
      ] as any);

      await simulatorController.getSimulatedChargers(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ charger_id: 1, name: "SIM-01", isSimulated: true }],
      });
    });
  });

  describe("createSimulatedCharger", () => {
    it("should create a simulated charger with 1 socket and return 201", async () => {
      mockReq.body = { name: "SIM-CUSTOM-1", socketCount: 1 };
      const mockInst = new SimulatedChargerInstance({
        chargerId: 50,
        chargerName: "SIM-CUSTOM-1",
        connectors: [{ id: 1, name: "Channel 1" }],
      });

      jest.spyOn(simulatorService, "createSimulatedCharger").mockResolvedValue({
        charger: { charger_id: 50, name: "SIM-CUSTOM-1" } as any,
        instance: mockInst,
      });

      await simulatorController.createSimulatedCharger(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            charger: { charger_id: 50, name: "SIM-CUSTOM-1" },
          }),
        })
      );
    });
  });

  describe("deleteSimulatedCharger", () => {
    it("should delete simulated charger and return success", async () => {
      mockReq.params = { id: "50" };
      jest.spyOn(simulatorService, "deleteSimulatedCharger").mockResolvedValue(true);

      await simulatorController.deleteSimulatedCharger(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Simulated charger '50' removed from simulator and database",
      });
    });

    it("should return 404 if charger to delete is not found", async () => {
      mockReq.params = { id: "non-existent" };
      jest.spyOn(simulatorService, "deleteSimulatedCharger").mockResolvedValue(false);

      await simulatorController.deleteSimulatedCharger(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getRfidTags", () => {
    it("should return RFID tags list from database", async () => {
      jest.spyOn(prisma.rfidUser, "findMany").mockResolvedValue([
        { rfid_tag: "PASS-1", name: "Driver 1", active: true },
        { rfid_tag: "PASS-2", name: "Driver 2", active: false },
      ] as any);

      await simulatorController.getRfidTags(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { rfid_tag: "PASS-1", name: "Driver 1", active: true },
          { rfid_tag: "PASS-2", name: "Driver 2", active: false },
        ],
      });
    });
  });
});

