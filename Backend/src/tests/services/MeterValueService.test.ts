import { jest } from '@jest/globals';

const mockRedisRpush = jest.fn() as any;
const mockRedisLtrim = jest.fn() as any;
const mockRedisExists = jest.fn() as any;
const mockRedisRename = jest.fn() as any;
const mockRedisLrange = jest.fn() as any;
const mockRedisDel = jest.fn() as any;
const mockPrismaMeterValueCreateMany = jest.fn() as any;
const mockPrismaTxUpdateMany = jest.fn() as any;

jest.unstable_mockModule('../../config/redis.js', () => ({
  redisClient: {
    rpush: mockRedisRpush,
    ltrim: mockRedisLtrim,
    exists: mockRedisExists,
    rename: mockRedisRename,
    lrange: mockRedisLrange,
    del: mockRedisDel,
  },
}));

const mockPrismaTxFindFirst = jest.fn() as any;

jest.unstable_mockModule('../../config/database.js', () => ({
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

const importPromise = import('../../services/MeterValueService.js');

describe("MeterValueService", () => {
  let MeterValueService: any;

  beforeAll(async () => {
    const module = await importPromise;
    MeterValueService = module.MeterValueService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addMeterValue", () => {
    it("should push payload to Redis list and trim key length", async () => {
      mockRedisRpush.mockResolvedValue(1);
      mockRedisLtrim.mockResolvedValue("OK");

      const payload = {
        transactionId: "TX-100",
        chargerId: 1,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
        timestamp: new Date(),
      };

      await MeterValueService.addMeterValue(payload);

      expect(mockRedisRpush).toHaveBeenCalledWith(
        "meter_values_list",
        expect.stringContaining("TX-100")
      );
      expect(mockRedisLtrim).toHaveBeenCalledWith("meter_values_list", -100000, -1);
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
