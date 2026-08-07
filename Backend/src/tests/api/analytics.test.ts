import { jest } from '@jest/globals';

const mockStationCount = jest.fn() as any;
const mockChargerCount = jest.fn() as any;
const mockTxAggregate = jest.fn() as any;
const mockTxCount = jest.fn() as any;
const mockTxFindMany = jest.fn() as any;

jest.unstable_mockModule('../../config/database.js', () => ({
  prisma: {
    chargingStation: { count: mockStationCount },
    charger: { count: mockChargerCount },
    transaction: {
      aggregate: mockTxAggregate,
      count: mockTxCount,
      findMany: mockTxFindMany,
    },
  },
}));

const importPromise = import('../../api/analytics/analytics.controller.js');

describe("Analytics Controller", () => {
  let analyticsController: any;
  let mockReq: any;
  let mockRes: any;

  beforeAll(async () => {
    analyticsController = await importPromise;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      header: jest.fn(),
      attachment: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("getAnalyticsSummary", () => {
    it("should return correct summary metrics", async () => {
      mockStationCount.mockResolvedValue(5);
      mockChargerCount.mockResolvedValueOnce(10).mockResolvedValueOnce(8); // total=10, active=8
      mockTxAggregate.mockResolvedValue({ _sum: { energyConsumed: 1250.75 } });
      mockTxCount.mockResolvedValue(150);

      await analyticsController.getAnalyticsSummary(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalStations: 5,
          totalChargers: 10,
          activeChargers: 8,
          uptimePercentage: 80,
          totalEnergyKwh: 1250.75,
          totalTransactions: 150,
        },
      });
    });
  });

  describe("exportAnalyticsCsv", () => {
    it("should format transactions into a CSV file", async () => {
      mockTxFindMany.mockResolvedValue([
        {
          transactionId: "TX-999",
          charger: { name: "Charger 1", model: "DC Fast 150" },
          status: "completed",
          energyConsumed: 45.2,
          currentPower: 0,
          startTime: new Date("2026-08-01T10:00:00Z"),
          stopTime: new Date("2026-08-01T10:45:00Z"),
        },
      ]);

      await analyticsController.exportAnalyticsCsv(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining("TX-999,Charger 1,DC Fast 150,completed,45.20,0.00")
      );
    });
  });
});
