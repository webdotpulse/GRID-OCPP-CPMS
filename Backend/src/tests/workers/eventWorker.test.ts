import { jest } from "@jest/globals";

const mockPrismaChargerUpdate = jest.fn() as any;
const mockPrismaChargerFindUnique = jest.fn() as any;
const mockPrismaDiagnosticEventCreate = jest.fn() as any;
const mockPrismaEvseFindUnique = jest.fn() as any;
const mockPrismaEvseCreate = jest.fn() as any;
const mockPrismaConnectorFindFirst = jest.fn() as any;
const mockPrismaConnectorUpdate = jest.fn() as any;
const mockPrismaConnectorCreate = jest.fn() as any;
const mockPrismaTxFindFirst = jest.fn() as any;
const mockPrismaTxUpdate = jest.fn() as any;
const mockPrismaTariffFindFirst = jest.fn() as any;
const mockPrismaRfidSessionFindFirst = jest.fn() as any;
const mockPrismaRfidSessionUpdate = jest.fn() as any;
const mockRedisPublish = jest.fn() as any;

jest.mock("../../config/database.js", () => ({
  prisma: {
    charger: {
      update: mockPrismaChargerUpdate,
      findUnique: mockPrismaChargerFindUnique,
    },
    diagnosticEvent: {
      create: mockPrismaDiagnosticEventCreate,
    },
    evse: {
      findUnique: mockPrismaEvseFindUnique,
      create: mockPrismaEvseCreate,
    },
    connector: {
      findFirst: mockPrismaConnectorFindFirst,
      update: mockPrismaConnectorUpdate,
      create: mockPrismaConnectorCreate,
    },
    transaction: {
      findFirst: mockPrismaTxFindFirst,
      update: mockPrismaTxUpdate,
    },
    tariff: {
      findFirst: mockPrismaTariffFindFirst,
    },
    rfidSession: {
      findFirst: mockPrismaRfidSessionFindFirst,
      update: mockPrismaRfidSessionUpdate,
    },
  },
}));

jest.mock("../../config/redis.js", () => ({
  redisPublisher: {
    publish: mockRedisPublish,
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    on: jest.fn(),
  },
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
  },
}));

jest.mock("bullmq", () => {
  class MockWorker {
    on = jest.fn();
    close = jest.fn().mockResolvedValue(undefined as never);
  }
  class MockQueue {
    add = jest.fn();
    close = jest.fn().mockResolvedValue(undefined as never);
    on = jest.fn();
  }
  return {
    Worker: MockWorker,
    Queue: MockQueue,
  };
});

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK" as never),
  })),
}));

describe("BullMQ eventWorker", () => {
  let eventWorkerModule: any;

  beforeAll(async () => {
    eventWorkerModule = await import("../../workers/eventWorker.js");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processStatusEventJob", () => {
    it("should process Faulted status and increment consecutive errors", async () => {
      mockPrismaDiagnosticEventCreate.mockResolvedValue({ id: 1 });
      mockPrismaChargerUpdate.mockResolvedValue({ charger_id: 1 });
      mockPrismaEvseFindUnique.mockResolvedValue({ id: 10 });
      mockPrismaConnectorFindFirst.mockResolvedValue({ connector_id: 2 });
      mockPrismaConnectorUpdate.mockResolvedValue({});
      mockRedisPublish.mockResolvedValue(1);

      const job = {
        id: "status-job-1",
        data: {
          chargerId: 1,
          connectorId: 1,
          status: "Faulted",
          errorCode: "GroundFailure",
        },
      } as any;

      await eventWorkerModule.processStatusEventJob(job);

      expect(mockPrismaDiagnosticEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargerId: 1,
            connectorId: 1,
            type: "FaultedState",
            description: expect.stringContaining("GroundFailure"),
          }),
        })
      );

      expect(mockPrismaChargerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { charger_id: 1 },
          data: expect.objectContaining({
            consecutiveErrors: { increment: 1 },
          }),
        })
      );

      expect(mockRedisPublish).toHaveBeenCalledWith(
        "charger_status_updates",
        expect.stringContaining("Faulted")
      );
    });

    it("should reset consecutive errors on Available status", async () => {
      mockPrismaChargerUpdate.mockResolvedValue({ charger_id: 2 });
      mockPrismaEvseFindUnique.mockResolvedValue({ id: 20 });
      mockPrismaConnectorFindFirst.mockResolvedValue({ connector_id: 5 });
      mockPrismaConnectorUpdate.mockResolvedValue({});
      mockRedisPublish.mockResolvedValue(1);

      const job = {
        id: "status-job-2",
        data: {
          chargerId: 2,
          connectorId: 1,
          status: "Available",
        },
      } as any;

      await eventWorkerModule.processStatusEventJob(job);

      expect(mockPrismaChargerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { charger_id: 2 },
          data: expect.objectContaining({
            consecutiveErrors: 0,
          }),
        })
      );
    });
  });

  describe("processBillingJob", () => {
    it("should process session completion, calculate dynamic tariff, and finalize transaction", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        tariffs: [],
      });
      mockPrismaTxFindFirst.mockResolvedValue({
        id: 99,
        transactionId: "TX-BILL-1",
        initialMeterValue: 10000,
        startTime: new Date(Date.now() - 3600000),
        connectorName: "Channel 1",
        charger: { charger_id: 1, charging_station_id: 10, chargeGroupId: null },
      });
      mockPrismaTariffFindFirst.mockResolvedValue({
        electricity_rate: 0.35,
        tariffType: "FIXED",
      });
      mockPrismaTxUpdate.mockResolvedValue({
        id: 99,
        charger: { charger_id: 1, charging_station_id: 10, chargeGroupId: null },
      });
      mockPrismaConnectorFindFirst.mockResolvedValue({ connector_id: 1 });
      mockPrismaConnectorUpdate.mockResolvedValue({});
      mockPrismaRfidSessionFindFirst.mockResolvedValue(null);

      const job = {
        id: "bill-job-1",
        data: {
          chargerId: 1,
          transactionId: "TX-BILL-1",
          meterStop: 25000,
          timestamp: new Date().toISOString(),
          reason: "EVDisconnected",
        },
      } as any;

      await eventWorkerModule.processBillingJob(job);

      expect(mockPrismaTxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99 },
          data: expect.objectContaining({
            finalMeterValue: 25000,
            status: "completed",
            stopReason: "EVDisconnected",
            energyConsumed: 15000, // 25000 - 10000
          }),
        })
      );
    });
  });
});
