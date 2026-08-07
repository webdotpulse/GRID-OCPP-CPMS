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

jest.unstable_mockModule('../../config/database.js', () => ({
  prisma: {
    meterValue: {
      createMany: mockPrismaMeterValueCreateMany,
    },
    transaction: {
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
});
