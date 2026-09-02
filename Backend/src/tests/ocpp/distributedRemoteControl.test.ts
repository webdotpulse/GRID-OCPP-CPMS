import { jest } from "@jest/globals";

const mockRedisPublish = jest.fn() as any;
const mockRedisSubscribe = jest.fn() as any;
const mockRedisUnsubscribe = jest.fn() as any;
const mockRedisPsubscribe = jest.fn() as any;
const mockRedisGet = jest.fn() as any;
const mockRedisHget = jest.fn() as any;
const mockRedisExists = jest.fn() as any;

let messageHandler: ((channel: string, message: string) => void) | null = null;

jest.unstable_mockModule("../../config/redis.js", () => ({
  redisPublisher: {
    publish: mockRedisPublish,
  },
  redisSubscriber: {
    subscribe: mockRedisSubscribe,
    unsubscribe: mockRedisUnsubscribe,
    psubscribe: mockRedisPsubscribe,
    on: jest.fn(((event: any, handler: any) => {
      if (event === "message") {
        messageHandler = handler;
      }
    }) as any),
  },
  redisClient: {
    get: mockRedisGet,
    hget: mockRedisHget,
    exists: mockRedisExists,
  },
}));

const mockIsConnectedGlobally = jest.fn() as any;
const mockGetConnection = jest.fn() as any;

jest.unstable_mockModule("../../ocpp/chargerRegistry.js", () => ({
  chargerRegistry: {
    isConnectedGlobally: mockIsConnectedGlobally,
    getConnection: mockGetConnection,
    getRedisKey: (id: number) => `charger:${id}:session`,
    getConnectedChargers: jest.fn().mockResolvedValue([1, 2] as never),
  },
}));

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe("Distributed Remote Control (ARC-02)", () => {
  let distributedRC: any;

  beforeAll(async () => {
    distributedRC = await import("../../ocpp/distributedRemoteControl.js");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisPublish.mockResolvedValue(1);
    mockRedisSubscribe.mockResolvedValue("OK");
    mockRedisUnsubscribe.mockResolvedValue("OK");
  });

  describe("sendDistributedOcppCall", () => {
    it("should reject immediately if charger is not connected globally", async () => {
      mockIsConnectedGlobally.mockResolvedValue(false);

      const result = await distributedRC.sendDistributedOcppCall(
        999,
        "Reset",
        { type: "Soft" }
      );

      expect(result.status).toBe("Rejected");
      expect(result.error).toBe("Charger not connected");
      expect(mockRedisPublish).not.toHaveBeenCalled();
    });

    it("should publish command to ocpp:cmd:${chargerId} and resolve on response channel", async () => {
      mockIsConnectedGlobally.mockResolvedValue(true);

      const callPromise = distributedRC.sendDistributedOcppCall(
        101,
        "Reset",
        { type: "Hard" },
        5000
      );

      await flushPromises();

      // Verify subscription and command publication
      expect(mockRedisSubscribe).toHaveBeenCalledWith(
        expect.stringMatching(/^ocpp:res:msg_/)
      );
      expect(mockRedisPublish).toHaveBeenCalledWith(
        "ocpp:cmd:101",
        expect.stringContaining("Reset")
      );

      // Simulate response arriving on response channel
      const responseChannel = mockRedisSubscribe.mock.calls[0][0];
      const messageId = responseChannel.substring("ocpp:res:".length);

      messageHandler?.(
        responseChannel,
        JSON.stringify({ messageId, status: "Accepted" })
      );

      const result = await callPromise;
      expect(result.status).toBe("Accepted");
      expect(mockRedisUnsubscribe).toHaveBeenCalledWith(responseChannel);
    });

    it("should resolve via global ocpp_callresults channel fallback", async () => {
      mockIsConnectedGlobally.mockResolvedValue(true);

      const callPromise = distributedRC.sendDistributedOcppCall(
        102,
        "UnlockConnector",
        { connectorId: 1 },
        5000
      );

      await flushPromises();

      const responseChannel = mockRedisSubscribe.mock.calls[0][0];
      const messageId = responseChannel.substring("ocpp:res:".length);

      messageHandler?.(
        "ocpp_callresults",
        JSON.stringify({
          messageId,
          status: "Accepted",
          payload: { status: "Unlocked" },
        })
      );

      const result = await callPromise;
      expect(result.status).toBe("Unlocked");
    });

    it("should reject on timeout if no response arrives within timeoutMs", async () => {
      mockIsConnectedGlobally.mockResolvedValue(true);

      const result = await distributedRC.sendDistributedOcppCall(
        103,
        "GetConfiguration",
        {},
        50 // short 50ms timeout
      );

      expect(result.status).toBe("Rejected");
      expect(result.error).toContain("Timeout waiting for GetConfiguration response");
    });
  });

  describe("sendDistributedRemoteCommand (Protocol mapping)", () => {
    it("should format OCPP 1.6 RemoteStartTransaction correctly", async () => {
      mockIsConnectedGlobally.mockResolvedValue(true);
      mockGetConnection.mockReturnValue({ protocol: "ocpp1.6" });

      const callPromise = distributedRC.sendDistributedRemoteCommand(
        104,
        "Start",
        { connectorId: 1, idTag: "TAG_001" },
        5000
      );

      await flushPromises();

      expect(mockRedisPublish).toHaveBeenCalledWith(
        "ocpp:cmd:104",
        expect.stringContaining("RemoteStartTransaction")
      );

      const responseChannel = mockRedisSubscribe.mock.calls[0][0];
      messageHandler?.(responseChannel, JSON.stringify({ status: "Accepted" }));

      const result = await callPromise;
      expect(result.status).toBe("Accepted");
    });

    it("should format OCPP 2.1 RequestStartTransaction correctly", async () => {
      mockIsConnectedGlobally.mockResolvedValue(true);
      mockGetConnection.mockReturnValue({ protocol: "ocpp2.1" });

      const callPromise = distributedRC.sendDistributedRemoteCommand(
        105,
        "Start",
        { connectorId: 2, idTag: "TAG_002" },
        5000
      );

      await flushPromises();

      expect(mockRedisPublish).toHaveBeenCalledWith(
        "ocpp:cmd:105",
        expect.stringContaining("RequestStartTransaction")
      );

      const responseChannel = mockRedisSubscribe.mock.calls[0][0];
      messageHandler?.(responseChannel, JSON.stringify({ status: "Accepted" }));

      const result = await callPromise;
      expect(result.status).toBe("Accepted");
    });
  });
});
