import { jest } from "@jest/globals";
import {
  SimulatorServiceManager,
  SimulatedChargerInstance,
  simulatorService,
} from "../../services/SimulatorService.js";
import { prisma } from "../../config/database.js";

describe("SimulatorService & SimulatedChargerInstance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("SimulatedChargerInstance lifecycle", () => {
    let instance: SimulatedChargerInstance;

    beforeEach(() => {
      instance = new SimulatedChargerInstance({
        chargerId: 101,
        chargerName: "SIM-TEST-CP",
        protocol: "ocpp1.6",
        endpoint: "ws://localhost:9220/OCPP/1.6/SIM-TEST-CP",
        connectors: [
          { id: 1, name: "Channel 1", maxPowerW: 22000, type: "Type2", format: "SOCKET" },
          { id: 2, name: "Channel 2", maxPowerW: 150000, type: "CCS2", format: "CABLE" },
        ],
      });
    });

    afterEach(() => {
      instance.disconnect();
    });

    it("should initialize connectors and default states correctly", () => {
      expect(instance.chargerId).toBe(101);
      expect(instance.chargerName).toBe("SIM-TEST-CP");
      expect(instance.protocol).toBe("ocpp1.6");
      expect(instance.status).toBe("disconnected");
      expect(instance.connectors.size).toBe(2);

      const conn1 = instance.connectors.get(1);
      expect(conn1).toBeDefined();
      expect(conn1?.status).toBe("Available");
      expect(conn1?.isPlugged).toBe(false);
      expect(conn1?.maxPowerW).toBe(22000);

      const conn2 = instance.connectors.get(2);
      expect(conn2).toBeDefined();
      expect(conn2?.type).toBe("CCS2");
      expect(conn2?.maxPowerW).toBe(150000);
    });

    it("should initialize with strictly 1 connector when 1 socket is configured", () => {
      const singleInstance = new SimulatedChargerInstance({
        chargerId: 102,
        chargerName: "SIM-SINGLE-CP",
        protocol: "ocpp1.6",
        connectors: [
          { id: 1, name: "Channel 1", maxPowerW: 22000, type: "Type2", format: "SOCKET" },
        ],
      });
      expect(singleInstance.connectors.size).toBe(1);
      expect(singleInstance.connectors.get(1)).toBeDefined();
      expect(singleInstance.connectors.get(2)).toBeUndefined();
    });

    it("should handle physical plug in and unplug transitions", async () => {
      jest.spyOn(instance, "sendCall").mockResolvedValue({});

      await instance.plugIn(1);
      const conn = instance.connectors.get(1);
      expect(conn?.isPlugged).toBe(true);
      expect(conn?.status).toBe("Preparing");

      await instance.unplug(1);
      expect(conn?.isPlugged).toBe(false);
      expect(conn?.status).toBe("Available");
    });

    it("should start transaction, stream meter values and stop transaction", async () => {
      jest.spyOn(instance, "sendCall").mockImplementation(async (action: string) => {
        if (action === "StartTransaction") {
          return { transactionId: 9999, idTagInfo: { status: "Accepted" } };
        }
        return { status: "Accepted" };
      });

      await instance.plugIn(1);
      const startRes = await instance.startTransaction(1, "TEST-TAG-01", 10000);
      expect(startRes.transactionId).toBe(9999);

      const conn = instance.connectors.get(1);
      expect(conn?.status).toBe("Charging");
      expect(conn?.transactionId).toBe(9999);
      expect(conn?.idTag).toBe("TEST-TAG-01");
      expect(conn?.currentPowerW).toBe(22000);

      // Advance meter values
      const initialMeter = conn?.currentMeterWh || 0;
      await instance.sendMeterValues(1, { powerW: 22000, meterDeltaWh: 500, soc: 45 });
      expect(conn?.soc).toBe(45);
      expect(conn?.currentMeterWh).toBe(initialMeter + 500);

      // Stop transaction
      const stopRes = await instance.stopTransaction(1, conn?.currentMeterWh, "Local", "TEST-TAG-01");
      expect(conn?.transactionId).toBeNull();
      expect(conn?.status).toBe("Finishing");
    });

    it("should handle premature cable disconnect anomaly", async () => {
      jest.spyOn(instance, "sendCall").mockImplementation(async (action: string) => {
        if (action === "StartTransaction") return { transactionId: 777 };
        return {};
      });

      await instance.plugIn(1);
      await instance.startTransaction(1, "TEST-TAG");
      const conn = instance.connectors.get(1);
      expect(conn?.status).toBe("Charging");

      await instance.prematureCableDisconnect(1);
      expect(conn?.isPlugged).toBe(false);
      expect(conn?.currentPowerW).toBe(0);
      expect(conn?.transactionId).toBeNull();
    });

    it("should inject hardware fault and update connector status", async () => {
      jest.spyOn(instance, "sendCall").mockResolvedValue({});

      await instance.injectFault(1, "HighTemperature", "TEMP_SENSOR_95C");
      const conn = instance.connectors.get(1);
      expect(conn?.status).toBe("Faulted");
      expect(conn?.errorCode).toBe("HighTemperature");
      expect(conn?.vendorErrorCode).toBe("TEMP_SENSOR_95C");
    });

    it("should inject meter drift and adjust active power", async () => {
      jest.spyOn(instance, "sendCall").mockResolvedValue({});

      const conn = instance.connectors.get(1)!;
      const initialMeter = conn.currentMeterWh;
      await instance.meterDrift(1, 3000);
      expect(conn.currentMeterWh).toBe(initialMeter + 3000);

      await instance.powerDrop(1, 4.1);
      expect(conn.currentPowerW).toBe(4100);
    });

    it("should buffer frames offline and flush upon reconnect", async () => {
      instance.toggleOfflineBuffering(true);
      expect(instance.status).toBe("offline_buffering");

      // Actions during offline mode should queue in offlineBuffer
      await instance.sendBootNotification();
      await instance.sendMeterValues(1);
      expect(instance.offlineBuffer.length).toBe(2);

      // Mock connect and sendCall during flush
      const sendCallSpy = jest.spyOn(instance, "sendCall").mockResolvedValue({});
      jest.spyOn(instance, "connect").mockResolvedValue();

      const flushRes = await instance.flushOfflineBuffer();
      expect(flushRes.flushedCount).toBe(2);
      expect(flushRes.errors).toBe(0);
      expect(instance.offlineBuffer.length).toBe(0);
    });

    it("should handle SetChargingProfile with connectorId: 0 and throttle all connectors", async () => {
      jest.spyOn(instance, "sendCall").mockResolvedValue({ status: "Accepted" });
      const conn = instance.connectors.get(1)!;
      conn.status = "Charging";
      conn.currentPowerW = 22000;

      // Simulate CPMS sending SetChargingProfile with connectorId: 0
      await (instance as any).handleCentralSystemRpc("msg-101", "SetChargingProfile", {
        connectorId: 0,
        csChargingProfiles: {
          chargingProfileId: 100,
          chargingSchedule: {
            chargingRateUnit: "W",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 16625 }],
          },
        },
      });

      expect(conn.smartChargingLimitW).toBeLessThanOrEqual(16625);
      expect(conn.currentPowerW).toBeLessThanOrEqual(16625);
    });

    it("should handle ClearChargingProfile and restore connector power", async () => {
      jest.spyOn(instance, "sendCall").mockResolvedValue({ status: "Accepted" });
      const conn = instance.connectors.get(1)!;
      conn.status = "Charging";
      conn.smartChargingLimitW = 16625;
      conn.currentPowerW = 16625;

      await (instance as any).handleCentralSystemRpc("msg-102", "ClearChargingProfile", {
        connectorId: 0,
      });

      expect(conn.smartChargingLimitW).toBeNull();
      expect(conn.currentPowerW).toBe(conn.maxPowerW);
    });
  });

  describe("Quick Provisioning", () => {
    beforeEach(() => {
      jest.spyOn(prisma.chargeGroup, "findFirst").mockResolvedValue({
        id: 5,
        name: "Virtual Test Lab",
      } as any);
      jest.spyOn(prisma.chargingStation, "findFirst").mockResolvedValue({
        id: 10,
        station_name: "Virtual Test Lab Station",
      } as any);
      jest.spyOn(prisma.chargingStation, "create").mockResolvedValue({
        id: 10,
        station_name: "Virtual Test Lab Station",
      } as any);
      jest.spyOn(prisma.charger, "create").mockResolvedValue({
        charger_id: 88,
        name: "SIM-LAB-TEST",
        model: "GridSim-Single-Wallbox",
        chargeGroupId: 5,
      } as any);
      jest.spyOn(prisma.evse, "create")
        .mockResolvedValueOnce({ id: 1, evse_id: 1, charger_id: 88 } as any)
        .mockResolvedValueOnce({ id: 2, evse_id: 2, charger_id: 88 } as any);
      jest.spyOn(prisma.connector, "create").mockResolvedValue({ id: 1 } as any);
      jest.spyOn(prisma.rfidUser, "findUnique").mockResolvedValue(null);
      jest.spyOn(prisma.rfidUser, "create").mockResolvedValue({ id: 1 } as any);
    });

    it("should provision a test charger with strictly 1 socket when socketCount is 1", async () => {
      const result = await simulatorService.quickProvision(1, "TEST-UNIT", { socketCount: 1 });
      expect(result.charger.charger_id).toBe(88);
      expect(result.chargeGroup.name).toBe("Virtual Test Lab");
      expect(result.connectors.length).toBe(1);
      expect(result.connectors[0].name).toContain("Channel 1");
      expect(prisma.evse.create).toHaveBeenCalledTimes(1);
    });

    it("should provision a test charger with 2 sockets when socketCount is 2", async () => {
      const result = await simulatorService.quickProvision(1, "TEST-UNIT", { socketCount: 2 });
      expect(result.connectors.length).toBe(2);
      expect(prisma.evse.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("Multi-Charger Simulator Testbed Operations", () => {
    it("should get all simulated chargers associated with Virtual Test Lab", async () => {
      jest.spyOn(prisma.chargeGroup, "findFirst").mockResolvedValue({
        id: 5,
        name: "Virtual Test Lab",
      } as any);
      jest.spyOn(prisma.chargingStation, "findFirst").mockResolvedValue({
        id: 10,
        station_name: "Virtual Test Lab Station",
      } as any);
      jest.spyOn(prisma.charger, "findMany").mockResolvedValue([
        {
          charger_id: 1,
          name: "SIM-LAB-01",
          chargeGroupId: 5,
          evses: [{ id: 1, evse_id: 1, connectors: [{ connector_id: 1 }] }],
        },
        {
          charger_id: 2,
          name: "SIM-LAB-02",
          chargeGroupId: 5,
          evses: [
            { id: 2, evse_id: 1, connectors: [{ connector_id: 2 }] },
            { id: 3, evse_id: 2, connectors: [{ connector_id: 3 }] },
          ],
        },
      ] as any);

      const chargers = await simulatorService.getSimulatedChargers();
      expect(chargers.length).toBe(2);
      expect(chargers[0].isSimulated).toBe(true);
      expect(chargers[0].evses[0].connectors.length).toBe(1);
      expect(chargers[1].evses.length).toBe(2);
    });

    it("should delete simulated charger and stop its session", async () => {
      jest.spyOn(prisma.charger, "findFirst").mockResolvedValue({
        charger_id: 99,
        name: "SIM-TO-DELETE",
        evses: [],
      } as any);
      jest.spyOn(prisma.charger, "delete").mockResolvedValue({} as any);
      jest.spyOn(prisma.ocppLog, "deleteMany").mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.chargerConfiguration, "deleteMany").mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.meterValue, "deleteMany").mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.transaction, "deleteMany").mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.evse, "deleteMany").mockResolvedValue({ count: 0 } as any);

      const deleted = await simulatorService.deleteSimulatedCharger(99);
      expect(deleted).toBe(true);
      expect(prisma.charger.delete).toHaveBeenCalledWith({ where: { charger_id: 99 } });
    });
  });

  describe("Automated Test Suite Runner", () => {
    let instance: SimulatedChargerInstance;

    beforeEach(() => {
      instance = new SimulatedChargerInstance({
        chargerId: 50,
        chargerName: "SIM-SUITE-RUNNER",
      });
      jest.spyOn(simulatorService, "getInstance").mockReturnValue(instance);
    });

    afterEach(() => {
      instance.disconnect();
    });

    it("should run Happy Path test suite and return all steps passed", async () => {
      jest.spyOn(instance, "connect").mockResolvedValue();
      jest.spyOn(instance, "sendCall").mockImplementation(async (action: string) => {
        if (action === "BootNotification") return { status: "Accepted", interval: 60 };
        if (action === "Authorize") return { idTagInfo: { status: "Accepted" } };
        if (action === "StartTransaction") return { transactionId: 10101 };
        return { status: "Accepted" };
      });

      const report = await simulatorService.runTestSuite(50, "happy_path");
      expect(report.suiteId).toBe("happy_path");
      expect(report.passed).toBe(true);
      expect(report.steps.length).toBeGreaterThanOrEqual(6);
      expect(report.steps.every((s: any) => s.status === "passed")).toBe(true);
    });

    it("should run Smart Charging test suite", async () => {
      jest.spyOn(instance, "connect").mockResolvedValue();
      jest.spyOn(instance, "sendCall").mockImplementation(async (action: string) => {
        if (action === "BootNotification") return { status: "Accepted" };
        if (action === "StartTransaction") return { transactionId: 20202 };
        return { status: "Accepted" };
      });

      const report = await simulatorService.runTestSuite(50, "smart_charging");
      expect(report.suiteId).toBe("smart_charging");
      expect(report.passed).toBe(true);
    });
  });

  describe("Charger Templates", () => {
    it("should return the catalog of 8 realistic hardware templates", () => {
      const templates = simulatorService.getTemplates();
      expect(templates.length).toBe(8);

      const alfen = simulatorService.getTemplateById("alfen-eve-single");
      expect(alfen).toBeDefined();
      expect(alfen?.vendor).toBe("Alfen");
      expect(alfen?.powerCapacityKw).toBe(22.0);

      const alpitronic = simulatorService.getTemplateById("alpitronic-hyc300-hpc");
      expect(alpitronic).toBeDefined();
      expect(alpitronic?.vendor).toBe("Alpitronic");
      expect(alpitronic?.powerCapacityKw).toBe(300.0);
      expect(alpitronic?.defaultProtocol).toBe("ocpp2.1");

      const v2g = simulatorService.getTemplateById("wallbox-quasar2-v2g");
      expect(v2g).toBeDefined();
      expect(v2g?.category).toBe("V2G_BIDIRECTIONAL");
    });
  });
});
