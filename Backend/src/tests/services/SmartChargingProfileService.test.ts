import { jest } from "@jest/globals";

const mockPrismaChargerFindUnique = jest.fn() as any;
const mockPrismaProfileFindMany = jest.fn() as any;
const mockPrismaProfileUpsert = jest.fn() as any;
const mockPrismaProfileDeleteMany = jest.fn() as any;

jest.mock("../../config/database.js", () => ({
  prisma: {
    charger: {
      findUnique: mockPrismaChargerFindUnique,
    },
    chargingProfile: {
      findMany: mockPrismaProfileFindMany,
      upsert: mockPrismaProfileUpsert,
      deleteMany: mockPrismaProfileDeleteMany,
    },
  },
}));

jest.mock("../../config/redis.js", () => ({
  redisPublisher: {
    publish: jest.fn().mockResolvedValue(1 as never),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    psubscribe: jest.fn(),
    on: jest.fn(),
  },
  redisClient: {
    get: jest.fn().mockResolvedValue(null as never),
    set: jest.fn().mockResolvedValue("OK" as never),
    del: jest.fn().mockResolvedValue(1 as never),
    hset: jest.fn().mockResolvedValue(1 as never),
    hget: jest.fn().mockResolvedValue(null as never),
    expire: jest.fn().mockResolvedValue(1 as never),
    exists: jest.fn().mockResolvedValue(1 as never),
  },
}));

describe("Smart Charging Composite Schedule Engine (PRT-02)", () => {
  let SmartChargingProfileService: any;

  beforeAll(async () => {
    const mod = await import("../../services/SmartChargingProfileService.js");
    SmartChargingProfileService = mod.SmartChargingProfileService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unit Conversions (Amperes <-> Watts)", () => {
    it("should convert Amperes to Watts for 3-phase (230V)", () => {
      // 16A * 230V * 3 = 11,040W
      const watts = SmartChargingProfileService.convertChargingRate(16, "A", "W", 3, 230);
      expect(watts).toBe(11040);
    });

    it("should convert Watts to Amperes for 3-phase (230V)", () => {
      // 11040W / (230V * 3) = 16A
      const amps = SmartChargingProfileService.convertChargingRate(11040, "W", "A", 3, 230);
      expect(amps).toBe(16);
    });

    it("should convert Amperes to Watts for 1-phase (230V)", () => {
      // 32A * 230V * 1 = 7,360W
      const watts = SmartChargingProfileService.convertChargingRate(32, "A", "W", 1, 230);
      expect(watts).toBe(7360);
    });

    it("should return the exact same value if fromUnit equals toUnit", () => {
      const same = SmartChargingProfileService.convertChargingRate(32, "A", "A", 3, 230);
      expect(same).toBe(32);
    });
  });

  describe("Composite Schedule Calculation", () => {
    it("should fallback to charger physical capacity when no profiles are defined", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        power_capacity: 22, // 22 kW = 22,000 W
      });
      mockPrismaProfileFindMany.mockResolvedValue([]);

      const result = await SmartChargingProfileService.calculateCompositeSchedule(1, 1, 86400, "A");

      expect(result.status).toBe("Accepted");
      expect(result.chargingRateUnit).toBe("A");
      expect(result.chargingSchedulePeriod).toHaveLength(1);
      // 22000 / (230 * 3) = 31.88 -> 31.9A
      expect(result.chargingSchedulePeriod[0].limit).toBe(31.9);
      expect(result.chargingSchedulePeriod[0].startPeriod).toBe(0);
    });

    it("should resolve stack level precedence (higher stack level wins)", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        power_capacity: 22,
      });

      // Stack level 0 = 10A, Stack level 1 = 25A
      mockPrismaProfileFindMany.mockResolvedValue([
        {
          id: 1,
          chargingProfileId: 101,
          chargingProfilePurpose: "TxDefaultProfile",
          stackLevel: 1,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 25, numberPhases: 3 }],
          },
        },
        {
          id: 2,
          chargingProfileId: 100,
          chargingProfilePurpose: "TxDefaultProfile",
          stackLevel: 0,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 10, numberPhases: 3 }],
          },
        },
      ]);

      const result = await SmartChargingProfileService.calculateCompositeSchedule(1, 1, 86400, "A");

      expect(result.status).toBe("Accepted");
      expect(result.chargingSchedulePeriod[0].limit).toBe(25);
    });

    it("should prioritize TxProfile over TxDefaultProfile", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        power_capacity: 22,
      });

      mockPrismaProfileFindMany.mockResolvedValue([
        {
          id: 1,
          chargingProfileId: 200,
          chargingProfilePurpose: "TxDefaultProfile",
          stackLevel: 0,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 32, numberPhases: 3 }],
          },
        },
        {
          id: 2,
          chargingProfileId: 201,
          chargingProfilePurpose: "TxProfile",
          stackLevel: 0,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 12, numberPhases: 3 }],
          },
        },
      ]);

      const result = await SmartChargingProfileService.calculateCompositeSchedule(1, 1, 86400, "A");

      expect(result.status).toBe("Accepted");
      // TxProfile (12A) overrides TxDefaultProfile (32A)
      expect(result.chargingSchedulePeriod[0].limit).toBe(12);
    });

    it("should enforce ChargePointMaxProfile hard ceiling limit", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        power_capacity: 22,
      });

      // ChargePointMaxProfile = 16A, TxProfile = 32A -> Must be capped at 16A
      mockPrismaProfileFindMany.mockResolvedValue([
        {
          id: 1,
          chargingProfileId: 300,
          chargingProfilePurpose: "ChargePointMaxProfile",
          stackLevel: 0,
          connectorId: 0,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 16, numberPhases: 3 }],
          },
        },
        {
          id: 2,
          chargingProfileId: 301,
          chargingProfilePurpose: "TxProfile",
          stackLevel: 2,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 32, numberPhases: 3 }],
          },
        },
      ]);

      const result = await SmartChargingProfileService.calculateCompositeSchedule(1, 1, 86400, "A");

      expect(result.status).toBe("Accepted");
      expect(result.chargingSchedulePeriod[0].limit).toBe(16);
    });

    it("should merge multi-period schedules with varying time offsets and compress redundant slices", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        power_capacity: 22,
      });

      // Profile 1 (TxDefault): 0s -> 16A, 3600s -> 32A
      // Profile 2 (MaxProfile): 0s -> 24A, 7200s -> 10A
      // Expected composite periods:
      // 0s - 3600s: min(16, 24) = 16A
      // 3600s - 7200s: min(32, 24) = 24A
      // 7200s+: min(32, 10) = 10A
      mockPrismaProfileFindMany.mockResolvedValue([
        {
          id: 1,
          chargingProfileId: 400,
          chargingProfilePurpose: "ChargePointMaxProfile",
          stackLevel: 0,
          connectorId: 0,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [
              { startPeriod: 0, limit: 24, numberPhases: 3 },
              { startPeriod: 7200, limit: 10, numberPhases: 3 },
            ],
          },
        },
        {
          id: 2,
          chargingProfileId: 401,
          chargingProfilePurpose: "TxDefaultProfile",
          stackLevel: 1,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [
              { startPeriod: 0, limit: 16, numberPhases: 3 },
              { startPeriod: 3600, limit: 32, numberPhases: 3 },
            ],
          },
        },
      ]);

      const result = await SmartChargingProfileService.calculateCompositeSchedule(1, 1, 86400, "A");

      expect(result.status).toBe("Accepted");
      expect(result.chargingSchedulePeriod).toHaveLength(3);

      expect(result.chargingSchedulePeriod[0]).toEqual({
        startPeriod: 0,
        limit: 16,
        numberPhases: 3,
      });

      expect(result.chargingSchedulePeriod[1]).toEqual({
        startPeriod: 3600,
        limit: 24,
        numberPhases: 3,
      });

      expect(result.chargingSchedulePeriod[2]).toEqual({
        startPeriod: 7200,
        limit: 10,
        numberPhases: 3,
      });
    });

    it("should calculate composite schedule in Watts when chargingRateUnit is 'W'", async () => {
      mockPrismaChargerFindUnique.mockResolvedValue({
        charger_id: 1,
        power_capacity: 22,
      });

      // Profile specified in Amperes (16A 3-phase = 11,040W)
      mockPrismaProfileFindMany.mockResolvedValue([
        {
          id: 1,
          chargingProfileId: 500,
          chargingProfilePurpose: "TxDefaultProfile",
          stackLevel: 0,
          connectorId: 1,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 16, numberPhases: 3 }],
          },
        },
      ]);

      const result = await SmartChargingProfileService.calculateCompositeSchedule(1, 1, 86400, "W");

      expect(result.status).toBe("Accepted");
      expect(result.chargingRateUnit).toBe("W");
      expect(result.chargingSchedulePeriod[0].limit).toBe(11040);
    });
  });

  describe("Profile Database Persistence", () => {
    it("should save and upsert a charging profile in the database", async () => {
      mockPrismaProfileUpsert.mockResolvedValue({ id: 10 });

      const profileData = {
        chargingProfileId: 999,
        stackLevel: 1,
        chargingProfilePurpose: "TxDefaultProfile" as const,
        chargingProfileKind: "Absolute" as const,
        chargingSchedule: {
          chargingRateUnit: "A" as const,
          chargingSchedulePeriod: [{ startPeriod: 0, limit: 16, numberPhases: 3 }],
        },
      };

      const res = await SmartChargingProfileService.saveChargingProfile(1, 1, profileData);

      expect(res.id).toBe(10);
      expect(mockPrismaProfileUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            chargerId_chargingProfileId: {
              chargerId: 1,
              chargingProfileId: 999,
            },
          },
        })
      );
    });

    it("should clear charging profiles matching criteria", async () => {
      mockPrismaProfileDeleteMany.mockResolvedValue({ count: 2 });

      const deletedCount = await SmartChargingProfileService.clearChargingProfiles(1, {
        chargingProfilePurpose: "TxProfile",
      });

      expect(deletedCount).toBe(2);
      expect(mockPrismaProfileDeleteMany).toHaveBeenCalledWith({
        where: {
          chargerId: 1,
          chargingProfilePurpose: "TxProfile",
        },
      });
    });
  });
});
