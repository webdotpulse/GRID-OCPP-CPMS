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
