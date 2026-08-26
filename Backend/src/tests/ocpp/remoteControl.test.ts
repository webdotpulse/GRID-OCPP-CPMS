import { jest } from "@jest/globals";

const mockSendDistributedOcppCall = jest.fn() as any;
const mockSendDistributedRemoteCommand = jest.fn() as any;
const mockIsConnectedGlobally = jest.fn() as any;
const mockGetConnectedChargers = jest.fn() as any;

jest.mock("../../ocpp/distributedRemoteControl.js", () => ({
  sendDistributedOcppCall: mockSendDistributedOcppCall,
  sendDistributedRemoteCommand: mockSendDistributedRemoteCommand,
  getChargerProtocol: jest.fn().mockResolvedValue("ocpp1.6" as never),
  generateMessageId: () => "msg_test_123",
  distributedPendingRequests: new Map(),
}));

jest.mock("../../ocpp/chargerRegistry.js", () => ({
  chargerRegistry: {
    isConnectedGlobally: mockIsConnectedGlobally,
    getConnectedChargers: mockGetConnectedChargers,
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
