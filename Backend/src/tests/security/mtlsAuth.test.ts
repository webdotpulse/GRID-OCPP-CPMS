import { jest } from "@jest/globals";
import { config } from "../../config/index.js";
import { prisma } from "../../config/database.js";

const mockPrismaUserFindUnique = jest.spyOn(prisma.user, "findUnique") as any;
const mockPrismaStationFindUnique = jest.spyOn(prisma.chargingStation, "findUnique") as any;
const mockPrismaChargerFindFirst = jest.spyOn(prisma.charger, "findFirst") as any;
const mockPrismaTransactionFindFirst = jest.spyOn(prisma.transaction, "findFirst") as any;
const mockPrismaVehicleFindFirst = jest.spyOn(prisma.vehicleEnergyProfile, "findFirst") as any;

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

describe("Mutual TLS (mTLS) X.509 Authentication & ABAC Enforcement (SEC-01)", () => {
  let verifyMtlsClientCertificate: any;
  let requireResourceAccess: any;

  beforeAll(async () => {
    const ocppServerMod = await import("../../ocpp/ocppServer.js");
    verifyMtlsClientCertificate = ocppServerMod.verifyMtlsClientCertificate;
    const authMod = await import("../../middleware/auth.js");
    requireResourceAccess = authMod.requireResourceAccess;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("mTLS Certificate Verification (verifyMtlsClientCertificate)", () => {
    it("should accept valid client certificate matching charger name", () => {
      const mockReq: any = {
        socket: {
          authorized: true,
          getPeerCertificate: () => ({
            subject: { CN: "CP-AMSTERDAM-01" },
            issuer: { CN: "CPMS Root CA" },
            valid_to: "2030-01-01",
          }),
        },
      };

      const result = verifyMtlsClientCertificate(mockReq, "CP-AMSTERDAM-01", {
        name: "CP-AMSTERDAM-01",
        charger_id: 101,
      });

      expect(result.valid).toBe(true);
      expect(result.cn).toBe("CP-AMSTERDAM-01");
    });

    it("should reject when client certificate CN does not match charger identity", () => {
      const mockReq: any = {
        socket: {
          authorized: true,
          getPeerCertificate: () => ({
            subject: { CN: "CP-ROTTERDAM-99" },
          }),
        },
      };

      const result = verifyMtlsClientCertificate(mockReq, "CP-AMSTERDAM-01", {
        name: "CP-AMSTERDAM-01",
        charger_id: 101,
      });

      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain("mTLS CN Mismatch");
    });

    it("should reject when mTLS is enabled but no client certificate is presented", () => {
      const originalMtls = config.mtlsEnabled;
      config.mtlsEnabled = true;

      const mockReq: any = {
        socket: {
          authorized: false,
          getPeerCertificate: () => ({}),
        },
      };

      const result = verifyMtlsClientCertificate(mockReq, "CP-AMSTERDAM-01");

      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain("mTLS Certificate Required");

      config.mtlsEnabled = originalMtls;
    });

    it("should accept when certificate CN matches charger numeric ID or serial number", () => {
      const mockReq: any = {
        socket: {
          authorized: true,
          getPeerCertificate: () => ({
            subject: { CN: "SN-ABB-987654" },
          }),
        },
      };

      const result = verifyMtlsClientCertificate(mockReq, "105", {
        charger_id: 105,
        name: "Charger 105",
        serial_number: "SN-ABB-987654",
      });

      expect(result.valid).toBe(true);
      expect(result.cn).toBe("SN-ABB-987654");
    });
  });

  describe("Attribute-Based Access Control (ABAC - requireResourceAccess)", () => {
    let mockReq: any;
    let mockRes: any;
    let nextFn: any;

    beforeEach(() => {
      mockReq = {
        userId: 10,
        userRole: "admin",
        params: {},
        body: {},
        query: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      nextFn = jest.fn();
    });

    it("should bypass ABAC checks for superadmin", async () => {
      mockReq.userRole = "superadmin";
      mockReq.params = { id: "99" };

      const middleware = requireResourceAccess("station");
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow Site Manager (admin) access to stations within their company", async () => {
      mockReq.userId = 10;
      mockReq.userRole = "admin";
      mockReq.params = { id: "1" };

      mockPrismaUserFindUnique.mockResolvedValue({
        id: 10,
        companyId: 5,
      });

      mockPrismaStationFindUnique.mockResolvedValue({
        id: 1,
        owner_id: 10,
        owner: { companyId: 5 },
      });

      const middleware = requireResourceAccess("station");
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should deny Site Manager (admin) access to stations belonging to a different company", async () => {
      mockReq.userId = 10;
      mockReq.userRole = "admin";
      mockReq.params = { id: "2" };

      mockPrismaUserFindUnique.mockResolvedValue({
        id: 10,
        companyId: 5,
      });

      mockPrismaStationFindUnique.mockResolvedValue({
        id: 2,
        owner_id: 99,
        owner: { companyId: 999 }, // Different company!
      });

      const middleware = requireResourceAccess("station");
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Access denied"),
        })
      );
    });

    it("should allow EV Driver (user) to view their own charging transaction", async () => {
      mockReq.userId = 50;
      mockReq.userRole = "user";
      mockReq.params = { transactionId: "TX-DRIVER-50" };

      mockPrismaUserFindUnique.mockResolvedValue({
        id: 50,
        email: "driver@example.com",
      });

      mockPrismaTransactionFindFirst.mockResolvedValue({
        id: 100,
        transactionId: "TX-DRIVER-50",
        idTag: "driver@example.com",
        rfidUser: { owner_id: 50 },
      });

      const middleware = requireResourceAccess("transaction");
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("should deny EV Driver (user) from viewing someone else's charging transaction", async () => {
      mockReq.userId = 50;
      mockReq.userRole = "user";
      mockReq.params = { transactionId: "TX-FOREIGN-99" };

      mockPrismaUserFindUnique.mockResolvedValue({
        id: 50,
        email: "driver@example.com",
      });

      mockPrismaTransactionFindFirst.mockResolvedValue({
        id: 999,
        transactionId: "TX-FOREIGN-99",
        idTag: "other_driver@example.com",
        rfidUser: { owner_id: 888 }, // Belongs to user 888!
      });

      const middleware = requireResourceAccess("transaction");
      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Access denied"),
        })
      );
    });
  });
});
