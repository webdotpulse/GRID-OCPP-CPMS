import { jest } from '@jest/globals';

const mockPrismaChargerUpdate = jest.fn() as any;
const mockPrismaChargerFindUnique = jest.fn() as any;
const mockPrismaRfidFindUnique = jest.fn() as any;
const mockPrismaTxCreate = jest.fn() as any;
const mockPrismaTxUpdate = jest.fn() as any;
const mockPrismaTxFindFirst = jest.fn() as any;
const mockPrismaTxUpdateMany = jest.fn() as any;
const mockPrismaRfidSessionCreate = jest.fn() as any;
const mockPrismaRfidSessionFindFirst = jest.fn() as any;
const mockPrismaRfidSessionUpdate = jest.fn() as any;
const mockPrismaConnectorFindFirst = jest.fn() as any;
const mockPrismaConnectorUpdate = jest.fn() as any;
const mockPrismaConnectorCreate = jest.fn() as any;
const mockPrismaMeterValueFindFirst = jest.fn() as any;
const mockPrismaMeterValueFindMany = jest.fn() as any;
const mockPrismaTariffFindFirst = jest.fn() as any;
const mockEnqueueMeterValue = jest.fn() as any;
const mockEnqueueStatusEvent = jest.fn() as any;
const mockEnqueueBillingEvent = jest.fn() as any;

<<<<<<< HEAD
jest.mock('../../config/database.js', () => ({
=======
const mockEnqueueMeterValue = jest.fn() as any;
const mockEnqueueStatusEvent = jest.fn() as any;
const mockEnqueueBillingJob = jest.fn() as any;

const mockPrisma = {
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  prisma: {
    charger: {
      update: mockPrismaChargerUpdate,
      findUnique: mockPrismaChargerFindUnique,
    },
    rfidUser: {
      findUnique: mockPrismaRfidFindUnique,
    },
    transaction: {
      create: mockPrismaTxCreate,
      update: mockPrismaTxUpdate,
      findFirst: mockPrismaTxFindFirst,
      updateMany: mockPrismaTxUpdateMany,
    },
    rfidSession: {
      create: mockPrismaRfidSessionCreate,
      findFirst: mockPrismaRfidSessionFindFirst,
      update: mockPrismaRfidSessionUpdate,
    },
    connector: {
      findFirst: mockPrismaConnectorFindFirst,
      update: mockPrismaConnectorUpdate,
      create: mockPrismaConnectorCreate,
    },
    ocppLog: {
      create: jest.fn().mockResolvedValue({} as never),
    },
    chargeGroupUser: {
      findUnique: jest.fn().mockResolvedValue(null as never),
    },
    meterValue: {
      createMany: jest.fn().mockResolvedValue({} as never),
      findFirst: mockPrismaMeterValueFindFirst,
      findMany: mockPrismaMeterValueFindMany,
    },
    tariff: {
      findFirst: mockPrismaTariffFindFirst,
    },
  },
};

jest.unstable_mockModule('../../queues/queueManager', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
  enqueueStatusEvent: mockEnqueueStatusEvent,
  enqueueBillingJob: mockEnqueueBillingJob,
}));
jest.unstable_mockModule('../../queues/queueManager.js', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
  enqueueStatusEvent: mockEnqueueStatusEvent,
  enqueueBillingJob: mockEnqueueBillingJob,
}));

<<<<<<< HEAD
jest.mock('../../config/redis.js', () => ({
=======
jest.unstable_mockModule('../../config/database', () => mockPrisma);
jest.unstable_mockModule('../../config/database.js', () => mockPrisma);

const mockRedis = {
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  redisClient: {
    get: jest.fn().mockResolvedValue(null as never),
    set: jest.fn().mockResolvedValue("OK" as never),
    del: jest.fn().mockResolvedValue(1 as never),
    scan: jest.fn().mockResolvedValue(["0", []] as never),
    keys: jest.fn().mockResolvedValue([] as never),
    hset: jest.fn().mockResolvedValue(1 as never),
    hgetall: jest.fn().mockResolvedValue({} as never),
    expire: jest.fn().mockResolvedValue(1 as never),
    publish: jest.fn().mockResolvedValue(1 as never),
    rpush: jest.fn().mockResolvedValue(1 as never),
    ltrim: jest.fn().mockResolvedValue("OK" as never),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    on: jest.fn(),
  },
  redisPublisher: {
    publish: jest.fn().mockResolvedValue(1 as never),
  },
};

<<<<<<< HEAD
jest.mock('../../queues/queueManager.js', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
  enqueueStatusEvent: mockEnqueueStatusEvent,
  enqueueBillingEvent: mockEnqueueBillingEvent,
}));
=======
jest.unstable_mockModule('../../config/redis', () => mockRedis);
jest.unstable_mockModule('../../config/redis.js', () => mockRedis);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)

describe("OCPP 1.6 Lifecycle Handlers", () => {
  let v16Handlers: any;

  beforeAll(async () => {
    v16Handlers = await import('../../ocpp/handlers/v16Handlers.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleBootNotification", () => {
    it("should accept boot notification and update charger status", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({ charger_id: 1, name: "CP-001" });
      mockPrismaChargerUpdate.mockResolvedValue({ charger_id: 1, name: "CP-001" });

      const response = await v16Handlers.handleBootNotification(1, {
        chargePointVendor: "TestVendor",
        chargePointModel: "TestModel",
        firmwareVersion: "v1.0.0",
      });

      expect(response.status).toBe("Accepted");
      expect(response.interval || response.heartbeatInterval).toBeGreaterThan(0);
      expect(mockPrismaChargerUpdate).toHaveBeenCalledWith(
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
      mockPrismaChargerFindUnique.mockResolvedValue({ charger_id: 1, chargeGroupId: null });
      mockPrismaRfidFindUnique.mockResolvedValue({
        rfid_tag: "TAG123456",
        active: true,
        name: "Test User",
      });

      const response = await v16Handlers.handleAuthorize(1, {
        idTag: "TAG123456",
      });

      expect(response.idTagInfo.status).toBe("Accepted");
    });

    it("should return Invalid for an unknown RFID tag", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({ charger_id: 1, chargeGroupId: null });
      mockPrismaRfidFindUnique.mockResolvedValue(null);

      const response = await v16Handlers.handleAuthorize(1, {
        idTag: "UNKNOWN_TAG",
      });

      expect(response.idTagInfo.status).toBe("Invalid");
    });
  });

  describe("handleStartTransaction", () => {
    it("should start transaction and link rfidUserId and parsed connectorId", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({ charger_id: 1 });
      mockPrismaRfidFindUnique.mockResolvedValue({
        rfid_user_id: 42,
        rfid_tag: "TAG123",
        active: true,
      });
      mockPrismaTxCreate.mockResolvedValue({
        id: 10,
        transactionId: "12345",
        charger: { charger_id: 1 },
      });
      mockPrismaConnectorFindFirst.mockResolvedValue({ connector_id: 1 });
      mockPrismaConnectorUpdate.mockResolvedValue({});

      const response = await v16Handlers.handleStartTransaction(1, {
        connectorId: 1,
        idTag: "TAG123",
        meterStart: 1000,
        timestamp: new Date().toISOString(),
      });

      expect(response.idTagInfo.status).toBe("Accepted");
      expect(mockPrismaTxCreate).toHaveBeenCalledWith(
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
<<<<<<< HEAD
    it("should correctly accept StopTransaction and enqueue billing event", async () => {
      mockEnqueueBillingEvent.mockResolvedValue("job-bill-1");
=======
    it("should acknowledge stop transaction and enqueue billing calculation", async () => {
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
      mockPrismaTxFindFirst.mockResolvedValue({
        id: 10,
        transactionId: "12345",
        connectorName: "Channel 1",
        initialMeterValue: 1000,
        startTime: new Date(Date.now() - 3600000),
        charger_id: 1,
      });
<<<<<<< HEAD
=======
      mockEnqueueBillingJob.mockResolvedValue(undefined);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)

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
<<<<<<< HEAD
      expect(mockEnqueueBillingEvent).toHaveBeenCalledWith(
=======
      expect(mockEnqueueBillingJob).toHaveBeenCalledWith(
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
        expect.objectContaining({
          chargerId: 1,
          transactionId: "12345",
          meterStop: 5000,
<<<<<<< HEAD
        })
      );
    });

    it("should correctly handle StopTransaction without final meter values", async () => {
      mockEnqueueBillingEvent.mockResolvedValue("job-bill-2");
      mockPrismaTxFindFirst.mockResolvedValue({
        id: 11,
        transactionId: "67890",
        connectorName: "Connector 2",
        initialMeterValue: 0,
        startTime: new Date(Date.now() - 1800000),
        charger_id: 1,
      });

      const response = await v16Handlers.handleStopTransaction(1, {
        transactionId: 67890,
        meterStop: 2500,
        timestamp: new Date().toISOString(),
      });

      expect(response.idTagInfo.status).toBe("Accepted");
      expect(mockEnqueueBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          chargerId: 1,
          transactionId: "67890",
          meterStop: 2500,
=======
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
        })
      );
    });
  });
});
