import { jest } from '@jest/globals';
import { redisClient } from '../config/redis.js';
import { prisma } from '../config/database.js';
import { EpexSpotService } from '../services/EpexSpotService.js';

describe("EpexSpotService", () => {
  let mockTimestamp: Date;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(redisClient, "set").mockResolvedValue("OK" as any);
    mockTimestamp = new Date('2025-01-01T14:30:00Z'); // Note the 30 minutes to test normalization
  });

  describe("getPriceForTimestamp", () => {
    it("should return the exact spot price from Redis cache if available", async () => {
      const mockRedisGet = jest.spyOn(redisClient, "get").mockResolvedValue("85.5" as any);
      const targetTime = new Date('2025-01-01T14:00:00Z'); // Normalized to start of hour

      const price = await EpexSpotService.getPriceForTimestamp("BE", mockTimestamp);

      expect(mockRedisGet).toHaveBeenCalledWith(`epex_price:EnergyZero:BE:${targetTime.toISOString()}`);
      expect(price).toBe(85.5);

      mockRedisGet.mockRestore();
    });

    it("should fallback to the most recent price if exact hour is missing from Redis", async () => {
      const mockRedisGet = jest.spyOn(redisClient, "get").mockResolvedValue(null as any);
      const mockPrismaFindUnique = jest.spyOn(prisma.epexSpotPrice, "findUnique").mockResolvedValue(null as any);
      const mockPrismaFindFirst = jest.spyOn(prisma.epexSpotPrice, "findFirst").mockResolvedValue({ pricePerMwh: 72.1 } as any);

      const price = await EpexSpotService.getPriceForTimestamp("BE", mockTimestamp);

      expect(mockRedisGet).toHaveBeenCalledTimes(1);
      expect(price).toBe(72.1);

      mockRedisGet.mockRestore();
      mockPrismaFindUnique.mockRestore();
      mockPrismaFindFirst.mockRestore();
    });

    it("should return the exact spot price from the database and cache it", async () => {
      const targetTime = new Date('2025-01-01T14:00:00Z');
      const mockRedisGet = jest.spyOn(redisClient, "get").mockResolvedValue(null as any);
      const mockRedisSet = jest.spyOn(redisClient, "set").mockResolvedValue("OK" as any);
      const mockPrismaFindUnique = jest.spyOn(prisma.epexSpotPrice, "findUnique").mockResolvedValue({
        timestamp: targetTime,
        pricePerMwh: 90.0,
      } as any);

      const price = await EpexSpotService.getPriceForTimestamp("BE", mockTimestamp);

      expect(mockPrismaFindUnique).toHaveBeenCalledWith({
        where: {
          timestamp_country_provider: {
            timestamp: targetTime,
            country: "BE",
            provider: "EnergyZero"
          }
        }
      });
      expect(mockRedisSet).toHaveBeenCalledWith(
        `epex_price:EnergyZero:BE:${targetTime.toISOString()}`,
        "90",
        "EX",
        86400 // 24 hours TTL
      );
      expect(price).toBe(90.0);

      mockRedisGet.mockRestore();
      mockRedisSet.mockRestore();
      mockPrismaFindUnique.mockRestore();
    });

    it("should fallback to the database fallback if exact hour is missing from cache and DB", async () => {
      const mockRedisGet = jest.spyOn(redisClient, "get").mockResolvedValue(null as any);
      const mockPrismaFindUnique = jest.spyOn(prisma.epexSpotPrice, "findUnique").mockResolvedValue(null as any);
      const mockPrismaFindFirst = jest.spyOn(prisma.epexSpotPrice, "findFirst").mockResolvedValue({
        pricePerMwh: 65.4,
      } as any);

      const price = await EpexSpotService.getPriceForTimestamp("BE", mockTimestamp);

      expect(mockPrismaFindFirst).toHaveBeenCalledWith({
        where: {
          country: "BE",
          provider: "EnergyZero",
        },
        orderBy: { timestamp: "desc" }
      });
      expect(price).toBe(65.4);

      mockRedisGet.mockRestore();
      mockPrismaFindUnique.mockRestore();
      mockPrismaFindFirst.mockRestore();
    });

    it("should return null if price is completely unavailable", async () => {
      const mockRedisGet = jest.spyOn(redisClient, "get").mockResolvedValue(null as any);
      const mockPrismaFindUnique = jest.spyOn(prisma.epexSpotPrice, "findUnique").mockResolvedValue(null as any);
      const mockPrismaFindFirst = jest.spyOn(prisma.epexSpotPrice, "findFirst").mockResolvedValue(null as any);

      const price = await EpexSpotService.getPriceForTimestamp("BE", mockTimestamp);

      expect(price).toBeNull();

      mockRedisGet.mockRestore();
      mockPrismaFindUnique.mockRestore();
      mockPrismaFindFirst.mockRestore();
    });
  });
});
