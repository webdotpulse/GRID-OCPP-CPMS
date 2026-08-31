import { jest } from "@jest/globals";
import { prisma } from "../../config/database.js";
import { createUser, updateUser, updateUserRole } from "../../api/users/users.controller.js";
import { isSafeExternalUrl } from "../../api/oicp/oicp.controller.js";
import { sanitizeCsvField } from "../../utils/validation.js";

describe("Multi-Tenant Boundary & Privilege Escalation Hardening", () => {
  describe("User Privilege Escalation Protection", () => {
    it("should prevent non-superadmin from creating a superadmin account", async () => {
      const mockReq: any = {
        userRole: "admin",
        userId: 2,
        body: {
          name: "Attacker",
          email: "attacker@test.com",
          password: "password123",
          role: "superadmin",
        },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Superadmin access required to create superadmin accounts" })
      );
    });

    it("should prevent non-superadmin from creating an admin account", async () => {
      const mockReq: any = {
        userRole: "client_admin",
        userId: 5,
        body: {
          name: "Attacker",
          email: "attacker2@test.com",
          password: "password123",
          role: "admin",
        },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Superadmin access required to create admin accounts" })
      );
    });

    it("should prevent non-superadmin from promoting any user to superadmin", async () => {
      const mockFindUnique = jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: 10,
        role: "user",
        companyId: 1,
      } as any);

      const mockReq: any = {
        userRole: "admin",
        userId: 2,
        params: { id: "10" },
        body: { role: "superadmin" },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateUserRole(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Superadmin access required") })
      );

      mockFindUnique.mockRestore();
    });

    it("should prevent company admin from modifying a user from another company", async () => {
      const mockFindUnique = (jest.spyOn(prisma.user, "findUnique") as any).mockImplementation((args: any) => {
        if (args.where.id === 2) {
          // Current admin in Company 1
          return Promise.resolve({ id: 2, role: "admin", companyId: 1 } as any);
        }
        if (args.where.id === 50) {
          // Target user in Company 2
          return Promise.resolve({ id: 50, role: "user", companyId: 2 } as any);
        }
        return Promise.resolve(null);
      });

      const mockReq: any = {
        userRole: "admin",
        userId: 2,
        params: { id: "50" },
        body: { name: "Hijacked Name" },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("not within your organization") })
      );

      mockFindUnique.mockRestore();
    });
  });

  describe("Outbound Webhook SSRF Protections", () => {
    it("should block cloud metadata IP addresses in targetUrl", () => {
      expect(isSafeExternalUrl("http://169.254.169.254/latest/meta-data").valid).toBe(false);
      expect(isSafeExternalUrl("http://metadata.google.internal/").valid).toBe(false);
    });

    it("should block loopback and localhost target URLs", () => {
      expect(isSafeExternalUrl("http://127.0.0.1:3000/hook").valid).toBe(false);
      expect(isSafeExternalUrl("http://localhost:8080/webhook").valid).toBe(false);
    });

    it("should block private subnets (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12)", () => {
      expect(isSafeExternalUrl("http://192.168.1.1/hook").valid).toBe(false);
      expect(isSafeExternalUrl("http://10.0.1.50:9000/").valid).toBe(false);
      expect(isSafeExternalUrl("http://172.20.0.1/").valid).toBe(false);
    });

    it("should allow verified public webhook delivery endpoints", () => {
      expect(isSafeExternalUrl("https://hooks.slack.com/services/T00/B00/X00").valid).toBe(true);
      expect(isSafeExternalUrl("https://api.mycorp.com/events/cpms").valid).toBe(true);
    });
  });

  describe("CSV Formula Injection Prevention", () => {
    it("should escape leading formula trigger characters", () => {
      expect(sanitizeCsvField("=1+1")).toBe("'=1+1");
      expect(sanitizeCsvField("+44123456")).toBe("'+44123456");
      expect(sanitizeCsvField("-100")).toBe("'-100");
      expect(sanitizeCsvField("@SUM(B1:B10)")).toBe("'@SUM(B1:B10)");
    });
  });
});
