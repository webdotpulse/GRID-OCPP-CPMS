import { jest } from '@jest/globals';

const mockStationFindMany = jest.fn() as any;
const mockTariffFindMany = jest.fn() as any;
const mockSessionFindMany = jest.fn() as any;
const mockCdrFindMany = jest.fn() as any;

jest.unstable_mockModule('../../config/database.js', () => ({
  prisma: {
    chargingStation: { findMany: mockStationFindMany },
    tariff: { findMany: mockTariffFindMany },
    roamingSession: { findMany: mockSessionFindMany },
    cDR: { findMany: mockCdrFindMany },
  },
}));

const importPromise = import('../../api/ocpi/ocpi.controller.js');

describe("OCPI 2.2.1 Controller", () => {
  let ocpiController: any;
  let mockReq: any;
  let mockRes: any;

  beforeAll(async () => {
    ocpiController = await importPromise;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe("getOcpiLocations", () => {
    it("should return OCPI 2.2.1 formatted locations with status_code 1000", async () => {
      mockStationFindMany.mockResolvedValue([
        {
          id: 1,
          station_name: "FastCharge Central",
          street_name: "Main St 12",
          city: "Amsterdam",
          postal_code: "1011 AB",
          country: "NLD",
          latitude: 52.3676,
          longitude: 4.9041,
          updatedAt: new Date("2026-08-01T12:00:00Z"),
          chargers: [],
        },
      ]);

      await ocpiController.getOcpiLocations(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          status_message: "Success",
          data: expect.arrayContaining([
            expect.objectContaining({
              id: "1",
              name: "FastCharge Central",
              city: "Amsterdam",
            }),
          ]),
        })
      );
    });
  });

  describe("getOcpiTariffs", () => {
    it("should return OCPI 2.2.1 formatted tariffs", async () => {
      mockTariffFindMany.mockResolvedValue([
        {
          tariff_id: 5,
          electricity_rate: 0.35,
          updatedAt: new Date("2026-08-01T12:00:00Z"),
        },
      ]);

      await ocpiController.getOcpiTariffs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: "5",
              currency: "EUR",
            }),
          ]),
        })
      );
    });
  });
});
