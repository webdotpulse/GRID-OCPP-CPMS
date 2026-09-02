import { jest } from "@jest/globals";
import { prisma } from "../../config/database.js";
import * as companiesController from "../../api/companies/companies.controller.js";
import * as stationsController from "../../api/stations/stations.controller.js";

describe("Corporate Account & Charging Station Linking", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      userRole: "superadmin",
      userId: 1,
      params: {},
      query: {},
      body: {},
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe("syncCompanyStations", () => {
    it("should link orphaned stations belonging to company users", async () => {
      mockReq.params = { id: "5" };

      jest.spyOn(prisma.user, "findMany").mockResolvedValue([
        { id: 10 },
        { id: 11 },
      ] as any);

      jest.spyOn(prisma.chargingStation, "updateMany").mockResolvedValue({
        count: 3,
      } as any);

      await companiesController.syncCompanyStations(mockReq, mockRes);

      expect(prisma.chargingStation.updateMany).toHaveBeenCalledWith({
        where: {
          owner_id: { in: [10, 11] },
          companyId: null,
        },
        data: {
          companyId: 5,
        },
      });

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          linkedCount: 3,
        })
      );
    });

    it("should return 400 for invalid company ID", async () => {
      mockReq.params = { id: "abc" };

      await companiesController.syncCompanyStations(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Invalid company ID",
        })
      );
    });
  });

  describe("createStation with explicit companyId", () => {
    it("should create station with provided companyId", async () => {
      mockReq.body = {
        station_name: "Acme North Depot",
        street_name: "Keizersgracht 10",
        city: "Amsterdam",
        postal_code: "1015AA",
        latitude: 52.37,
        longitude: 4.89,
        companyId: 5,
      };

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: 1,
        companyId: null,
      } as any);

      jest.spyOn(prisma.chargingStation, "create").mockResolvedValue({
        id: 100,
        station_name: "Acme North Depot",
        companyId: 5,
        owner_id: 1,
      } as any);

      await stationsController.createStation(mockReq, mockRes);

      expect(prisma.chargingStation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            station_name: "Acme North Depot",
            companyId: 5,
            owner_id: 1,
          }),
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            companyId: 5,
          }),
        })
      );
    });
  });
});
