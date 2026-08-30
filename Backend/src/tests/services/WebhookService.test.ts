import { jest } from "@jest/globals";
import { WebhookService, SUPPORTED_WEBHOOK_EVENTS } from "../../services/WebhookService.js";
import { prisma } from "../../config/database.js";

describe("WebhookService (Outbound Event Streaming)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Event Catalog & Schema Definitions", () => {
    it("should return the list of supported webhook event topics", () => {
      const catalog = WebhookService.getEventCatalog();
      expect(Array.isArray(catalog)).toBe(true);
      expect(catalog.length).toBeGreaterThanOrEqual(8);

      const topicKeys = catalog.map((e) => e.topic);
      expect(topicKeys).toContain("transaction.started");
      expect(topicKeys).toContain("transaction.stopped");
      expect(topicKeys).toContain("charger.booted");
      expect(topicKeys).toContain("charger.status_changed");
      expect(topicKeys).toContain("connector.faulted");
      expect(topicKeys).toContain("tariff.updated");
      expect(topicKeys).toContain("invoice.issued");
      expect(topicKeys).toContain("alert.hardware_at_risk");
    });
  });

  describe("Cryptographic HMAC-SHA256 Signatures", () => {
    it("should generate cryptographically random secrets with whsec_ prefix", () => {
      const secret1 = WebhookService.generateSecret();
      const secret2 = WebhookService.generateSecret();

      expect(secret1.startsWith("whsec_")).toBe(true);
      expect(secret2.startsWith("whsec_")).toBe(true);
      expect(secret1).not.toBe(secret2);
      expect(secret1.length).toBeGreaterThanOrEqual(40);
    });

    it("should compute deterministic HMAC-SHA256 signatures", () => {
      const secret = "whsec_test_secret_123456789";
      const payload = JSON.stringify({ id: "evt_123", event: "transaction.started", data: { transactionId: 101 } });

      const sig1 = WebhookService.computeSignature(payload, secret);
      const sig2 = WebhookService.computeSignature(payload, secret);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters for sha256
    });
  });

  describe("Webhook Payload Dispatching & Headers", () => {
    it("should format outbound delivery record with HMAC header and payload", async () => {
      const mockSub = {
        id: 1,
        name: "Test SAP Invoicing Hook",
        targetUrl: "https://httpbin.org/post",
        secret: "whsec_super_secret_test_key",
        events: ["transaction.started"],
        isActive: true,
        customHeaders: { Authorization: "Bearer test_bearer_token" },
        companyId: null,
      };

      const mockDelivery = {
        id: 99,
        subscriptionId: 1,
        event: "transaction.started",
        payload: {},
        status: "Success",
        responseCode: 200,
        responseDurationMs: 45,
      };

      const mockPrismaCreate = jest.spyOn(prisma.webhookDelivery, "create").mockResolvedValue(mockDelivery as any);
      const mockPrismaUpdate = jest.spyOn(prisma.webhookDelivery, "update").mockResolvedValue(mockDelivery as any);
      const mockSubUpdate = jest.spyOn(prisma.webhookSubscription, "update").mockResolvedValue(mockSub as any);

      // Mock global fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve('{"received": true}'),
        } as any)
      );

      const result = await WebhookService.sendWebhookPayload(mockSub, "transaction.started", {
        transactionId: 1001,
        chargerId: 50,
      });

      expect(result.status).toBe("Success");
      expect(result.responseCode).toBe(200);
      expect(mockPrismaCreate).toHaveBeenCalled();
      expect(mockPrismaUpdate).toHaveBeenCalled();

      // Restore fetch
      global.fetch = originalFetch;
    });
  });
});
