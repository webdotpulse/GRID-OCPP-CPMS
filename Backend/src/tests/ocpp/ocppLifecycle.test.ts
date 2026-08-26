import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as queueManager from '../../queues/queueManager.js';
import * as v16Handlers from '../../ocpp/handlers/v16Handlers.js';

describe("OCPP 1.6 Lifecycle Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma.ocppLog, 'create').mockResolvedValue({} as any);
  });

  describe("handleBootNotification", () => {
    it("should accept boot notification and update charger status", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 1,
        name: "CP-001",
        chargeGroupId: null,
        quirkProfile: null,
      } as any);
      const updateSpy = jest.spyOn(prisma.charger, 'update').mockResolvedValue({ charger_id: 1, name: "CP-001" } as any);

      const response = await v16Handlers.handleBootNotification(1, {
        chargePointVendor: "TestVendor",
        chargePointModel: "TestModel",
        firmwareVersion: "v1.0.0",
      });

      expect(response.status).toBe("Accepted");
      expect(response.interval || response.heartbeatInterval).toBeGreaterThan(0);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { charger_id: 1 },
          data: expect.objectContaining({
            status: "active",
            manufacturer: "TestVendor",
            model: "TestModel",
          }),
        })
      );
    });
  });

  describe("handleAuthorize", () => {
    it("should return Accepted for a valid RFID tag", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 1,
        chargeGroupId: null,
        quirkProfile: null,
      } as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_tag: "TAG123456",
        active: true,
        name: "Test User",
      } as any);

      const response = await v16Handlers.handleAuthorize(1, {
        idTag: "TAG123456",
      });

      expect(response.idTagInfo.status).toBe("Accepted");
    });

    it("should return Invalid for an unknown RFID tag", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 1,
        chargeGroupId: null,
        quirkProfile: null,
      } as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.vehicleContractCertificate, 'findUnique').mockResolvedValue(null);

      const response = await v16Handlers.handleAuthorize(1, {
        idTag: "UNKNOWN_TAG",
      });

      expect(response.idTagInfo.status).toBe("Invalid");
    });
  });

  describe("handleStartTransaction", () => {
    it("should start transaction and link rfidUserId and parsed connectorId", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 1,
        chargeGroupId: null,
        quirkProfile: null,
        charging_station_id: null,
      } as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 42,
        rfid_tag: "TAG123",
        active: true,
      } as any);
      const txCreateSpy = jest.spyOn(prisma.transaction, 'create').mockResolvedValue({
        id: 10,
        transactionId: "12345",
        charger: { charger_id: 1, charging_station_id: null, chargeGroupId: null },
      } as any);
      jest.spyOn(prisma.rfidSession, 'create').mockResolvedValue({ id: 1 } as any);
      jest.spyOn(prisma.connector, 'findFirst').mockResolvedValue({ connector_id: 1 } as any);
      jest.spyOn(prisma.connector, 'update').mockResolvedValue({} as any);

      const response = await v16Handlers.handleStartTransaction(1, {
        connectorId: 1,
        idTag: "TAG123",
        meterStart: 1000,
        timestamp: new Date().toISOString(),
      });

      expect(response.idTagInfo.status).toBe("Accepted");
      expect(txCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            connectorName: "Channel 1",
            rfidUserId: 42,
            initialMeterValue: 1000,
            status: "charging",
          }),
        })
      );
    });
  });

  describe("handleStopTransaction (OCPP-01)", () => {
    it("should acknowledge stop transaction and enqueue billing calculation", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 1,
        chargeGroupId: null,
        quirkProfile: null,
      } as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        id: 10,
        transactionId: "12345",
        connectorName: "Channel 1",
        initialMeterValue: 1000,
        startTime: new Date(Date.now() - 3600000),
        charger_id: 1,
      } as any);
      const billingSpy = jest.spyOn(queueManager, 'enqueueBillingJob').mockResolvedValue(undefined as any);

      const response = await v16Handlers.handleStopTransaction(1, {
        transactionId: 12345,
        meterStop: 5000,
        timestamp: new Date().toISOString(),
        transactionData: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [{ value: "5000", measurand: "Energy.Active.Import.Register" }],
          },
        ],
      });

      expect(response.idTagInfo.status).toBe("Accepted");
      expect(billingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chargerId: 1,
          transactionId: "12345",
          meterStop: 5000,
        })
      );
    });

    it("should correctly handle StopTransaction without final meter values", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 1,
        chargeGroupId: null,
        quirkProfile: null,
      } as any);
      const billingSpy = jest.spyOn(queueManager, 'enqueueBillingJob').mockResolvedValue(undefined as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        id: 11,
        transactionId: "67890",
        connectorName: "Connector 2",
        initialMeterValue: 0,
        startTime: new Date(Date.now() - 1800000),
        charger_id: 1,
      } as any);

      const response = await v16Handlers.handleStopTransaction(1, {
        transactionId: 67890,
        meterStop: 2500,
        timestamp: new Date().toISOString(),
      });

      expect(response.idTagInfo.status).toBe("Accepted");
      expect(billingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chargerId: 1,
          transactionId: "67890",
          meterStop: 2500,
        })
      );
    });
  });
});
