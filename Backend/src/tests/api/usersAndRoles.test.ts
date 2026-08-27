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

      await rolesController.getRoles(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            roles: expect.arrayContaining([
              expect.objectContaining({ role: "superadmin", userCount: 1 }),
              expect.objectContaining({ role: "admin", userCount: 3 }),
              expect.objectContaining({ role: "operator", userCount: 2 }),
              expect.objectContaining({ role: "client_admin", userCount: 5 }),
              expect.objectContaining({ role: "user", userCount: 25 }),
            ]),
            capabilities: expect.any(Array),
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
          name: "Amsterdam Fleet BV",
          clientNumber: "CLI-1001",
          status: "active",
          contactName: "Jan de Vries",
          contactEmail: "jan@fleet.nl",
          _count: { users: 10, chargingStations: 2, invoices: 5 },
          users: [{ id: 101, name: "Driver 1", email: "d1@fleet.nl", role: "user" }],
          chargingStations: [
            {
              id: 1,
              station_name: "Depot West",
              status: "active",
              chargers: [
                { charger_id: 1, name: "CH-01", status: "Available" },
                { charger_id: 2, name: "CH-02", status: "Charging" },
              ],
            },
          ],
        },
      ] as any);
      jest.spyOn(prisma.company, "count").mockResolvedValue(1 as any);

      await companiesController.getAllCompanies(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: "Amsterdam Fleet BV",
              clientNumber: "CLI-1001",
              usersCount: 10,
              stationsCount: 2,
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
        contactName: "Pieter Bakker",
        contactEmail: "pieter@portlogistics.nl",
        taxNumber: "NL888888888B01",
      };

      jest.spyOn(prisma.company, "findUnique").mockResolvedValue(null as any);
      jest.spyOn(prisma.company, "create").mockResolvedValue({
        id: 2,
        name: "Rotterdam Port Logistics",
        clientNumber: "CLI-2001",
        status: "active",
        taxNumber: "NL888888888B01",
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

  describe("Users Controller (Multi-role & Password Reset)", () => {
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
  });
});
