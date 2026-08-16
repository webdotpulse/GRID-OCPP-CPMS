import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as ocpiController from '../../api/ocpi/ocpi.controller.js';

describe("OCPI 2.2.1 Controller", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe("getOcpiLocations", () => {
    it("should return OCPI 2.2.1 formatted locations with status_code 1000 and mapped connectors (OCPP-03)", async () => {
      jest.spyOn(prisma.chargingStation, 'findMany').mockResolvedValue([
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
          chargers: [
            {
              charger_id: 101,
              name: "Charger 101",
              evses: [
                {
                  id: 1,
                  evse_id: 1,
                  connectors: [
                    {
                      connector_id: 1,
                      connector_name: "Channel 1",
                      status: "Available",
                      current_type: "AC",
                      max_current: 32,
                      max_power: 22,
                      max_voltage: 400,
                      format: "SOCKET",
                    },
                    {
                      connector_id: 2,
                      connector_name: "Channel 2",
                      status: "Occupied",
                      current_type: "DC",
                      max_current: 125,
                      max_power: 50,
                      max_voltage: 500,
                      format: "CABLE",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ] as any);

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
              evses: expect.arrayContaining([
                expect.objectContaining({
                  uid: "1",
                  status: "AVAILABLE",
                  connectors: expect.arrayContaining([
                    expect.objectContaining({
                      id: "1",
                      standard: "IEC_62196_T2",
                      power_type: "AC_3_PHASE",
                      max_electric_power: 22000,
                      max_amperage: 32,
                      max_voltage: 400,
                    }),
                    expect.objectContaining({
                      id: "2",
                      standard: "IEC_62196_T2_COMBO",
                      power_type: "DC",
                      max_electric_power: 50000,
                      max_amperage: 125,
                      max_voltage: 500,
                    }),
                  ]),
                }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  describe("getOcpiTariffs", () => {
    it("should return OCPI 2.2.1 formatted tariffs", async () => {
      jest.spyOn(prisma.tariff, 'findMany').mockResolvedValue([
        {
          tariff_id: 5,
          electricity_rate: 0.35,
          updatedAt: new Date("2026-08-01T12:00:00Z"),
        },
      ] as any);

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

  describe("getOcpiSessions", () => {
    it("should return OCPI 2.2.1 formatted sessions", async () => {
      jest.spyOn(prisma.roamingSession, 'findMany').mockResolvedValue([
        {
          id: 1,
          startTime: new Date("2026-08-01T10:00:00Z"),
          endTime: new Date("2026-08-01T11:00:00Z"),
          energyConsumed: 25.5,
          transactionId: "TX-12345",
          stationId: 1,
          wholesaleCost: 8.50,
          status: "completed",
          updatedAt: new Date("2026-08-01T11:05:00Z"),
        },
      ] as any);

      await ocpiController.getOcpiSessions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: "1",
              kwh: 25.5,
              status: "COMPLETED",
            }),
          ]),
        })
      );
    });
  });

  describe("getOcpiCdrs", () => {
    it("should return OCPI 2.2.1 formatted CDRs", async () => {
      jest.spyOn(prisma.cDR, 'findMany').mockResolvedValue([
        {
          cdrId: "CDR-999",
          partnerId: 2,
          stationId: 1,
          transactionId: "TX-12345",
          startTime: new Date("2026-08-01T10:00:00Z"),
          endTime: new Date("2026-08-01T11:00:00Z"),
          totalEnergy: 25.5,
          totalTime: 60,
          totalCost: 8.50,
          currency: "EUR",
          status: "settled",
          updatedAt: new Date("2026-08-01T11:05:00Z"),
        },
      ] as any);

      await ocpiController.getOcpiCdrs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: "CDR-999",
              total_energy: 25.5,
            }),
          ]),
        })
      );
    });
  });
});
