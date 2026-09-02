import { jest } from "@jest/globals";
import { authenticateToken, requireAdmin, requireSuperAdmin, requireRole, generateToken, AuthRequest } from "../../middleware/auth.js";
import { config } from "../../config/index.js";
import jwt from "jsonwebtoken";

describe("Auth Middleware Suite (CLN-02)", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      headers: {},
      method: "GET",
      originalUrl: "/api/test",
      baseUrl: "/api",
      path: "/test",
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe("authenticateToken", () => {
    it("should return 401 when Authorization header is missing", () => {
      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Access token required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when token is invalid or malformed", () => {
      mockReq.headers["authorization"] = "Bearer invalid-token-string";

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid or expired token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when token is expired", () => {
      const expiredToken = jwt.sign(
        { userId: 10, email: "user@example.com", role: "user" },
        config.jwtSecret,
        { expiresIn: "0s" }
      );
      mockReq.headers["authorization"] = `Bearer ${expiredToken}`;

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid or expired token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should authenticate valid user token and attach userId and userRole", () => {
      const token = generateToken(42, "regular@example.com", "user");
      mockReq.headers["authorization"] = `Bearer ${token}`;

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.userId).toBe(42);
      expect(mockReq.userRole).toBe("user");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow regular users to perform write methods (POST, PUT, DELETE) without global blanket block", () => {
      const token = generateToken(42, "regular@example.com", "user");
      mockReq.headers["authorization"] = `Bearer ${token}`;
      mockReq.method = "POST";
      mockReq.originalUrl = "/api/reimbursements/contracts";

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.userId).toBe(42);
      expect(mockReq.userRole).toBe("user");
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should authenticate admin and superadmin tokens", () => {
      const adminToken = generateToken(1, "admin@example.com", "admin");
      mockReq.headers["authorization"] = `Bearer ${adminToken}`;
      mockReq.method = "PUT";

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.userId).toBe(1);
      expect(mockReq.userRole).toBe("admin");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should authenticate using token passed in query parameter (for direct wallet/pass downloads)", () => {
      const userToken = generateToken(77, "passholder@example.com", "user");
      mockReq.headers = {}; // No authorization header
      mockReq.query = { token: userToken };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.userId).toBe(77);
      expect(mockReq.userRole).toBe("user");
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should authenticate using token in x-access-token header", () => {
      const token = generateToken(88, "headeruser@example.com", "admin");
      mockReq.headers = { "x-access-token": token };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.userId).toBe(88);
      expect(mockReq.userRole).toBe("admin");
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("should call next() for role 'admin'", () => {
      mockReq.userRole = "admin";

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should call next() for role 'superadmin'", () => {
      mockReq.userRole = "superadmin";

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 403 for role 'user'", () => {
      mockReq.userRole = "user";

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Admin access required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 when userRole is undefined", () => {
      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Admin access required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireSuperAdmin", () => {
    it("should call next() for role 'superadmin'", () => {
      mockReq.userRole = "superadmin";

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 403 for role 'admin'", () => {
      mockReq.userRole = "admin";

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Superadmin access required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 for role 'user'", () => {
      mockReq.userRole = "user";

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Superadmin access required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    it("should allow specified allowed role", () => {
      mockReq.userRole = "manager";
      const middleware = requireRole("manager", "admin");

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should always allow superadmin even if not explicitly listed", () => {
      mockReq.userRole = "superadmin";
      const middleware = requireRole("operator");

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 403 when role is not in allowed roles", () => {
      mockReq.userRole = "viewer";
      const middleware = requireRole("manager", "admin");

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Insufficient permissions. Required role(s): manager, admin",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("generateToken", () => {
    it("should generate a signed JWT with userId, email, and role", () => {
      const token = generateToken(99, "test@cpms.com", "admin");
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      expect(decoded.userId).toBe(99);
      expect(decoded.email).toBe("test@cpms.com");
      expect(decoded.role).toBe("admin");
    });
  });
});
