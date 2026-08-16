import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as analyticsController from '../../api/analytics/analytics.controller.js';

describe("Analytics Controller (FE-03)", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      userRole: 'admin',
      userId: 1,
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      header: jest.fn(),
      attachment: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("getAnalyticsSummary", () => {
    it("should return correct summary metrics and query active chargers", async () => {
      jest.spyOn(prisma.chargingStation, 'count').mockResolvedValue(5 as any);
      const countChargerSpy = jest.spyOn(prisma.charger, 'count')
        .mockResolvedValueOnce(10 as any) // total=10
        .mockResolvedValueOnce(8 as any);  // active=8
      jest.spyOn(prisma.transaction, 'aggregate').mockResolvedValue({ _sum: { energyConsumed: 1250.75 } } as any);
      jest.spyOn(prisma.transaction, 'count').mockResolvedValue(150 as any);

      await analyticsController.getAnalyticsSummary(mockReq, mockRes);

      expect(countChargerSpy).toHaveBeenNthCalledWith(2, { where: { status: "active" } });
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
    it("should format transactions into a CSV file with correct start and end times", async () => {
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([
        {
          transactionId: "TX-999",
          charger: { name: "Charger 1", model: "DC Fast 150" },
          status: "completed",
          energyConsumed: 45.2,
          currentPower: 0,
          startTime: new Date("2026-08-01T10:00:00.000Z"),
          endTime: new Date("2026-08-01T10:45:00.000Z"),
        },
      ] as any);

      await analyticsController.exportAnalyticsCsv(mockReq, mockRes);

      expect(mockRes.header).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockRes.attachment).toHaveBeenCalledWith(expect.stringMatching(/^analytics-export-\d+\.csv$/));
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining("TX-999,Charger 1,DC Fast 150,completed,45.20,0.00,2026-08-01T10:00:00.000Z,2026-08-01T10:45:00.000Z")
      );
    });
  });
});
