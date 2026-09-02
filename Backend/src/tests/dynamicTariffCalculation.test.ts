import { jest } from "@jest/globals";

const mockRedisGet = jest.fn() as any;
const mockRedisSet = jest.fn() as any;

const mockRedis = {
  redisClient: {
    get: mockRedisGet,
    set: mockRedisSet,
    on: jest.fn(),
    quit: jest.fn(),
  },
  redisPublisher: {
    publish: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  },
};

jest.unstable_mockModule("../config/redis.js", () => mockRedis);
jest.unstable_mockModule("../config/redis", () => mockRedis);

describe("Dynamic Tariff Calculation (FIN-04)", () => {
  let prisma: any;
  let EpexSpotService: any;
  let DynamicTariffService: any;

  beforeAll(async () => {
    const dbMod = await import("../config/database.js");
    prisma = dbMod.prisma;
    const epexMod = await import("../services/EpexSpotService.js");
    EpexSpotService = epexMod.EpexSpotService;
    const tariffMod = await import("../services/DynamicTariffService.js");
    DynamicTariffService = tariffMod.DynamicTariffService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should correctly compute total cost for fixed tariffs", async () => {
    jest.spyOn(prisma.meterValue, "findFirst").mockResolvedValue(null);

    const startTime = new Date("2026-08-16T10:00:00Z");
    const endTime = new Date("2026-08-16T12:00:00Z"); // 120 minutes

    const result = await DynamicTariffService.calculateSessionCost({
      transactionId: "TX-FIXED-1",
      initialMeterValue: 10000,
      meterStop: 35000, // 25,000 Wh = 25 kWh
      startTime,
      endTime,
      tariff: {
        tariffType: "FIXED",
        charge: 2.0, // €2.00 connection fee = 200 cents
        electricity_rate: 0.30, // €0.30/kWh = 30 cents/kWh
        time_fee: 0.01, // €0.01/min = 1 cent/min
        idle_fee: 0,
      },
    });

    expect(result.totalKwh).toBe(25);
    expect(result.connectionFee).toBe(200); // 200 cents
    expect(result.timeFee).toBe(120); // 120 min * 1 cent = 120 cents
    expect(result.energyFee).toBe(750); // 25 kWh * 30 cents = 750 cents
    expect(result.totalCost).toBe(1070); // 200 + 120 + 750 = 1070 cents (€10.70)
  });

  it("should correctly compute weighted dynamic cost when intermediate meter values exist", async () => {
    jest.spyOn(prisma.meterValue, "findFirst").mockResolvedValue(null);

    // Mock 2 intermediate meter values across 2 hours
    const meterValues = [
      { energy: 20000, timestamp: new Date("2026-08-16T11:00:00Z") }, // +10 kWh in hour 10:00-11:00
      { energy: 35000, timestamp: new Date("2026-08-16T12:00:00Z") }, // +15 kWh in hour 11:00-12:00
    ];
    jest.spyOn(prisma.meterValue, "findMany").mockResolvedValue(meterValues as any);

    // Mock EPEX Spot prices:
    // Hour 1: €80/MWh = €0.08/kWh
    // Hour 2: €120/MWh = €0.12/kWh
    const getPriceSpy = jest.spyOn(EpexSpotService, "getPriceForTimestamp").mockImplementation(async (country: any, ts: any) => {
      const date = new Date(ts as string | number | Date);
      if (date.getUTCHours() === 11) {
        return 80.0;
      }
      return 120.0;
    });

    const startTime = new Date("2026-08-16T10:00:00Z");
    const endTime = new Date("2026-08-16T12:00:00Z");

    const result = await DynamicTariffService.calculateSessionCost({
      transactionId: "TX-DYNAMIC-1",
      initialMeterValue: 10000,
      meterStop: 35000, // 25 kWh total
      startTime,
      endTime,
      tariff: {
        tariffType: "DYNAMIC_EPEX",
        country: "BE",
        dynamicProvider: "EnergyZero",
        charge: 1.0, // €1.00 = 100 cents
        markupPerKwh: 0.02, // €0.02 markup
        taxPercentage: 21, // 21% VAT
        time_fee: 0,
        idle_fee: 0,
      },
    });

    // Hour 1 cost: (0.08 + 0.02) * 1.21 = 0.121 EUR/kWh * 10 kWh = 1.21 EUR = 121 cents
    // Hour 2 cost: (0.12 + 0.02) * 1.21 = 0.1694 EUR/kWh * 15 kWh = 2.541 EUR = 254.1 cents
    // Total energy fee = 121 + 254.1 = 375.1 cents -> 375 cents
    // Connection fee = 100 cents
    // Total cost = ~475 cents (€4.75)
    expect(result.totalKwh).toBe(25);
    expect(result.connectionFee).toBe(100);
    expect(result.energyFee).toBe(375);
    expect(result.totalCost).toBe(475);

    getPriceSpy.mockRestore();
  });

  it("should calculate dynamic cost using time-slicing when no intermediate meter values exist", async () => {
    jest.spyOn(prisma.meterValue, "findFirst").mockResolvedValue(null);
    jest.spyOn(prisma.meterValue, "findMany").mockResolvedValue([]); // Empty meter values

    // Spot price: €100/MWh = €0.10/kWh
    const getPriceSpy = jest.spyOn(EpexSpotService, "getPriceForTimestamp").mockResolvedValue(100.0);

    const startTime = new Date("2026-08-16T10:00:00Z");
    const endTime = new Date("2026-08-16T12:00:00Z"); // 2 hours

    const result = await DynamicTariffService.calculateSessionCost({
      transactionId: "TX-DYNAMIC-2",
      initialMeterValue: 0,
      meterStop: 20000, // 20 kWh
      startTime,
      endTime,
      tariff: {
        tariffType: "DYNAMIC_EPEX",
        country: "NL",
        dynamicProvider: "EnergyZero",
        charge: 0,
        markupPerKwh: 0.05, // €0.05 markup -> (0.10 + 0.05) = 0.15
        taxPercentage: 0,
        time_fee: 0,
        idle_fee: 0,
      },
    });

    // Total energy: 20 kWh * €0.15 = €3.00 = 300 cents
    expect(result.totalKwh).toBe(20);
    expect(result.energyFee).toBe(300);
    expect(result.totalCost).toBe(300);

    getPriceSpy.mockRestore();
  });
});
