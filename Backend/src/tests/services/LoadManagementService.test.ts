import { jest } from '@jest/globals';

const mockTransactionAggregate = jest.fn() as any;
const mockTransactionFindMany = jest.fn() as any;
const mockChargingStationFindUnique = jest.fn() as any;
const mockChargeGroupFindUnique = jest.fn() as any;
const mockChargingProfileUpsert = jest.fn() as any;
const mockChargingProfileDeleteMany = jest.fn() as any;
const mockChargingProfileFindMany = jest.fn() as any;
const mockChargingProfileFindUnique = jest.fn() as any;

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    transaction: {
      aggregate: mockTransactionAggregate,
      findMany: mockTransactionFindMany,
    },
    chargingStation: {
      findUnique: mockChargingStationFindUnique,
    },
    chargeGroup: {
      findUnique: mockChargeGroupFindUnique,
      findMany: jest.fn().mockResolvedValue([] as never),
    },
    chargingProfile: {
      upsert: mockChargingProfileUpsert,
      deleteMany: mockChargingProfileDeleteMany,
      findMany: mockChargingProfileFindMany,
      findUnique: mockChargingProfileFindUnique,
    }
  }
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

const mockSetChargingProfile = jest.fn() as any;
const mockClearChargingProfile = jest.fn() as any;

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => ({
  setChargingProfile: mockSetChargingProfile,
  clearChargingProfile: mockClearChargingProfile,
}));

describe("LoadManagementService", () => {
  let loadManagementService: any;

  beforeAll(async () => {
    const mod = await import("../../services/LoadManagementService.js");
    loadManagementService = mod.loadManagementService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetChargingProfile.mockResolvedValue({ status: "Accepted" });
    mockClearChargingProfile.mockResolvedValue({ status: "Accepted" });
    mockChargingProfileFindMany.mockResolvedValue([]);
    mockChargingProfileFindUnique.mockResolvedValue({ id: 100 });
  });

  describe("balanceChargeGroupLoadWithData - Water-Filling Demand Allocation", () => {
    it("should allocate power proportionally without wasting capacity on low-demand PHEVs", async () => {
      // Charge Group with 40 kW capacity -> safe limit = 38 kW (95%)
      const group = {
        id: 1,
        name: "Fleet Depot",
        maxPower: 40.0,
      };

      // 3 active transactions:
      // Tx 1: PHEV drawing 3.7 kW (capacity 22 kW)
      // Tx 2: EV drawing 20 kW (capacity 22 kW)
      // Tx 3: EV drawing 20 kW (capacity 22 kW)
      const now = new Date();
      const activeTransactions = [
        {
          id: 101,
          charger_id: 1,
          startTime: new Date(now.getTime() - 30000),
          currentPower: 3700, // 3.7 kW
          charger: { charger_id: 1, power_capacity: 22.0 },
        },
        {
          id: 102,
          charger_id: 2,
          startTime: new Date(now.getTime() - 20000),
          currentPower: 20000, // 20.0 kW
          charger: { charger_id: 2, power_capacity: 22.0 },
        },
        {
          id: 103,
          charger_id: 3,
          startTime: new Date(now.getTime() - 10000),
          currentPower: 20000, // 20.0 kW
          charger: { charger_id: 3, power_capacity: 22.0 },
        },
      ];

      await loadManagementService.balanceChargeGroupLoadWithData(group, activeTransactions);

      // Verify SetChargingProfile was dispatched for all 3 chargers
      expect(mockSetChargingProfile).toHaveBeenCalledTimes(3);

      const calls = mockSetChargingProfile.mock.calls.map((c: any) => c[0]);
      const limitsByCharger: Record<number, number> = {};
      calls.forEach((c: any) => {
        const limitW = c.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit;
        limitsByCharger[c.chargerId] = limitW;
      });

      // Total sum of all limits must NEVER exceed safeLimit (38 kW = 38,000 W)
      const totalAllocatedW = Object.values(limitsByCharger).reduce((sum, w) => sum + w, 0);
      expect(totalAllocatedW).toBeLessThanOrEqual(38000);

      // PHEV on Charger 1 should receive its desired power (~4.25 kW) and NOT waste a full 12.6 kW slice
      expect(limitsByCharger[1]).toBeLessThanOrEqual(5000);

      // EVs on Charger 2 and Charger 3 should receive the majority of remaining power (> 16 kW each)
      expect(limitsByCharger[2]).toBeGreaterThan(16000);
      expect(limitsByCharger[3]).toBeGreaterThan(16000);
    });

    it("should strictly enforce hard cap so total allocated power never exceeds safeLimitKw", async () => {
      // Group with 22 kW limit -> safe limit = 20.9 kW (20,900 W)
      const group = {
        id: 2,
        name: "Restricted Site",
        maxPower: 22.0,
      };

      // 2 chargers of 22 kW each both requesting full power
      const activeTransactions = [
        {
          id: 201,
          charger_id: 10,
          startTime: new Date(),
          currentPower: 22000,
          charger: { charger_id: 10, power_capacity: 22.0 },
        },
        {
          id: 202,
          charger_id: 11,
          startTime: new Date(),
          currentPower: 22000,
          charger: { charger_id: 11, power_capacity: 22.0 },
        },
      ];

      await loadManagementService.balanceChargeGroupLoadWithData(group, activeTransactions);

      expect(mockSetChargingProfile).toHaveBeenCalledTimes(2);

      const calls = mockSetChargingProfile.mock.calls.map((c: any) => c[0]);
      const totalW = calls.reduce((sum: number, c: any) => {
        return sum + c.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit;
      }, 0);

      // Must NEVER exceed safe limit (20,900 W) - eliminating the 200% overshoot bug!
      expect(totalW).toBeLessThanOrEqual(20900);
    });

    it("should clear profiles when theoretical max load drops safely below limit with hysteresis", async () => {
      // Group capacity 50 kW -> safe limit = 47.5 kW; 90% threshold = 42.75 kW
      const group = {
        id: 3,
        name: "Unconstrained Group",
        maxPower: 50.0,
      };

      // Only 1 active transaction with 22 kW capacity (22 kW <= 42.75 kW)
      const activeTransactions = [
        {
          id: 301,
          charger_id: 20,
          startTime: new Date(),
          currentPower: 11000,
          charger: { charger_id: 20, power_capacity: 22.0 },
        },
      ];

      await loadManagementService.balanceChargeGroupLoadWithData(group, activeTransactions);

      // Profiles should be cleared, no throttle SetChargingProfile dispatched
      expect(mockClearChargingProfile).toHaveBeenCalled();
      expect(mockSetChargingProfile).not.toHaveBeenCalled();
    });

    it("should NOT skip profile dispatch when a newly initiated transaction has currentPower = 0", async () => {
      const group = {
        id: 4,
        name: "New Tx Group",
        maxPower: 30.0, // safe limit 28.5 kW
      };

      // Existing DB profile matches exactly the calculated limit (14,250 W)
      mockChargingProfileFindMany.mockResolvedValue([
        {
          chargerId: 30,
          chargingProfileId: 100,
          chargingSchedule: {
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 14250 }],
          },
        },
      ]);

      const activeTransactions = [
        {
          id: 401,
          charger_id: 30,
          startTime: new Date(),
          currentPower: 0, // Just started! Has not reported power yet
          charger: { charger_id: 30, power_capacity: 22.0 },
        },
        {
          id: 402,
          charger_id: 31,
          startTime: new Date(),
          currentPower: 14000,
          charger: { charger_id: 31, power_capacity: 22.0 },
        },
      ];

      await loadManagementService.balanceChargeGroupLoadWithData(group, activeTransactions);

      // Charger 30 must NOT be skipped even though currentPower is 0
      const dispatchedChargerIds = mockSetChargingProfile.mock.calls.map((c: any) => c[0].chargerId);
      expect(dispatchedChargerIds).toContain(30);
    });
  });
});
