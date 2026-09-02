import { jest } from "@jest/globals";

const mockAxiosPost = jest.fn() as any;

jest.unstable_mockModule("axios", () => ({
  default: {
    post: mockAxiosPost,
  },
  post: mockAxiosPost,
}));

const mockPrismaStationFindUnique = jest.fn() as any;
const mockPrismaOicpEndpointFindFirst = jest.fn() as any;
const mockPrismaRoamingPartnerFindFirst = jest.fn() as any;
const mockPrismaTransactionFindFirst = jest.fn() as any;

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    chargingStation: {
      findUnique: mockPrismaStationFindUnique,
    },
    oicpEndpoint: {
      findFirst: mockPrismaOicpEndpointFindFirst,
    },
    roamingPartner: {
      findFirst: mockPrismaRoamingPartnerFindFirst,
    },
    transaction: {
      findFirst: mockPrismaTransactionFindFirst,
    },
  },
}));

jest.unstable_mockModule("../../config/redis.js", () => ({
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
    call: jest.fn().mockResolvedValue(1 as never),
    get: jest.fn().mockResolvedValue(null as never),
    set: jest.fn().mockResolvedValue("OK" as never),
    del: jest.fn().mockResolvedValue(1 as never),
  },
}));

describe("Hubject OICP 2.3 Dynamic EVSE Broadcast & Authorize (ROM-02)", () => {
  let HubjectOicpService: any;

  beforeAll(async () => {
    const mod = await import("../../services/HubjectOicpService.js");
    HubjectOicpService = mod.HubjectOicpService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Status Mapping (OCPP -> OICP 2.3)", () => {
    it("should correctly map all standard OCPP connector statuses to OICP equivalents", () => {
      expect(HubjectOicpService.mapOcppToOicpStatus("Available")).toBe("Available");
      expect(HubjectOicpService.mapOcppToOicpStatus("Preparing")).toBe("Occupied");
      expect(HubjectOicpService.mapOcppToOicpStatus("Charging")).toBe("Occupied");
      expect(HubjectOicpService.mapOcppToOicpStatus("SuspendedEV")).toBe("Occupied");
      expect(HubjectOicpService.mapOcppToOicpStatus("SuspendedEVSE")).toBe("Occupied");
      expect(HubjectOicpService.mapOcppToOicpStatus("Finishing")).toBe("Occupied");
      expect(HubjectOicpService.mapOcppToOicpStatus("Reserved")).toBe("Reserved");
      expect(HubjectOicpService.mapOcppToOicpStatus("Unavailable")).toBe("OutOfService");
      expect(HubjectOicpService.mapOcppToOicpStatus("Faulted")).toBe("OutOfService");
      expect(HubjectOicpService.mapOcppToOicpStatus("RandomInvalid")).toBe("Unknown");
    });
  });

  describe("pushEvseData", () => {
    it("should compile station EVSE records and upload to Hubject", async () => {
      mockPrismaStationFindUnique.mockResolvedValue({
        id: 10,
        station_name: "Super Fast Hub Amsterdam",
        country: "NL",
        city: "Amsterdam",
        street_name: "Keizersgracht 100",
        postal_code: "1015AA",
        latitude: 52.37,
        longitude: 4.89,
        chargers: [
          {
            charger_id: 101,
            evses: [
              {
                evse_id: 1,
                connectors: [
                  { connector_id: 1, current_type: "DC", max_power: 150, max_voltage: 800, max_current: 300 },
                  { connector_id: 2, current_type: "AC", max_power: 22, max_voltage: 400, max_current: 32 },
                ],
              },
            ],
          },
        ],
      });

      mockPrismaOicpEndpointFindFirst.mockResolvedValue({
        url: "https://hubject.example.com",
        token: "HUBJECT_BEARER_TOKEN",
        status: "active",
      });

      mockAxiosPost.mockResolvedValue({ status: 200, data: { StatusCode: { Code: "000" } } });

      const result = await HubjectOicpService.pushEvseData(10);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "https://hubject.example.com/api/oicp/evse-data",
        expect.objectContaining({
          OperatorID: "NL*CPM",
          EVSEData: expect.objectContaining({
            EVSEDataRecord: expect.arrayContaining([
              expect.objectContaining({
                EvseId: "NL*CPM*E101*1",
                Plugs: ["CCS Combo 2 Plug (Type 2)"],
              }),
              expect.objectContaining({
                EvseId: "NL*CPM*E101*2",
                Plugs: ["Type 2 Outlet"],
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer HUBJECT_BEARER_TOKEN",
          }),
        })
      );
    });
  });

  describe("pushEvseStatus", () => {
    it("should broadcast dynamic EVSE status to Hubject endpoint", async () => {
      mockPrismaOicpEndpointFindFirst.mockResolvedValue({
        url: "https://hubject.example.com",
        token: "HUBJECT_BEARER_TOKEN",
      });
      mockAxiosPost.mockResolvedValue({ status: 200, data: { StatusCode: { Code: "000" } } });

      const result = await HubjectOicpService.pushEvseStatus(101, 1, "Charging");

      expect(result.success).toBe(true);
      expect(result.status).toBe("Occupied");
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "https://hubject.example.com/api/oicp/evse-status",
        expect.objectContaining({
          OperatorID: "NL*CPM",
          EVSEStatuses: {
            EVSEStatusRecord: [
              {
                EvseId: "NL*CPM*E101*1",
                EVSEStatus: "Occupied",
              },
            ],
          },
        }),
        expect.anything()
      );
    });
  });

  describe("authorizeStart", () => {
    it("should query Hubject for foreign driver authentication and return Authorized", async () => {
      mockPrismaOicpEndpointFindFirst.mockResolvedValue({
        url: "https://hubject.example.com",
        token: "HUBJECT_TOKEN",
      });
      mockAxiosPost.mockResolvedValue({
        status: 200,
        data: {
          AuthorizationStatus: "Authorized",
          StatusCode: { Code: "000", Description: "Success" },
        },
      });

      const result = await HubjectOicpService.authorizeStart("DE*XYZ*123456", "NL*CPM*E101*1");

      expect(result.authorized).toBe(true);
      expect(result.authorizationStatus).toBe("Authorized");
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "https://hubject.example.com/api/oicp/authorize-start",
        expect.objectContaining({
          Identification: {
            RFIDMifareFamilyCredentials: { UID: "DE*XYZ*123456" },
          },
        }),
        expect.anything()
      );
    });

    it("should handle rejection from Hubject", async () => {
      mockPrismaOicpEndpointFindFirst.mockResolvedValue({
        url: "https://hubject.example.com",
        token: "HUBJECT_TOKEN",
      });
      mockAxiosPost.mockResolvedValue({
        status: 200,
        data: {
          AuthorizationStatus: "NotAuthorized",
          StatusCode: { Code: "017", Description: "RFID tag blocked" },
        },
      });

      const result = await HubjectOicpService.authorizeStart("BLOCKED_TAG");

      expect(result.authorized).toBe(false);
      expect(result.authorizationStatus).toBe("NotAuthorized");
    });
  });

  describe("sendChargeDetailRecord", () => {
    it("should format and submit OICP 2.3 CDR to Hubject", async () => {
      mockPrismaTransactionFindFirst.mockResolvedValue({
        id: 1,
        transactionId: "TX-HUBJECT-99",
        charger_id: 101,
        idTag: "DE*TEST*999",
        startTime: new Date("2026-08-01T12:00:00.000Z"),
        endTime: new Date("2026-08-01T13:00:00.000Z"),
        energyConsumed: 45.5,
        initialMeterValue: 1000,
        finalMeterValue: 1045.5,
        charger: {
          chargingStation: { country: "NL" },
        },
      });

      mockPrismaOicpEndpointFindFirst.mockResolvedValue({
        url: "https://hubject.example.com",
        token: "HUBJECT_TOKEN",
      });
      mockAxiosPost.mockResolvedValue({ status: 200, data: { StatusCode: { Code: "000" } } });

      const result = await HubjectOicpService.sendChargeDetailRecord("TX-HUBJECT-99");

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("TX-HUBJECT-99");
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "https://hubject.example.com/api/oicp/cdr",
        expect.objectContaining({
          EVSEID: "NL*CPM*E101*1",
          SessionID: "TX-HUBJECT-99",
          ConsumedEnergy: 45.5,
          MeterValueStart: 1000,
          MeterValueEnd: 1045.5,
        }),
        expect.anything()
      );
    });
  });
});
