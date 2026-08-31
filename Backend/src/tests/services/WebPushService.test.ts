import { jest } from "@jest/globals";

const mockSendNotification = jest.fn() as any;

jest.unstable_mockModule("web-push", () => ({
  default: {
    generateVAPIDKeys: jest.fn().mockReturnValue({
      publicKey: "mock-vapid-public-key",
      privateKey: "mock-vapid-private-key",
    }),
    setVapidDetails: jest.fn(),
    sendNotification: mockSendNotification,
  },
}));

const { WebPushService } = await import("../../services/WebPushService.js");
const { prisma } = await import("../../config/database.js");

describe("WebPushService & Mobile Notification Milestones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize VAPID keys and return public key", async () => {
    jest.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);
    jest.spyOn(prisma.systemSetting, "upsert").mockResolvedValue({ key: "k", value: "v", updatedAt: new Date() } as any);

    const { publicKey } = await WebPushService.initVapidKeys();
    expect(publicKey).toBeDefined();
    expect(typeof publicKey).toBe("string");
  });

  it("should subscribe user endpoint", async () => {
    const mockSub = {
      id: 1,
      userId: 10,
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      p256dh: "key-p256dh",
      auth: "key-auth",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(prisma.pushSubscription, "upsert").mockResolvedValue(mockSub as any);

    const res = await WebPushService.subscribe(10, {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      keys: { p256dh: "key-p256dh", auth: "key-auth" },
    });

    expect(res.userId).toBe(10);
    expect(res.endpoint).toContain("test-endpoint");
  });

  it("should send 80% SoC milestone notification", async () => {
    jest.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
      {
        id: 1,
        userId: 10,
        endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
        p256dh: "key-1",
        auth: "auth-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await WebPushService.sendSoc80Notification(10, "Station Amsterdam Bay 2", 80);

    expect(result.successCount).toBe(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/fcm/send/device-1" }),
      expect.stringContaining("Battery Reached 80% SoC")
    );
  });

  it("should send Charging Complete notification", async () => {
    jest.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
      {
        id: 2,
        userId: 10,
        endpoint: "https://fcm.googleapis.com/fcm/send/device-2",
        p256dh: "key-2",
        auth: "auth-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await WebPushService.sendChargingCompleteNotification(10, "Station Fast-01", 42.5, 14.88);

    expect(result.successCount).toBe(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Charging Completed")
    );
  });

  it("should send Idle Fee Alert notification", async () => {
    jest.spyOn(prisma.pushSubscription, "findMany").mockResolvedValue([
      {
        id: 3,
        userId: 10,
        endpoint: "https://fcm.googleapis.com/fcm/send/device-3",
        p256dh: "key-3",
        auth: "auth-3",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await WebPushService.sendIdleFeeAlertNotification(10, "Hub Rotterdam A3", 0.25);

    expect(result.successCount).toBe(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Idle Fee Alert in 15 Minutes")
    );
  });
});
