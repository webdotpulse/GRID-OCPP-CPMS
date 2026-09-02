import { jest } from '@jest/globals';

const mockRedisScan = jest.fn() as any;
const mockRedisGet = jest.fn() as any;
const mockRedisSet = jest.fn() as any;
const mockRedisDel = jest.fn() as any;
const mockRedisHset = jest.fn() as any;
const mockRedisHgetall = jest.fn() as any;
const mockRedisExpire = jest.fn() as any;

jest.unstable_mockModule('../../config/redis.js', () => ({
  redisClient: {
    scan: mockRedisScan,
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    hset: mockRedisHset,
    hgetall: mockRedisHgetall,
    expire: mockRedisExpire,
    publish: jest.fn(),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    on: jest.fn(),
  },
  redisPublisher: {
    publish: jest.fn(),
  },
}));

describe("ChargerRegistry (OCPP-05)", () => {
  let chargerRegistry: any;

  beforeAll(async () => {
    const module = await import('../../ocpp/chargerRegistry.js');
    chargerRegistry = module.chargerRegistry;
  });

  afterAll(() => {
    chargerRegistry.stopOfflineMonitor();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getConnectedChargers", () => {
    it("should retrieve all connected charger IDs using cursor-based SCAN loop", async () => {
      mockRedisScan
        .mockResolvedValueOnce(["42", ["charger:101:session", "charger:102:session"]])
        .mockResolvedValueOnce(["0", ["charger:103:session"]]);

      const connectedChargers = await chargerRegistry.getConnectedChargers();

      expect(mockRedisScan).toHaveBeenCalledWith("0", "MATCH", "charger:*:session", "COUNT", 100);
      expect(mockRedisScan).toHaveBeenCalledWith("42", "MATCH", "charger:*:session", "COUNT", 100);
      expect(connectedChargers).toEqual([101, 102, 103]);
    });

    it("should fallback to local chargers if redis throws", async () => {
      mockRedisScan.mockRejectedValueOnce(new Error("Redis connection error"));

      const connectedChargers = await chargerRegistry.getConnectedChargers();

      expect(Array.isArray(connectedChargers)).toBe(true);
    });
  });
});
