import { jest } from "@jest/globals";
import { isSafeExternalUrl } from "../../api/oicp/oicp.controller.js";
import { verifyChargerOwnership } from "../../api/ocpp/ocpp.controller.js";
import { sanitizeCsvField } from "../../utils/validation.js";
import { prisma } from "../../config/database.js";
import { config } from "../../config/index.js";
import { isSuperAdminOrAdmin } from "../../middleware/auth.js";
import jwt from "jsonwebtoken";

describe("Security Remediation Suite (SEC-01 through SEC-06)", () => {
  describe("SEC-06: OICP SSRF Protection (isSafeExternalUrl)", () => {
    it("should allow valid public HTTPS and HTTP URLs", () => {
      expect(isSafeExternalUrl("https://api.hubject.com/oicp/v2.3").valid).toBe(true);
      expect(isSafeExternalUrl("https://roaming.open-charge-point.eu/api").valid).toBe(true);
      expect(isSafeExternalUrl("http://8.8.8.8/test").valid).toBe(true);
      expect(isSafeExternalUrl("https://93.184.216.34:8443/oicp").valid).toBe(true);
    });

    it("should reject non-HTTP/HTTPS protocols", () => {
      expect(isSafeExternalUrl("ftp://example.com/file").valid).toBe(false);
      expect(isSafeExternalUrl("file:///etc/passwd").valid).toBe(false);
      expect(isSafeExternalUrl("gopher://127.0.0.1/").valid).toBe(false);
      expect(isSafeExternalUrl("javascript:alert(1)").valid).toBe(false);
    });

    it("should block loopback addresses and hostnames", () => {
      expect(isSafeExternalUrl("http://localhost:3000/api").valid).toBe(false);
      expect(isSafeExternalUrl("http://localhost/").valid).toBe(false);
      expect(isSafeExternalUrl("http://127.0.0.1:8080").valid).toBe(false);
      expect(isSafeExternalUrl("http://127.0.0.2/secret").valid).toBe(false);
      expect(isSafeExternalUrl("http://0.0.0.0/").valid).toBe(false);
      expect(isSafeExternalUrl("http://[::1]:3000/").valid).toBe(false);
      expect(isSafeExternalUrl("http://subdomain.localhost").valid).toBe(false);
      expect(isSafeExternalUrl("http://internal.service.local").valid).toBe(false);
      expect(isSafeExternalUrl("http://db.internal").valid).toBe(false);
    });

    it("should block cloud metadata IP addresses and hostnames", () => {
      expect(isSafeExternalUrl("http://169.254.169.254/latest/meta-data").valid).toBe(false);
      expect(isSafeExternalUrl("http://metadata.google.internal/computeMetadata/v1/").valid).toBe(false);
      expect(isSafeExternalUrl("http://instance-data/latest/meta-data").valid).toBe(false);
    });

    it("should block private RFC1918 IPv4 ranges", () => {
      // 10.0.0.0/8
      expect(isSafeExternalUrl("http://10.0.0.1:8080").valid).toBe(false);
      expect(isSafeExternalUrl("http://10.255.255.254").valid).toBe(false);

      // 172.16.0.0/12
      expect(isSafeExternalUrl("http://172.16.0.1/").valid).toBe(false);
      expect(isSafeExternalUrl("http://172.31.255.255/").valid).toBe(false);

      // 192.168.0.0/16
      expect(isSafeExternalUrl("http://192.168.1.1/admin").valid).toBe(false);
      expect(isSafeExternalUrl("http://192.168.0.100").valid).toBe(false);

      // CGNAT 100.64.0.0/10
      expect(isSafeExternalUrl("http://100.64.0.1").valid).toBe(false);
    });

    it("should block private and link-local IPv6 ranges", () => {
      expect(isSafeExternalUrl("http://[fc00::1]/api").valid).toBe(false);
      expect(isSafeExternalUrl("http://[fd12:3456:789a::1]/").valid).toBe(false);
      expect(isSafeExternalUrl("http://[fe80::1ff:fe23:4567:890a]/").valid).toBe(false);
    });

    it("should reject invalid URL strings", () => {
      expect(isSafeExternalUrl("").valid).toBe(false);
      expect(isSafeExternalUrl("not a url").valid).toBe(false);
      expect(isSafeExternalUrl(null as any).valid).toBe(false);
    });
  });

  describe("SEC-05: Charger Ownership Authorization (verifyChargerOwnership)", () => {
    it("should grant access to superadmins for any existing charger", async () => {
      const mockFindUnique = jest.spyOn(prisma.charger, "findUnique").mockResolvedValue({
        charger_id: 101,
        owner_id: 50,
      } as any);

      const result = await verifyChargerOwnership(101, 999, "superadmin");
      expect(result.exists).toBe(true);
      expect(result.authorized).toBe(true);

      mockFindUnique.mockRestore();
    });

    it("should grant access to owner user/admin for their own charger", async () => {
      const mockFindUnique = jest.spyOn(prisma.charger, "findUnique").mockResolvedValue({
        charger_id: 101,
        owner_id: 42,
      } as any);

      const result = await verifyChargerOwnership(101, 42, "admin");
      expect(result.exists).toBe(true);
      expect(result.authorized).toBe(true);

      mockFindUnique.mockRestore();
    });

    it("should deny access to users attempting to control another tenant's charger", async () => {
      const mockFindUnique = jest.spyOn(prisma.charger, "findUnique").mockResolvedValue({
        charger_id: 101,
        owner_id: 42,
      } as any);

      const result = await verifyChargerOwnership(101, 99, "admin");
      expect(result.exists).toBe(true);
      expect(result.authorized).toBe(false);

      mockFindUnique.mockRestore();
    });

    it("should report exists: false for non-existent chargers", async () => {
      const mockFindUnique = jest.spyOn(prisma.charger, "findUnique").mockResolvedValue(null);

      const result = await verifyChargerOwnership(9999, 42, "admin");
      expect(result.exists).toBe(false);
      expect(result.authorized).toBe(false);

      mockFindUnique.mockRestore();
    });
  });

  describe("SEC-02: Email Verification Token Generation & Validation", () => {
    it("should sign and verify valid email verification tokens", () => {
      const token = jwt.sign(
        { userId: 123, email: "user@example.com", type: "email-verification" },
        config.jwtSecret,
        { expiresIn: "24h" }
      );

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      expect(decoded.userId).toBe(123);
      expect(decoded.email).toBe("user@example.com");
      expect(decoded.type).toBe("email-verification");
    });

    it("should reject verification tokens with invalid signature or expired", () => {
      const invalidToken = jwt.sign(
        { userId: 123, type: "email-verification" },
        "wrong-secret"
      );

      expect(() => {
        jwt.verify(invalidToken, config.jwtSecret);
      }).toThrow();
    });
  });

  describe("SEC-CSV: CSV Formula Injection Sanitization (sanitizeCsvField)", () => {
    it("should sanitize cells starting with formula trigger characters (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvField("+123456789")).toBe("'+123456789");
      expect(sanitizeCsvField("-500")).toBe("'-500");
      expect(sanitizeCsvField("@cmd|'/C calc'!A0")).toBe("'@cmd|'/C calc'!A0");
      expect(sanitizeCsvField("\tTabPrefixed")).toBe("'\tTabPrefixed");
    });

    it("should leave benign alphanumeric strings untouched", () => {
      expect(sanitizeCsvField("Charger-01")).toBe("Charger-01");
      expect(sanitizeCsvField("Alfen Eve Single")).toBe("Alfen Eve Single");
      expect(sanitizeCsvField("123.45")).toBe("123.45");
      expect(sanitizeCsvField("")).toBe("");
      expect(sanitizeCsvField(null)).toBe("");
      expect(sanitizeCsvField(undefined)).toBe("");
    });

    it("should escape quotes and wrap in double quotes if commas or quotes are present", () => {
      expect(sanitizeCsvField('Hello, "World"')).toBe('"Hello, ""World"""');
    });
  });

  describe("SEC-OCPI: OCPI Roaming Token Authentication (authenticateOcpiToken)", () => {
    it("should reject requests with missing authorization header with 401", async () => {
      const { authenticateOcpiToken } = await import("../../middleware/ocpiAuth.js");
      const req: any = { headers: {}, method: "POST", originalUrl: "/api/ocpi/2.2.1/commands/UNLOCK_CONNECTOR" };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await authenticateOcpiToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status_code: 2001, status_message: "Missing Authorization header" })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should authenticate valid partner token", async () => {
      const { authenticateOcpiToken } = await import("../../middleware/ocpiAuth.js");
      const mockFind = jest.spyOn(prisma.ocpiEndpoint, "findFirst").mockResolvedValue({
        id: 1,
        token: "valid-ocpi-token-12345",
        status: "active",
      } as any);

      const req: any = {
        headers: { authorization: "Token valid-ocpi-token-12345" },
        method: "POST",
        originalUrl: "/api/ocpi/2.2.1/commands/START_SESSION",
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await authenticateOcpiToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.ocpiEndpoint).toBeDefined();

      mockFind.mockRestore();
    });

    it("should authenticate loopback requests using TEST_ROAMING_SUITE_TOKEN", async () => {
      const { authenticateOcpiToken } = await import("../../middleware/ocpiAuth.js");
      const req: any = {
        headers: { authorization: "Token TEST_ROAMING_SUITE_TOKEN" },
        method: "GET",
        originalUrl: "/api/ocpi/2.2.1/locations",
        ip: "127.0.0.1",
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await authenticateOcpiToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.ocpiEndpoint).toBeDefined();
      expect(req.ocpiEndpoint.name).toBe("Local CPMS Test Sandbox");
    });

    it("should authenticate loopback requests using X-Test-Suite header", async () => {
      const { authenticateOcpiToken } = await import("../../middleware/ocpiAuth.js");
      const req: any = {
        headers: {
          authorization: "Token ANY_LOCAL_TOKEN",
          "x-test-suite": "GRID-CPMS-TEST-SUITE",
        },
        method: "GET",
        originalUrl: "/api/ocpi/2.2.1/locations",
        ip: "::1",
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await authenticateOcpiToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.ocpiEndpoint).toBeDefined();
    });

    it("should reject TEST_ROAMING_SUITE_TOKEN from non-loopback external IP with 401", async () => {
      const { authenticateOcpiToken } = await import("../../middleware/ocpiAuth.js");
      const mockFind = jest.spyOn(prisma.ocpiEndpoint, "findFirst").mockResolvedValue(null as any);
      const mockPartner = jest.spyOn(prisma.roamingPartner, "findMany").mockResolvedValue([] as any);

      const req: any = {
        headers: { authorization: "Token TEST_ROAMING_SUITE_TOKEN" },
        method: "GET",
        originalUrl: "/api/ocpi/2.2.1/locations",
        ip: "198.51.100.42",
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await authenticateOcpiToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();

      mockFind.mockRestore();
      mockPartner.mockRestore();
    });
  });

  describe("Rate Limiting Exemption for Admin & Super Admin (isSuperAdminOrAdmin)", () => {
    it("should exempt requests with a valid superadmin Bearer token", () => {
      const token = jwt.sign({ userId: 1, email: "super@cpms.com", role: "superadmin" }, config.jwtSecret);
      const req: any = {
        headers: { authorization: `Bearer ${token}` },
      };
      expect(isSuperAdminOrAdmin(req)).toBe(true);
    });

    it("should exempt requests with a valid admin Bearer token", () => {
      const token = jwt.sign({ userId: 2, email: "admin@cpms.com", role: "admin" }, config.jwtSecret);
      const req: any = {
        headers: { authorization: `Bearer ${token}` },
      };
      expect(isSuperAdminOrAdmin(req)).toBe(true);
    });

    it("should exempt requests with a valid admin token in query parameter", () => {
      const token = jwt.sign({ userId: 3, email: "admin@cpms.com", role: "admin" }, config.jwtSecret);
      const req: any = {
        headers: {},
        query: { token },
      };
      expect(isSuperAdminOrAdmin(req)).toBe(true);
    });

    it("should exempt requests with a valid admin token in x-access-token header", () => {
      const token = jwt.sign({ userId: 4, email: "admin@cpms.com", role: "admin" }, config.jwtSecret);
      const req: any = {
        headers: { "x-access-token": token },
      };
      expect(isSuperAdminOrAdmin(req)).toBe(true);
    });

    it("should NOT exempt regular users (role: 'user')", () => {
      const token = jwt.sign({ userId: 5, email: "driver@cpms.com", role: "user" }, config.jwtSecret);
      const req: any = {
        headers: { authorization: `Bearer ${token}` },
      };
      expect(isSuperAdminOrAdmin(req)).toBe(false);
    });

    it("should NOT exempt unauthenticated requests", () => {
      const req: any = {
        headers: {},
      };
      expect(isSuperAdminOrAdmin(req)).toBe(false);
    });

    it("should NOT exempt requests with invalid or malformed tokens", () => {
      const req: any = {
        headers: { authorization: "Bearer not-a-valid-jwt" },
      };
      expect(isSuperAdminOrAdmin(req)).toBe(false);
    });
  });
});

