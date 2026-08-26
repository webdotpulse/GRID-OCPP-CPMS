import { jest } from '@jest/globals';

jest.mock('../../config/redis.js', () => ({
  redisPublisher: {
    publish: jest.fn().mockResolvedValue(1 as never),
  },
  redisSubscriber: {
    subscribe: jest.fn().mockResolvedValue("OK" as never),
    unsubscribe: jest.fn().mockResolvedValue("OK" as never),
    psubscribe: jest.fn().mockResolvedValue("OK" as never),
    on: jest.fn(),
  },
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
  },
}));

jest.mock('../../config/database.js', () => ({
  prisma: {
    charger: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    rfidUser: {
      findUnique: jest.fn(),
    },
    vehicleContractCertificate: {
      findUnique: jest.fn(),
    },
    chargeGroupUser: {
      findUnique: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rfidSession: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    connector: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    evse: {
      upsert: jest.fn(),
    },
    ocppLog: {
      create: jest.fn(),
    },
  },
  pgliteInstance: {
    waitReady: Promise.resolve(),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  },
}));

import { resolveMappedCardId } from '../../ocpp/quirkNormalizer.js';
import { proxyRouter } from '../../ocpp/proxyRouter.js';
import { prisma } from '../../config/database.js';
import * as v16Handlers from '../../ocpp/handlers/v16Handlers.js';
import * as v21Handlers from '../../ocpp/handlers/v21Handlers.js';

describe("Solar Mode Card ID Translation & Proxy Forwarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    proxyRouter.clearQuirkRulesCache();
    (prisma.ocppLog.create as any).mockResolvedValue({} as any);
  });

  describe("resolveMappedCardId helper", () => {
    it("should return original card ID if no rules or mappings exist", () => {
      expect(resolveMappedCardId("SOLAR_001", null)).toBe("SOLAR_001");
      expect(resolveMappedCardId("SOLAR_001", {})).toBe("SOLAR_001");
      expect(resolveMappedCardId("", { cardIdMapping: { SOLAR_001: "NL-MINT-01" } })).toBe("");
    });

    it("should translate card ID using key-value object mapping", () => {
      const rules = {
        cardIdMapping: {
          SOLAR_001: "NL-MINT-00012345",
          EVE_SOLAR_TAG: "NL-ALL-99887766",
        },
      };

      expect(resolveMappedCardId("SOLAR_001", rules)).toBe("NL-MINT-00012345");
      expect(resolveMappedCardId("EVE_SOLAR_TAG", rules)).toBe("NL-ALL-99887766");
      expect(resolveMappedCardId("UNMAPPED_CARD", rules)).toBe("UNMAPPED_CARD");
    });

    it("should perform case-insensitive card ID matching", () => {
      const rules = {
        cardIdMapping: {
          solar_default: "NL-MINT-00012345",
        },
      };

      expect(resolveMappedCardId("SOLAR_DEFAULT", rules)).toBe("NL-MINT-00012345");
      expect(resolveMappedCardId("solar_default", rules)).toBe("NL-MINT-00012345");
    });

    it("should translate card ID using array mapping format", () => {
      const rules = {
        cardMappings: [
          { from: "SOLAR_SURPLUS", to: "NL-FAST-11223344" },
          { from: "INTERNAL_EMS_01", to: "NL-FAST-55667788" },
        ],
      };

      expect(resolveMappedCardId("SOLAR_SURPLUS", rules)).toBe("NL-FAST-11223344");
      expect(resolveMappedCardId("INTERNAL_EMS_01", rules)).toBe("NL-FAST-55667788");
      expect(resolveMappedCardId("OTHER_TAG", rules)).toBe("OTHER_TAG");
    });

    it("should support wildcard fallback mapping if specified", () => {
      const rules = {
        cardIdMapping: {
          SOLAR_KNOWN: "NL-KNOWN-01",
          "*": "NL-DEFAULT-ROAMING",
        },
      };

      expect(resolveMappedCardId("SOLAR_KNOWN", rules)).toBe("NL-KNOWN-01");
      expect(resolveMappedCardId("ANY_UNKNOWN_TAG", rules)).toBe("NL-DEFAULT-ROAMING");
    });

    it("should support solarCardIdMapping alias", () => {
      const rules = {
        solarCardIdMapping: {
          SOLAR_ECO: "NL-ECO-009988",
        },
      };

      expect(resolveMappedCardId("SOLAR_ECO", rules)).toBe("NL-ECO-009988");
    });
  });

  describe("ProxyRouter message interception & translation", () => {
    it("should translate idTag in OCPP 1.6 StartTransaction when forwarding to remoteWs", async () => {
      const chargerId = 101;
      const quirkProfile = {
        id: 1,
        name: "Alfen Solar Quirk",
        rules: {
          cardIdMapping: {
            SOLAR_TAG_ALFEN: "NL-ROAMING-998877",
          },
        },
      };

      (prisma.charger.findUnique as any).mockResolvedValue({
        charger_id: chargerId,
        name: "ALFEN-01",
        quirkProfileId: 1,
        quirkProfile,
      });

      const mockRemoteWs: any = {
        readyState: 1, // WebSocket.OPEN
        send: jest.fn(),
      };

      // Set active proxy
      (proxyRouter as any).activeProxies.set(chargerId, mockRemoteWs);

      const incomingMessage = [
        2,
        "msg-start-001",
        "StartTransaction",
        {
          connectorId: 1,
          idTag: "SOLAR_TAG_ALFEN",
          meterStart: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      await proxyRouter.handleMessageFromCharger(chargerId, incomingMessage, "ocpp1.6");

      expect(mockRemoteWs.send).toHaveBeenCalledTimes(1);
      const sentPayloadStr = mockRemoteWs.send.mock.calls[0][0] as string;
      const sentMessage = JSON.parse(sentPayloadStr);

      expect(sentMessage[0]).toBe(2);
      expect(sentMessage[1]).toBe("msg-start-001");
      expect(sentMessage[2]).toBe("StartTransaction");
      // The forwarded message must have the mapped roaming card ID instead of the solar tag!
      expect(sentMessage[3].idTag).toBe("NL-ROAMING-998877");
    });

    it("should translate idTag in OCPP 1.6 Authorize when forwarding to remoteWs", async () => {
      const chargerId = 102;
      const quirkProfile = {
        id: 2,
        name: "Solar Translation Quirk",
        rules: {
          cardIdMapping: {
            SOLAR_AUTH: "NL-CUSTOMER-445566",
          },
        },
      };

      (prisma.charger.findUnique as any).mockResolvedValue({
        charger_id: chargerId,
        name: "CHARGER-02",
        quirkProfileId: 2,
        quirkProfile,
      });

      const mockRemoteWs: any = {
        readyState: 1,
        send: jest.fn(),
      };

      (proxyRouter as any).activeProxies.set(chargerId, mockRemoteWs);

      const incomingAuthorize = [
        2,
        "msg-auth-001",
        "Authorize",
        {
          idTag: "SOLAR_AUTH",
        },
      ];

      await proxyRouter.handleMessageFromCharger(chargerId, incomingAuthorize, "ocpp1.6");

      expect(mockRemoteWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockRemoteWs.send.mock.calls[0][0] as string);
      expect(sentMessage[3].idTag).toBe("NL-CUSTOMER-445566");
    });

    it("should translate idToken in OCPP 2.0.1 / 2.1 TransactionEvent", async () => {
      const chargerId = 103;
      const quirkProfile = {
        id: 3,
        name: "v201 Solar Quirk",
        rules: {
          cardIdMapping: {
            SOLAR_V201: "NL-FLEET-778899",
          },
        },
      };

      (prisma.charger.findUnique as any).mockResolvedValue({
        charger_id: chargerId,
        name: "CHARGER-03",
        quirkProfileId: 3,
        quirkProfile,
      });

      const mockRemoteWs: any = {
        readyState: 1,
        send: jest.fn(),
      };

      (proxyRouter as any).activeProxies.set(chargerId, mockRemoteWs);

      const incomingTxEvent = [
        2,
        "msg-tx-001",
        "TransactionEvent",
        {
          eventType: "Started",
          idToken: {
            idToken: "SOLAR_V201",
            type: "ISO14443",
          },
          transactionInfo: {
            transactionId: "tx-abc-123",
          },
        },
      ];

      await proxyRouter.handleMessageFromCharger(chargerId, incomingTxEvent, "ocpp2.0.1");

      expect(mockRemoteWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockRemoteWs.send.mock.calls[0][0] as string);
      expect(sentMessage[3].idToken.idToken).toBe("NL-FLEET-778899");
    });
  });

  describe("OCPP Handlers local resolution with Quirk rules", () => {
    it("should authorize solar mode tag using quirk mapping against real RfidUser in v16", async () => {
      const chargerId = 201;
      const quirkProfile = {
        id: 1,
        name: "Solar Mapping",
        rules: {
          cardIdMapping: {
            SOLAR_MODE_TAG: "REAL_RFID_USER_TAG",
          },
        },
      };

      (prisma.charger.findUnique as any).mockResolvedValue({
        charger_id: chargerId,
        chargeGroupId: null,
        quirkProfile,
      });

      // Mapped tag exists in DB as an active user
      (prisma.rfidUser.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.rfid_tag === "REAL_RFID_USER_TAG") {
          return {
            rfid_user_id: 42,
            rfid_tag: "REAL_RFID_USER_TAG",
            active: true,
            name: "Solar EV Owner",
            owner_id: 1,
          };
        }
        return null;
      });

      const response = await v16Handlers.handleAuthorize(chargerId, {
        idTag: "SOLAR_MODE_TAG",
      });

      expect(response.idTagInfo.status).toBe("Accepted");
    });

    it("should authorize solar mode tag using quirk mapping in v21", async () => {
      const chargerId = 202;
      const quirkProfile = {
        id: 2,
        name: "v21 Solar Mapping",
        rules: {
          cardIdMapping: {
            SOLAR_V21_CARD: "REAL_V21_USER",
          },
        },
      };

      (prisma.charger.findUnique as any).mockResolvedValue({
        charger_id: chargerId,
        chargeGroupId: null,
        quirkProfile,
      });

      (prisma.rfidUser.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.rfid_tag === "REAL_V21_USER") {
          return {
            rfid_user_id: 55,
            rfid_tag: "REAL_V21_USER",
            active: true,
            name: "v21 EV Driver",
            owner_id: 1,
          };
        }
        return null;
      });

      const response = await v21Handlers.handleAuthorize(chargerId, {
        idToken: {
          idToken: "SOLAR_V21_CARD",
          type: "ISO14443",
        },
      });

      expect(response.idTokenInfo.status).toBe("Accepted");
    });
  });
});
