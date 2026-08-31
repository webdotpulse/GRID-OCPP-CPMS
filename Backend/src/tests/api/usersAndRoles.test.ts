import { jest } from "@jest/globals";
import { prisma } from "../../config/database.js";
import * as rolesController from "../../api/roles/roles.controller.js";
import * as companiesController from "../../api/companies/companies.controller.js";
import * as usersController from "../../api/users/users.controller.js";

describe("User Roles, Client Management & Permissions API", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      userRole: "admin",
      userId: 1,
      params: {},
      query: {},
      body: {},
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe("Roles Controller (getRoles)", () => {
    it("should return the catalog of 5 system roles and capability matrix", async () => {
      jest.spyOn(prisma.user, "groupBy").mockResolvedValue([
        { role: "superadmin", _count: { id: 1 } },
        { role: "admin", _count: { id: 3 } },
        { role: "operator", _count: { id: 2 } },
        { role: "client_admin", _count: { id: 5 } },
        { role: "user", _count: { id: 25 } },
      ] as any);
      (prisma as any).customRole = { findMany: jest.fn<any>().mockResolvedValue([]) };

      await rolesController.getRoles(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            capabilities: expect.any(Array),
            roles: expect.arrayContaining([
              expect.objectContaining({ role: "superadmin", userCount: 1 }),
              expect.objectContaining({ role: "admin", userCount: 3 }),
              expect.objectContaining({ role: "operator", userCount: 2 }),
              expect.objectContaining({ role: "client_admin", userCount: 5 }),
              expect.objectContaining({ role: "user", userCount: 25 }),
            ]),
          }),
        })
      );
    });
  });

  describe("Companies / Clients Controller", () => {
    it("should list companies with enriched counts and metrics", async () => {
      jest.spyOn(prisma.company, "findMany").mockResolvedValue([
        {
          id: 1,
          name: "MobilityPulse BV",
          clientNumber: "CLI-1001",
          status: "active",
          _count: { users: 8, chargingStations: 4, invoices: 12 },
          chargingStations: [{ chargers: [{ status: "Available" }, { status: "Charging" }] }],
          users: [{ id: 1, name: "Admin", email: "admin@mobilitypulse.com", role: "admin" }],
        },
      ] as any);
      jest.spyOn(prisma.company, "count").mockResolvedValue(1);

      await companiesController.getAllCompanies(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: "MobilityPulse BV",
              usersCount: 8,
              chargersCount: 2,
              activeChargersCount: 2,
            }),
          ]),
        })
      );
    });

    it("should create a new client account with generated client number", async () => {
      mockReq.body = {
        name: "Rotterdam Port Logistics",
        contactEmail: "port@rotterdam-logistics.nl",
      };

      jest.spyOn(prisma.company, "findUnique").mockResolvedValue(null);
      jest.spyOn(prisma.company, "create").mockResolvedValue({
        id: 2,
        name: "Rotterdam Port Logistics",
        clientNumber: "CLI-9999",
        status: "active",
      } as any);

      await companiesController.createCompany(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 2,
            name: "Rotterdam Port Logistics",
          }),
        })
      );
    });
  });

  describe("Users Controller (Multi-role, Password Reset & Deletion Re-registration)", () => {
    it("should update user role to operator or client_admin", async () => {
      mockReq.params = { id: "10" };
      mockReq.body = { role: "operator" };

      jest.spyOn(prisma.user, "update").mockResolvedValue({
        id: 10,
        name: "Tech Ops",
        email: "ops@mobilitypulse.com",
        role: "operator",
        userType: "private",
        companyName: null,
      } as any);

      await usersController.updateUserRole(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 10,
            role: "operator",
          }),
        })
      );
    });

    it("should allow admin to reset a user's password", async () => {
      mockReq.params = { id: "15" };
      mockReq.body = { newPassword: "secureNewPassword123" };

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: 15,
        email: "driver@fleet.com",
      } as any);
      jest.spyOn(prisma.user, "update").mockResolvedValue({
        id: 15,
      } as any);

      await usersController.resetUserPassword(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Password has been successfully updated",
      });
    });

    it("should soft-delete user and anonymize email to free unique constraint", async () => {
      mockReq.params = { id: "20" };
      mockReq.userRole = "admin";
      mockReq.userId = 1;

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: 20,
        email: "leaving@company.com",
        role: "user",
      } as any);

      const updateSpy = jest.spyOn(prisma.user, "update").mockResolvedValue({
        id: 20,
      } as any);

      await usersController.deleteUser(mockReq, mockRes);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 20 },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            email: expect.stringMatching(/^deleted_20_\d+_leaving@company\.com$/),
          }),
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: "Soft deleted" })
      );
    });

    it("should allow creating a user with an email previously belonging to a soft-deleted account", async () => {
      mockReq.body = {
        name: "New John",
        email: "reused@company.com",
        password: "newPassword123",
        role: "user",
      };

      jest.spyOn(prisma.user, "findFirst")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 55,
          email: "reused@company.com",
          deletedAt: new Date(),
        } as any);

      const updateSpy = jest.spyOn(prisma.user, "update").mockResolvedValue({ id: 55 } as any);
      const createSpy = jest.spyOn(prisma.user, "create").mockResolvedValue({
        id: 56,
        name: "New John",
        email: "reused@company.com",
        role: "user",
      } as any);

      await usersController.createUser(mockReq, mockRes);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 55 },
          data: expect.objectContaining({
            email: expect.stringMatching(/^deleted_55_\d+_reused@company\.com$/),
          }),
        })
      );
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "reused@company.com",
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });
});
