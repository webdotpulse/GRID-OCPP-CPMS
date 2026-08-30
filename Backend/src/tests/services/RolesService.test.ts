import { jest } from "@jest/globals";
import { SYSTEM_CAPABILITIES, SYSTEM_ROLES } from "../../api/roles/roles.controller.js";

describe("PBAC & Role Management Core Definitions", () => {
  describe("SYSTEM_CAPABILITIES catalog", () => {
    it("should define capabilities across all major system domains", () => {
      expect(Array.isArray(SYSTEM_CAPABILITIES)).toBe(true);
      expect(SYSTEM_CAPABILITIES.length).toBeGreaterThanOrEqual(15);

      const keys = SYSTEM_CAPABILITIES.map((c) => c.key);
      expect(keys).toContain("chargers.view");
      expect(keys).toContain("chargers.control");
      expect(keys).toContain("chargers.edit");
      expect(keys).toContain("tariffs.manage");
      expect(keys).toContain("v2g.manage");
      expect(keys).toContain("invoices.manage");
      expect(keys).toContain("sepa.export");
      expect(keys).toContain("webhooks.manage");
      expect(keys).toContain("roles.manage");
      expect(keys).toContain("audit.view");
    });

    it("should ensure every capability has valid allowedRoles and category", () => {
      for (const cap of SYSTEM_CAPABILITIES) {
        expect(cap.key).toBeTruthy();
        expect(cap.name).toBeTruthy();
        expect(cap.category).toBeTruthy();
        expect(Array.isArray(cap.allowedRoles)).toBe(true);
        expect(cap.allowedRoles.length).toBeGreaterThan(0);
      }
    });
  });

  describe("SYSTEM_ROLES catalog", () => {
    it("should define standard system roles with level hierarchy", () => {
      const roleKeys = SYSTEM_ROLES.map((r) => r.role);
      expect(roleKeys).toContain("superadmin");
      expect(roleKeys).toContain("admin");
      expect(roleKeys).toContain("operator");
      expect(roleKeys).toContain("client_admin");
      expect(roleKeys).toContain("user");

      const superadmin = SYSTEM_ROLES.find((r) => r.role === "superadmin");
      const user = SYSTEM_ROLES.find((r) => r.role === "user");
      expect(superadmin?.level).toBeGreaterThan(user?.level || 0);
    });
  });
});
