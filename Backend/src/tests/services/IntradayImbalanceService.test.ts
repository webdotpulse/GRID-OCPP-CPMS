import { jest } from "@jest/globals";

const mockSetChargingProfile = jest.fn() as any;

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => ({
  setChargingProfile: mockSetChargingProfile,
}));

const { IntradayImbalanceService } = await import("../../services/IntradayImbalanceService.js");
const { prisma } = await import("../../config/database.js");

describe("Intraday & Real-Time Imbalance Price Arbitrage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should record and query real-time imbalance price", async () => {
    const now = new Date();
    const mockRecord = {
      id: 1,
      timestamp: now,
      country: "NL",
      marketType: "IMBALANCE_REALTIME",
      priceType: "settled",
      pricePerMwh: -45.5,
      provider: "TenneT",
    };

    jest.spyOn(prisma.energyMarketPrice, "upsert").mockResolvedValue(mockRecord as any);
    jest.spyOn(prisma.energyMarketPrice, "findFirst").mockResolvedValue(mockRecord as any);

    const recorded = await IntradayImbalanceService.recordImbalancePrice({
      country: "NL",
      timestamp: now,
      pricePerMwh: -45.5,
      provider: "TenneT",
    });

    expect(recorded.pricePerMwh).toBe(-45.5);
    expect(recorded.provider).toBe("TenneT");

    const price = await IntradayImbalanceService.getPriceForTimestamp("NL", now, "IMBALANCE_REALTIME");
    expect(price).toBe(-45.5);
  });

  it("should trigger FLEXIBILITY_CHARGE_BOOST on negative prices (<= 0 EUR/MWh)", async () => {
    const now = new Date();
    const mockNegativePrice = {
      id: 2,
      timestamp: now,
      country: "NL",
      marketType: "IMBALANCE_REALTIME",
      pricePerMwh: -50.0,
    };

    jest.spyOn(prisma.energyMarketPrice, "findFirst").mockResolvedValue(mockNegativePrice as any);
    jest.spyOn(prisma.transaction, "findMany").mockResolvedValue([
      {
        id: 1,
        transactionId: "TX-1",
        charger_id: 10,
        charger: { charger_id: 10, power_capacity: 22.0 },
      },
    ] as any);
    mockSetChargingProfile.mockResolvedValue({ status: "Accepted" });

    const result = await IntradayImbalanceService.evaluateArbitrageOpportunity("NL", now);

    expect(result.action).toBe("FLEXIBILITY_CHARGE_BOOST");
    expect(result.pricePerMwh).toBe(-50.0);
    expect(result.triggeredTransactionsCount).toBe(1);
    expect(mockSetChargingProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        chargerId: 10,
        csChargingProfiles: expect.objectContaining({
          chargingProfileId: 104,
          chargingSchedule: expect.objectContaining({
            chargingSchedulePeriod: [expect.objectContaining({ limit: 31 })],
          }),
        }),
      })
    );
  });

  it("should trigger PEAK_SHAVE / V2G_DISCHARGE_EXPORT on extreme peak spikes (>= 250 EUR/MWh)", async () => {
    const now = new Date();
    const mockPeakPrice = {
      id: 3,
      timestamp: now,
      country: "NL",
      marketType: "INTRADAY_15MIN",
      pricePerMwh: 350.0,
    };

    jest.spyOn(prisma.energyMarketPrice, "findFirst").mockResolvedValue(mockPeakPrice as any);
    jest.spyOn(prisma.transaction, "findMany").mockResolvedValue([
      {
        id: 2,
        transactionId: "TX-2",
        charger_id: 20,
        soc: 30, // low SoC -> curtail to 6A
        charger: { charger_id: 20, owner_id: 5, power_capacity: 11.0 },
      },
    ] as any);
    mockSetChargingProfile.mockResolvedValue({ status: "Accepted" });

    const result = await IntradayImbalanceService.evaluateArbitrageOpportunity("NL", now);

    expect(result.action).toBe("V2G_DISCHARGE_EXPORT");
    expect(result.pricePerMwh).toBe(350.0);
    expect(mockSetChargingProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        chargerId: 20,
        csChargingProfiles: expect.objectContaining({
          chargingSchedule: expect.objectContaining({
            chargingSchedulePeriod: [expect.objectContaining({ limit: 6 })],
          }),
        }),
      })
    );
  });
});
