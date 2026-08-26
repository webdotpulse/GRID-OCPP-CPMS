import { jest } from '@jest/globals';

<<<<<<< HEAD
const mockRedisRpush = jest.fn() as any;
const mockRedisLtrim = jest.fn() as any;
const mockRedisExists = jest.fn() as any;
const mockRedisRename = jest.fn() as any;
const mockRedisLrange = jest.fn() as any;
const mockRedisDel = jest.fn() as any;
const mockPrismaMeterValueCreateMany = jest.fn() as any;
const mockPrismaTxFindFirst = jest.fn() as any;
const mockPrismaTxUpdateMany = jest.fn() as any;
const mockEnqueueMeterValue = jest.fn() as any;

jest.mock('../../config/redis.js', () => ({
  redisClient: {
    rpush: mockRedisRpush,
    ltrim: mockRedisLtrim,
    exists: mockRedisExists,
    rename: mockRedisRename,
    lrange: mockRedisLrange,
    del: mockRedisDel,
    get: jest.fn().mockResolvedValue(null as never),
    set: jest.fn().mockResolvedValue("OK" as never),
  },
  redisPublisher: {
    publish: jest.fn().mockResolvedValue(1 as never),
  },
}));

jest.mock('../../config/database.js', () => ({
  prisma: {
    meterValue: {
      createMany: mockPrismaMeterValueCreateMany,
    },
    transaction: {
      findFirst: mockPrismaTxFindFirst,
      updateMany: mockPrismaTxUpdateMany,
    },
    rfidSession: {
      updateMany: jest.fn(),
    },
    diagnosticEvent: {
      createMany: jest.fn(),
    },
  },
}));

jest.mock('../../queues/queueManager.js', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
}));
=======
const mockEnqueueMeterValue = jest.fn() as any;
const mockProcessMeterValuesBatch = jest.fn() as any;

jest.unstable_mockModule('../../queues/queueManager', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
}));
jest.unstable_mockModule('../../queues/queueManager.js', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
}));

jest.unstable_mockModule('../../workers/meterValuesWorker', () => ({
  processMeterValuesBatch: mockProcessMeterValuesBatch,
}));
jest.unstable_mockModule('../../workers/meterValuesWorker.js', () => ({
  processMeterValuesBatch: mockProcessMeterValuesBatch,
}));
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)

describe("MeterValueService", () => {
  let MeterValueService: any;

  beforeAll(async () => {
    const module = await import('../../services/MeterValueService.js');
    MeterValueService = module.MeterValueService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addMeterValue", () => {
<<<<<<< HEAD
    it("should enqueue payload to BullMQ meter values queue", async () => {
      mockEnqueueMeterValue.mockResolvedValue("job-100");
=======
    it("should push payload to BullMQ meter values queue", async () => {
      mockEnqueueMeterValue.mockResolvedValue(undefined);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)

      const payload = {
        transactionId: "TX-100",
        chargerId: 1,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
        timestamp: new Date(),
      };

      await MeterValueService.addMeterValue(payload);

<<<<<<< HEAD
      expect(mockEnqueueMeterValue).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: "TX-100",
          chargerId: 1,
          socValue: 80,
          currentValue: 16,
          voltageValue: 230,
        })
      );
=======
      expect(mockEnqueueMeterValue).toHaveBeenCalledWith(payload);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
    });
  });

  describe("processMeterValuesBatch", () => {
    it("should delegate to worker batch processor", async () => {
      mockProcessMeterValuesBatch.mockResolvedValue(undefined);

      const payloads = [
        {
          transactionId: "TX-999",
          chargerId: 1,
          connectorId: 1,
          energyValue: 2455000,
          powerValue: 11000,
          socValue: 75,
          currentValue: 16,
          voltageValue: 230,
          timestamp: new Date(),
        },
      ];

      await MeterValueService.processMeterValuesBatch(payloads);

      expect(mockProcessMeterValuesBatch).toHaveBeenCalledWith(payloads);
    });
  });
});
