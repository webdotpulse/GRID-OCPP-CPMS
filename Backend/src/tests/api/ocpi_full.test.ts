import { jest } from "@jest/globals";

jest.unstable_mockModule("axios", () => ({
  default: {
    post: jest.fn().mockResolvedValue({ status: 200, data: {} } as never),
  },
  post: jest.fn().mockResolvedValue({ status: 200, data: {} } as never),
}));

const mockPrismaStationFindMany = jest.fn() as any;
const mockPrismaStationFindUnique = jest.fn() as any;
const mockPrismaTariffFindMany = jest.fn() as any;
const mockPrismaRfidFindUnique = jest.fn() as any;
const mockPrismaRfidFindMany = jest.fn() as any;
const mockPrismaRfidUpsert = jest.fn() as any;
const mockPrismaVccFindUnique = jest.fn() as any;
const mockPrismaTransactionFindFirst = jest.fn() as any;
const mockPrismaRoamingPartnerFindFirst = jest.fn() as any;
const mockPrismaRoamingSessionFindMany = jest.fn() as any;
const mockPrismaRoamingSessionFindFirst = jest.fn() as any;
const mockPrismaRoamingSessionCreate = jest.fn() as any;
const mockPrismaCdrFindMany = jest.fn() as any;
const mockPrismaCdrFindUnique = jest.fn() as any;
const mockPrismaCdrUpsert = jest.fn() as any;
const mockPrismaCdrUpdate = jest.fn() as any;

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    chargingStation: {
      findMany: mockPrismaStationFindMany,
      findUnique: mockPrismaStationFindUnique,
    },
    tariff: {
      findMany: mockPrismaTariffFindMany,
    },
    rfidUser: {
      findUnique: mockPrismaRfidFindUnique,
      findMany: mockPrismaRfidFindMany,
      upsert: mockPrismaRfidUpsert,
    },
    vehicleContractCertificate: {
      findUnique: mockPrismaVccFindUnique,
    },
    transaction: {
      findFirst: mockPrismaTransactionFindFirst,
    },
    roamingPartner: {
      findFirst: mockPrismaRoamingPartnerFindFirst,
    },
    roamingSession: {
      findMany: mockPrismaRoamingSessionFindMany,
      findFirst: mockPrismaRoamingSessionFindFirst,
      create: mockPrismaRoamingSessionCreate,
    },
    cDR: {
      findMany: mockPrismaCdrFindMany,
      findUnique: mockPrismaCdrFindUnique,
      upsert: mockPrismaCdrUpsert,
      update: mockPrismaCdrUpdate,
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 1 } as never),
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
    hset: jest.fn().mockResolvedValue(1 as never),
    hget: jest.fn().mockResolvedValue(null as never),
    expire: jest.fn().mockResolvedValue(1 as never),
    exists: jest.fn().mockResolvedValue(1 as never),
  },
}));

jest.unstable_mockModule("../../ocpp/distributedRemoteControl.js", () => ({
  sendDistributedOcppCall: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  sendDistributedRemoteCommand: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  getChargerProtocol: jest.fn().mockResolvedValue("ocpp1.6" as never),
  generateMessageId: () => "msg_test_ocpi",
  distributedPendingRequests: new Map(),
}));

describe("OCPI 2.2.1 Bilateral CPO Modules & CDR Engine (ROM-01)", () => {
  let commandsController: any;
  let tokensController: any;
  let sessionsController: any;
  let cdrsController: any;
  let OcpiService: any;
  let mockReq: any;
  let mockRes: any;

  beforeAll(async () => {
    commandsController = await import("../../api/ocpi/v221/commands.controller.js");
    tokensController = await import("../../api/ocpi/v221/tokens.controller.js");
    sessionsController = await import("../../api/ocpi/v221/sessions.controller.js");
    cdrsController = await import("../../api/ocpi/v221/cdrs.controller.js");
    const ocpiMod = await import("../../services/OcpiService.js");
    OcpiService = ocpiMod.OcpiService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("Commands Module (START_SESSION, STOP_SESSION, UNLOCK_CONNECTOR)", () => {
    it("START_SESSION should initiate remote transaction and return ACCEPTED", async () => {
      mockPrismaStationFindUnique.mockResolvedValue({
        id: 1,
        chargers: [{ charger_id: 101, evses: [{ evse_id: 1, connectors: [{ connector_id: 1 }] }] }],
      });
      mockPrismaRoamingPartnerFindFirst.mockResolvedValue({ id: 5, name: "Partner MSP" });
      mockPrismaRoamingSessionCreate.mockResolvedValue({ id: 1 });

      mockReq.body = {
        response_url: "https://emsp.example.com/callback",
        token: { uid: "TAG_ROAM_01", type: "RFID" },
        location_id: "1",
        connector_id: "1",
      };

      await commandsController.postStartSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.objectContaining({
            result: "ACCEPTED",
            timeout: 30,
          }),
        })
      );
    });

    it("STOP_SESSION should stop remote transaction and return ACCEPTED", async () => {
      mockPrismaTransactionFindFirst.mockResolvedValue({
        id: 1,
        transactionId: "TX-12345",
        charger_id: 101,
        status: "charging",
        charger: { charger_id: 101 },
      });

      mockReq.body = {
        session_id: "TX-12345",
      };

      await commandsController.postStopSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.objectContaining({
            result: "ACCEPTED",
          }),
        })
      );
    });

    it("UNLOCK_CONNECTOR should unlock connector and return ACCEPTED", async () => {
      mockPrismaStationFindUnique.mockResolvedValue({
        id: 1,
        chargers: [{ charger_id: 101 }],
      });

      mockReq.body = {
        location_id: "1",
        connector_id: "1",
      };

      await commandsController.postUnlockConnector(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.objectContaining({
            result: "ACCEPTED",
          }),
        })
      );
    });
  });

  describe("Tokens Module (Real-time Authorization & Whitelist Sync)", () => {
    it("postAuthorizeToken should authorize active RFID card", async () => {
      mockPrismaRfidFindUnique.mockResolvedValue({
        rfid_user_id: 10,
        rfid_tag: "VALID_TAG_001",
        name: "Test Roamer",
        active: true,
        company_name: "NL-eMSP",
        updatedAt: new Date(),
      });

      mockReq.params = { token_uid: "VALID_TAG_001" };

      await tokensController.postAuthorizeToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.objectContaining({
            result: "ALLOWED",
            token: expect.objectContaining({ valid: true }),
          }),
        })
      );
    });

    it("putToken should sync and whitelist token from partner", async () => {
      mockPrismaRfidUpsert.mockResolvedValue({ id: 1 });

      mockReq.params = { token_uid: "FOREIGN_TAG_999" };
      mockReq.body = {
        contract_id: "DE-XYZ-12345",
        issuer: "Foreign eMSP",
        valid: true,
      };

      await tokensController.putToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockPrismaRfidUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfid_tag: "FOREIGN_TAG_999" },
        })
      );
    });

    it("getTokens should return tokens array in OCPI envelope", async () => {
      mockPrismaRfidFindMany.mockResolvedValue([
        {
          rfid_user_id: 1,
          rfid_tag: "TAG_001",
          active: true,
          company_name: "Partner",
          updatedAt: new Date(),
        },
      ]);

      await tokensController.getTokens(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.arrayContaining([
            expect.objectContaining({ uid: "TAG_001" }),
          ]),
        })
      );
    });
  });

  describe("Sessions & CDRs Modules", () => {
    it("getOcpiSessions should return sessions with pagination", async () => {
      mockPrismaRoamingSessionFindMany.mockResolvedValue([
        {
          id: 1,
          transactionId: "TX-ROAM-1",
          startTime: new Date(),
          endTime: null,
          energyConsumed: 15.5,
          wholesaleCost: 6.97,
          status: "active",
          updatedAt: new Date(),
          station: { country: "NL" },
          partner: { name: "Partner A" },
        },
      ]);

      mockReq.query = { offset: "0", limit: "10" };

      await sessionsController.getOcpiSessions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.arrayContaining([
            expect.objectContaining({ kwh: 15.5, status: "ACTIVE" }),
          ]),
        })
      );
    });

    it("getOcpiCdrs should return CDR records", async () => {
      mockPrismaCdrFindMany.mockResolvedValue([
        {
          cdrId: "CDR-TX-100",
          transactionId: "TX-100",
          startTime: new Date(),
          endTime: new Date(),
          totalEnergy: 25.0,
          totalTime: 1.5,
          totalCost: 11.25,
          currency: "EUR",
          status: "sent",
          updatedAt: new Date(),
          station: { country: "NL" },
          partner: { name: "Partner A" },
        },
      ]);

      await cdrsController.getOcpiCdrs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 1000,
          data: expect.arrayContaining([
            expect.objectContaining({ id: "CDR-TX-100", total_energy: 25.0 }),
          ]),
        })
      );
    });

    it("OcpiService.compileCdrForTransaction should compile valid CDR from transaction", async () => {
      mockPrismaTransactionFindFirst.mockResolvedValue({
        id: 1,
        transactionId: "TX-ROAM-COMPLETE",
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(),
        energyConsumed: 20.0,
        totalCost: 900, // 900 cents = €9.00
        charger: {
          charger_id: 1,
          station: { id: 10, country: "NL" },
        },
      });

      mockPrismaRoamingSessionFindFirst.mockResolvedValue({
        partnerId: 2,
      });

      mockPrismaCdrUpsert.mockResolvedValue({
        id: 1,
        cdrId: "CDR-TX-ROAM-COMPLETE",
        partnerId: 2,
        stationId: 10,
        totalEnergy: 20.0,
        totalTime: 1.0,
        totalCost: 9.0,
        currency: "EUR",
        status: "pending",
      });

      const cdr = await OcpiService.compileCdrForTransaction("TX-ROAM-COMPLETE");

      expect(cdr).toBeDefined();
      expect(cdr.cdrId).toBe("CDR-TX-ROAM-COMPLETE");
      expect(cdr.totalCost).toBe(9.0);
    });
  });
});
