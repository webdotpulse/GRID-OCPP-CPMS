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
  });

  describe("Quick Provisioning", () => {
    it("should provision a complete test charging station, charger, EVSEs, and RFID passes", async () => {
      jest.spyOn(prisma.chargingStation, "findFirst").mockResolvedValue(null);
      jest.spyOn(prisma.chargingStation, "create").mockResolvedValue({
        id: 10,
        station_name: "Virtual Test Lab Station",
      } as any);

      jest.spyOn(prisma.charger, "create").mockResolvedValue({
        charger_id: 88,
        name: "SIM-LAB-TEST",
        model: "GridSim-Pro-2026",
      } as any);

      jest.spyOn(prisma.evse, "create")
        .mockResolvedValueOnce({ id: 1, evse_id: 1, charger_id: 88 } as any)
        .mockResolvedValueOnce({ id: 2, evse_id: 2, charger_id: 88 } as any);

      jest.spyOn(prisma.connector, "create").mockResolvedValue({ id: 1 } as any);

      jest.spyOn(prisma.rfidUser, "findUnique").mockResolvedValue(null);
      jest.spyOn(prisma.rfidUser, "create").mockResolvedValue({ id: 1 } as any);

      const result = await simulatorService.quickProvision(1, "TEST-UNIT");
      expect(result.charger.charger_id).toBe(88);
      expect(result.station.id).toBe(10);
      expect(result.connectors.length).toBe(2);
      expect(result.testTags.length).toBe(2);
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
