import { jest } from "@jest/globals";

const mockSendDistributedOcppCall = jest.fn() as any;
const mockSendDistributedRemoteCommand = jest.fn() as any;
const mockIsConnectedGlobally = jest.fn() as any;
const mockGetConnectedChargers = jest.fn() as any;

jest.unstable_mockModule("../../config/redis.js", () => ({
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
    exists: jest.fn(),
  },
}));

jest.unstable_mockModule("../../ocpp/distributedRemoteControl.js", () => ({
  sendDistributedOcppCall: mockSendDistributedOcppCall,
  sendDistributedRemoteCommand: mockSendDistributedRemoteCommand,
  getChargerProtocol: jest.fn().mockResolvedValue("ocpp1.6" as never),
  generateMessageId: () => "msg_test_123",
  distributedPendingRequests: new Map(),
}));

jest.unstable_mockModule("../../ocpp/chargerRegistry.js", () => ({
  chargerRegistry: {
    isConnectedGlobally: mockIsConnectedGlobally,
    getConnectedChargers: mockGetConnectedChargers,
  },
}));

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    charger: {
      findUnique: jest.fn().mockResolvedValue(null as never),
    },
    transaction: {
      findFirst: jest.fn().mockResolvedValue(null as never),
    },
  },
}));

describe("remoteControl module delegation", () => {
  let remoteControl: any;

  beforeAll(async () => {
    remoteControl = await import("../../ocpp/remoteControl.js");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("remoteStartTransaction should delegate to sendDistributedRemoteCommand", async () => {
    mockSendDistributedRemoteCommand.mockResolvedValue({ status: "Accepted" });

    const res = await remoteControl.remoteStartTransaction({
      chargerId: 1,
      connectorId: 1,
      idTag: "RFID_ABC",
    });

    expect(res.status).toBe("Accepted");
    expect(mockSendDistributedRemoteCommand).toHaveBeenCalledWith(
      1,
      "Start",
      { connectorId: 1, idTag: "RFID_ABC" }
    );
  });

  it("remoteStopTransaction should delegate to sendDistributedRemoteCommand", async () => {
    mockSendDistributedRemoteCommand.mockResolvedValue({ status: "Accepted" });

    const res = await remoteControl.remoteStopTransaction({
      chargerId: 1,
      transactionId: 555,
    });

    expect(res.status).toBe("Accepted");
    expect(mockSendDistributedRemoteCommand).toHaveBeenCalledWith(
      1,
      "Stop",
      { transactionId: 555 }
    );
  });

  it("resetCharger should delegate to sendDistributedOcppCall", async () => {
    mockSendDistributedOcppCall.mockResolvedValue({ status: "Accepted" });

    const res = await remoteControl.resetCharger(1, "Soft");

    expect(res.status).toBe("Accepted");
    expect(mockSendDistributedOcppCall).toHaveBeenCalledWith(
      1,
      "Reset",
      { type: "Soft" },
      10000
    );
  });

  it("unlockConnector should delegate to sendDistributedOcppCall", async () => {
    mockSendDistributedOcppCall.mockResolvedValue({ status: "Accepted" });

    const res = await remoteControl.unlockConnector(1, 2);

    expect(res.status).toBe("Accepted");
    expect(mockSendDistributedOcppCall).toHaveBeenCalledWith(
      1,
      "UnlockConnector",
      { connectorId: 2 },
      10000
    );
  });

  it("setChargingProfile should delegate to sendDistributedOcppCall", async () => {
    mockSendDistributedOcppCall.mockResolvedValue({ status: "Accepted" });

    const res = await remoteControl.setChargingProfile({
      chargerId: 1,
      connectorId: 1,
      csChargingProfiles: { chargingProfileId: 1 } as any,
    });

    expect(res.status).toBe("Accepted");
    expect(mockSendDistributedOcppCall).toHaveBeenCalledWith(
      1,
      "SetChargingProfile",
      { connectorId: 1, csChargingProfiles: { chargingProfileId: 1 } },
      10000
    );
  });

  it("triggerMessage should delegate to sendDistributedOcppCall", async () => {
    mockSendDistributedOcppCall.mockResolvedValue({ status: "Accepted" });

    const res = await remoteControl.triggerMessage(1, "StatusNotification", 1);

    expect(res.status).toBe("Accepted");
    expect(mockSendDistributedOcppCall).toHaveBeenCalledWith(
      1,
      "TriggerMessage",
      { requestedMessage: "StatusNotification", connectorId: 1 },
      10000
    );
  });
});
