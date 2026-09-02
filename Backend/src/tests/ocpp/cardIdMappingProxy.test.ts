import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/redis.js', () => ({
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
    hget: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
  },
}));

const { prisma } = await import('../../config/database.js');
const { resolveMappedCardId } = await import('../../ocpp/quirkNormalizer.js');
const { proxyRouter, formatProxyUrl } = await import('../../ocpp/proxyRouter.js');
const { chargerRegistry } = await import('../../ocpp/chargerRegistry.js');
const v16Handlers = await import('../../ocpp/handlers/v16Handlers.js');
const v21Handlers = await import('../../ocpp/handlers/v21Handlers.js');

describe("Solar Mode Card ID Translation & Resilient Proxy Routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    proxyRouter.clearQuirkRulesCache();
    jest.spyOn(prisma.ocppLog, 'create').mockResolvedValue({} as any);
  });

  describe("formatProxyUrl helper", () => {
    it("should format plain ws and wss URLs correctly", () => {
      expect(formatProxyUrl("ws://127.0.0.1:9000/ocpp", "CP001")).toBe("ws://127.0.0.1:9000/ocpp/CP001");
      expect(formatProxyUrl("wss://steve.cpo.com/ocpp/", "CP001")).toBe("wss://steve.cpo.com/ocpp/CP001");
    });

    it("should convert http and https URLs to ws and wss", () => {
      expect(formatProxyUrl("http://localhost:9000/ocpp", "CP001")).toBe("ws://localhost:9000/ocpp/CP001");
      expect(formatProxyUrl("https://csms.cpo.com/ocpp", "CP001")).toBe("wss://csms.cpo.com/ocpp/CP001");
    });

    it("should not double-append charger identifier if already in path", () => {
      expect(formatProxyUrl("wss://csms.cpo.com/ocpp/CP001", "CP001")).toBe("wss://csms.cpo.com/ocpp/CP001");
    });
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

    it("should map ALL incoming cards to 1 single target card when mapAllCardsTo is configured", () => {
      const rules = {
        mapAllCardsTo: "NL-MASTER-UNIVERSAL-01",
      };

      expect(resolveMappedCardId("SOLAR_001", rules)).toBe("NL-MASTER-UNIVERSAL-01");
      expect(resolveMappedCardId("CUSTOM_TAG_999", rules)).toBe("NL-MASTER-UNIVERSAL-01");
      expect(resolveMappedCardId("UNKNOWN_ROAMING_CARD", rules)).toBe("NL-MASTER-UNIVERSAL-01");
      expect(resolveMappedCardId("ISO15118_EMAID_XYZ", rules)).toBe("NL-MASTER-UNIVERSAL-01");
    });

    it("should map ALL incoming cards to 1 single target card when singleCardId is configured", () => {
      const rules = {
        singleCardId: "NL-SINGLE-FLEET-CARD",
      };

      expect(resolveMappedCardId("ANY_CARD_ABC", rules)).toBe("NL-SINGLE-FLEET-CARD");
      expect(resolveMappedCardId("EVE_SOLAR_TAG", rules)).toBe("NL-SINGLE-FLEET-CARD");
    });

    it("should support ALL wildcard in cardIdMapping to map all incoming cards to 1 single card", () => {
      const rules = {
        cardIdMapping: {
          ALL: "NL-ALL-CARDS-SINGLE",
        },
      };

      expect(resolveMappedCardId("CARD_1", rules)).toBe("NL-ALL-CARDS-SINGLE");
      expect(resolveMappedCardId("CARD_2", rules)).toBe("NL-ALL-CARDS-SINGLE");
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

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: chargerId,
        name: "ALFEN-01",
        quirkProfileId: 1,
        quirkProfile,
      } as any);

      const mockRemoteWs: any = {
        readyState: 1, // WebSocket.OPEN
        send: jest.fn(),
      };

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

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: chargerId,
        name: "CHARGER-02",
        quirkProfileId: 2,
        quirkProfile,
      } as any);

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

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: chargerId,
        name: "CHARGER-03",
        quirkProfileId: 3,
        quirkProfile,
      } as any);

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

  describe("Proxy Resilience: Local Responses when Upstream is Disconnected", () => {
    it("should deliver local CALLRESULT to physical charger when remoteWs is not connected", async () => {
      const chargerId = 104;
      const mockLocalWs: any = {
        readyState: 1,
        send: jest.fn(),
      };

      jest.spyOn(chargerRegistry, 'getConnection').mockReturnValue({
        ws: mockLocalWs,
        chargerId,
        chargerName: "OFFLINE_PROXY_CHARGER",
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        transactions: new Map(),
      } as any);

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: chargerId,
        name: "OFFLINE_PROXY_CHARGER",
        quirkProfile: null,
      } as any);

      jest.spyOn(prisma.charger, 'update').mockResolvedValue({} as any);

      // No remote WS in activeProxies
      (proxyRouter as any).activeProxies.delete(chargerId);

      const incomingHeartbeat = [2, "hb-104", "Heartbeat", {}];

      await proxyRouter.handleMessageFromCharger(chargerId, incomingHeartbeat, "ocpp1.6");

      // Verify local response is immediately delivered to charger connection so it doesn't time out
      expect(mockLocalWs.send).toHaveBeenCalledTimes(1);
      const sentResponse = JSON.parse(mockLocalWs.send.mock.calls[0][0] as string);
      expect(sentResponse[0]).toBe(3); // CALLRESULT
      expect(sentResponse[1]).toBe("hb-104");
      expect(sentResponse[2]).toHaveProperty("currentTime");
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

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: chargerId,
        owner_id: 1,
        isPublic: true,
        chargeGroupId: null,
        quirkProfile,
      } as any);

      (jest.spyOn(prisma.rfidUser, 'findUnique') as any).mockImplementation(async ({ where }: any) => {
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

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: chargerId,
        owner_id: 1,
        isPublic: true,
        chargeGroupId: null,
        quirkProfile,
      } as any);

      (jest.spyOn(prisma.rfidUser, 'findUnique') as any).mockImplementation(async ({ where }: any) => {
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
