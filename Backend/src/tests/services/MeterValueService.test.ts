import { jest } from '@jest/globals';

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
    it("should enqueue payload to BullMQ meter values queue", async () => {
      mockEnqueueMeterValue.mockResolvedValue("job-100");

      const payload = {
        transactionId: "TX-100",
        chargerId: 1,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
        timestamp: new Date(),
      };

      await MeterValueService.addMeterValue(payload);

      expect(mockEnqueueMeterValue).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: "TX-100",
          chargerId: 1,
          socValue: 80,
          currentValue: 16,
          voltageValue: 230,
        })
      );
    });
  });

  describe("processMeterValuesBatch (OCPP-02)", () => {
    it("should calculate net session energy consumed by subtracting initialMeterValue", async () => {
      mockRedisExists.mockResolvedValue(1);
      mockRedisRename.mockResolvedValue("OK");
      mockRedisLrange.mockResolvedValue([
        JSON.stringify({
          transactionId: "TX-999",
          chargerId: 1,
          connectorId: 1,
          energyValue: 2455000, // Absolute cumulative meter reading in Wh
          powerValue: 11000,
          socValue: 75,
          timestamp: new Date().toISOString(),
        }),
      ]);
      mockRedisDel.mockResolvedValue(1);
      mockPrismaMeterValueCreateMany.mockResolvedValue({ count: 1 });
      mockPrismaTxFindFirst.mockResolvedValue({
        initialMeterValue: 2450000, // Initial meter reading at session start
      });
      mockPrismaTxUpdateMany.mockResolvedValue({ count: 1 });

      await MeterValueService.processMeterValuesBatch();

      expect(mockPrismaTxFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: "TX-999" },
          select: { initialMeterValue: true },
        })
      );
      // Net session energy = 2455000 - 2450000 = 5000 Wh (5 kWh)
      expect(mockPrismaTxUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: "TX-999", status: { not: "completed" } },
          data: expect.objectContaining({
            energyConsumed: 5000,
            currentPower: 11000,
            soc: 75,
            status: "charging",
          }),
        })
      );
    });
  });
});
