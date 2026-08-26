import { jest } from "@jest/globals";
import { createHmacSignature, verifyHmacSignature, verifyWebhookSignatureMiddleware } from "../../utils/security.js";

const mockPrismaAuditLogCreate = jest.fn() as any;
const mockPrismaAuditLogFindMany = jest.fn() as any;
const mockPrismaAuditLogCount = jest.fn() as any;

jest.mock("../../config/database.js", () => ({
  prisma: {
    auditLog: {
      create: mockPrismaAuditLogCreate,
      findMany: mockPrismaAuditLogFindMany,
      count: mockPrismaAuditLogCount,
    },
  },
}));

jest.mock("../../config/redis.js", () => ({
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

describe("HMAC Webhook Verification & Audit Logging Ledger (SEC-02)", () => {
  let AuditLogService: any;
  let auditLogMiddleware: any;

  beforeAll(async () => {
    const auditServiceMod = await import("../../services/AuditLogService.js");
    AuditLogService = auditServiceMod.AuditLogService;
    const auditMiddlewareMod = await import("../../middleware/audit.js");
    auditLogMiddleware = auditMiddlewareMod.auditLogMiddleware;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("HMAC SHA-256 Signature Verification (security.ts)", () => {
    const secret = "super-secret-webhook-key-12345";
    const payload = { id: "tr_12345", amount: "25.00", status: "paid" };

    it("should generate and verify a valid HMAC-SHA256 signature", () => {
      const signature = createHmacSignature(payload, secret);
      expect(signature).toBeDefined();

      const verification = verifyHmacSignature(payload, signature, secret);
      expect(verification.valid).toBe(true);
    });

    it("should reject a tampered payload", () => {
      const signature = createHmacSignature(payload, secret);
      const tamperedPayload = { ...payload, amount: "250.00" };

      const verification = verifyHmacSignature(tamperedPayload, signature, secret);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("HMAC signature mismatch");
    });

    it("should reject an invalid secret", () => {
      const signature = createHmacSignature(payload, secret);
      const verification = verifyHmacSignature(payload, signature, "wrong-secret");

      expect(verification.valid).toBe(false);
    });

    it("should verify signature with timestamp and prevent replay attacks", () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const signature = createHmacSignature(payload, secret, currentTimestamp);

      // Fresh timestamp (within tolerance)
      const validCheck = verifyHmacSignature(payload, signature, secret, String(currentTimestamp), 300);
      expect(validCheck.valid).toBe(true);

      // Expired timestamp (10 minutes old > 5 minutes tolerance)
      const oldTimestamp = currentTimestamp - 600;
      const expiredSignature = createHmacSignature(payload, secret, oldTimestamp);
      const expiredCheck = verifyHmacSignature(payload, expiredSignature, secret, String(oldTimestamp), 300);

      expect(expiredCheck.valid).toBe(false);
      expect(expiredCheck.reason).toContain("expired or outside tolerance window");
    });
  });

  describe("verifyWebhookSignatureMiddleware", () => {
    const secret = "webhook-test-secret";
    const middleware = verifyWebhookSignatureMiddleware(secret);

    it("should accept valid webhook signature header and call next", () => {
      const payload = { event: "charge.completed", id: "evt_1" };
      const signature = createHmacSignature(payload, secret);

      const req: any = {
        body: payload,
        headers: {
          "x-signature-256": signature,
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject request missing signature header with 401", () => {
      const req: any = {
        body: { event: "charge.completed" },
        headers: {},
        ip: "192.168.1.100",
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Missing webhook HMAC signature"),
        })
      );
    });
  });

  describe("AuditLogService", () => {
    it("should record an audit log and sanitize sensitive credentials", async () => {
      mockPrismaAuditLogCreate.mockResolvedValue({
        id: 1,
        userId: 5,
        action: "UPDATE_TARIFF",
        target: "Tariff",
        targetId: "10",
        payload: { name: "Peak Tariff", electricity_rate: 0.35, apiKey: "[REDACTED]" },
        ip: "10.0.0.1",
        createdAt: new Date(),
      });

      const log = await AuditLogService.recordLog({
        userId: 5,
        action: "UPDATE_TARIFF",
        target: "Tariff",
        targetId: 10,
        payload: {
          name: "Peak Tariff",
          electricity_rate: 0.35,
          apiKey: "sk_test_secret_key_12345",
          password: "mySecretPassword123!",
        },
        ip: "10.0.0.1",
      });

      expect(log).toBeDefined();
      expect(mockPrismaAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 5,
            action: "UPDATE_TARIFF",
            target: "Tariff",
            targetId: "10",
            payload: expect.objectContaining({
              apiKey: "[REDACTED]",
              password: "[REDACTED]",
            }),
          }),
        })
      );
    });

    it("should query audit logs with filters and pagination", async () => {
      mockPrismaAuditLogCount.mockResolvedValue(1);
      mockPrismaAuditLogFindMany.mockResolvedValue([
        {
          id: 1,
          action: "RESET_CHARGER",
          target: "Charger",
          targetId: "101",
          createdAt: new Date(),
        },
      ]);

      const result = await AuditLogService.getLogs({
        target: "Charger",
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe("RESET_CHARGER");
    });
  });

  describe("auditLogMiddleware", () => {
    it("should hook response finish event and record audit log on successful mutation", () => {
      const middleware = auditLogMiddleware("UPDATE_TARIFF", "Tariff");
      let finishCallback: any;

      const req: any = {
        method: "PUT",
        userId: 12,
        params: { id: "10" },
        body: { electricity_rate: 0.40 },
        ip: "127.0.0.1",
        headers: { "user-agent": "Mozilla/5.0" },
      };

      const res: any = {
        statusCode: 200,
        on: jest.fn().mockImplementation(((event: any, cb: any) => {
          if (event === "finish") finishCallback = cb;
        }) as any),
      };

      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));

      // Trigger finish
      mockPrismaAuditLogCreate.mockResolvedValue({ id: 2 });
      finishCallback();

      expect(mockPrismaAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 12,
            action: "UPDATE_TARIFF",
            target: "Tariff",
            targetId: "10",
          }),
        })
      );
    });

    it("should ignore non-mutating GET requests", () => {
      const middleware = auditLogMiddleware();
      const req: any = { method: "GET" };
      const res: any = { on: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.on).not.toHaveBeenCalled();
    });
  });
});
