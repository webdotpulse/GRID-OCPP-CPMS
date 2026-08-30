import { Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { AuthRequest } from "../../middleware/auth.js";
import { AuditLogService } from "../../services/AuditLogService.js";

export interface RoleCapability {
  key: string;
  name: string;
  category:
    | "Infrastructure"
    | "Energy & Smart Grid"
    | "Fleet & Access"
    | "Invoices & Finance"
    | "Operations & Logs"
    | "Administration & Integrations";
  description: string;
  allowedRoles: string[];
}

export const SYSTEM_CAPABILITIES: RoleCapability[] = [
  // Infrastructure
  {
    key: "chargers.view",
    name: "View Chargers & Status",
    category: "Infrastructure",
    description: "Browse connected chargers, EVSE connector states, and real-time telemetry",
    allowedRoles: ["superadmin", "admin", "operator", "client_admin", "user"],
  },
  {
    key: "chargers.control",
    name: "Remote Charger Commands",
    category: "Infrastructure",
    description: "Execute Remote Start/Stop, Reset (Soft/Hard), Unlock Connector, and Change Availability",
    allowedRoles: ["superadmin", "admin", "operator", "client_admin"],
  },
  {
    key: "chargers.edit",
    name: "Configure Hardware & Profiles",
    category: "Infrastructure",
    description: "Create or modify charger parameters, OCPP configuration keys, and quirk overrides",
    allowedRoles: ["superadmin", "admin", "operator"],
  },
  {
    key: "stations.manage",
    name: "Manage Site Locations & Ground Plans",
    category: "Infrastructure",
    description: "Create charging stations, configure max site power limits, and design 2D ground plans",
    allowedRoles: ["superadmin", "admin", "operator"],
  },
  {
    key: "chargegroups.manage",
    name: "Dynamic Load Balancing Groups",
    category: "Infrastructure",
    description: "Define dynamic phase-balancing clusters, current allocations, and fail-safe power limits",
    allowedRoles: ["superadmin", "admin", "operator"],
  },

  // Energy & Smart Grid
  {
    key: "v2g.manage",
    name: "V2G & Grid Discharge Orchestration",
    category: "Energy & Smart Grid",
    description: "Configure dynamic vehicle-to-grid limits, peak shaving schedules, and minimum SoC reserves",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "tariffs.manage",
    name: "Tariff Schemes & EPEX Spot Rates",
    category: "Energy & Smart Grid",
    description: "Set fixed energy/connection/idle fees and configure dynamic day-ahead pricing multipliers",
    allowedRoles: ["superadmin", "admin"],
  },

  // Fleet & Access
  {
    key: "rfid.manage_all",
    name: "Manage Global RFID Whitelist",
    category: "Fleet & Access",
    description: "Create, assign, block, and manage RFID cards across the entire network",
    allowedRoles: ["superadmin", "admin", "client_admin"],
  },
  {
    key: "vehicle_identity.manage",
    name: "ISO 15118 Plug & Charge Contracts",
    category: "Fleet & Access",
    description: "Inspect and manage vehicle contract certificates and battery energy profiles",
    allowedRoles: ["superadmin", "admin", "client_admin", "user"],
  },
  {
    key: "reservations.manage",
    name: "Manage EVSE Reservations",
    category: "Fleet & Access",
    description: "Create, inspect, and cancel reserved charging connectors",
    allowedRoles: ["superadmin", "admin", "client_admin", "user"],
  },

  // Invoices & Finance
  {
    key: "invoices.manage",
    name: "Invoicing & Billing Engine",
    category: "Invoices & Finance",
    description: "Generate monthly PDF invoices, calculate VAT rates, and manage payment statuses",
    allowedRoles: ["superadmin", "admin", "client_admin"],
  },
  {
    key: "sepa.export",
    name: "SEPA ISO 20022 Direct Debit XML",
    category: "Invoices & Finance",
    description: "Generate and download banking XML batch transfer files (pain.008 / pain.001)",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "reimbursements.manage",
    name: "Home Reimbursement Split-Billing",
    category: "Invoices & Finance",
    description: "Calculate employee home charging compensation and employer reimbursement ledgers",
    allowedRoles: ["superadmin", "admin", "client_admin"],
  },

  // Operations & Logs
  {
    key: "ocpp.logs",
    name: "OCPP Raw Live Message Stream",
    category: "Operations & Logs",
    description: "Inspect low-level WebSocket frames (Call, CallResult, CallError) and diagnostics",
    allowedRoles: ["superadmin", "admin", "operator"],
  },
  {
    key: "maintenance.autoheal",
    name: "Hardware Reliability & Auto-Heal",
    category: "Operations & Logs",
    description: "Inspect hardware risk flags, fault counters, and automated reboot workflows",
    allowedRoles: ["superadmin", "admin", "operator"],
  },
  {
    key: "firmware.update",
    name: "Over-The-Air Firmware Upgrades",
    category: "Operations & Logs",
    description: "Push signed firmware update packages to physical charge points",
    allowedRoles: ["superadmin", "admin", "operator"],
  },
  {
    key: "roaming.manage",
    name: "Roaming Hubs (OCPI & OICP)",
    category: "Operations & Logs",
    description: "Manage eMSP/CPO roaming tokens, Hubject OICP credentials, and CDR sync",
    allowedRoles: ["superadmin", "admin"],
  },

  // Administration & Integrations
  {
    key: "users.manage",
    name: "User Account Administration",
    category: "Administration & Integrations",
    description: "Create, update, deactivate, reset passwords, and manage individual user accounts",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "clients.manage",
    name: "Client & Corporate Organization Management",
    category: "Administration & Integrations",
    description: "Create and administer B2B corporate client accounts, billing entities, and assigned fleets",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "roles.manage",
    name: "Custom Roles & PBAC Policy Management",
    category: "Administration & Integrations",
    description: "Create, edit, and configure custom role policies and site-scoped access permissions",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "audit.view",
    name: "Enterprise Audit Trail Explorer",
    category: "Administration & Integrations",
    description: "Inspect tamper-evident immutable security logs for all platform state mutations",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "webhooks.manage",
    name: "Outbound Webhook Subscriptions",
    category: "Administration & Integrations",
    description: "Configure outbound event streams, HMAC secrets, test pings, and delivery retry traces",
    allowedRoles: ["superadmin", "admin"],
  },
];

export const SYSTEM_ROLES = [
  {
    role: "superadmin",
    name: "Super Administrator",
    badgeColor: "#8b5cf6", // Purple
    level: 100,
    scope: "Global Platform",
    description:
      "Full unrestricted access across all client organizations, hardware endpoints, roaming partners, audit logs, and system settings.",
    isSystem: true,
  },
  {
    role: "admin",
    name: "Platform / CPO Administrator",
    badgeColor: "#e2626b", // Coral / Red
    level: 80,
    scope: "Organization / CPO",
    description:
      "Manages charging networks, site locations, dynamic tariffs, billing & SEPA, client accounts, and user permissions.",
    isSystem: true,
  },
  {
    role: "operator",
    name: "Operations & Field Technician",
    badgeColor: "#3f78e0", // Blue
    level: 60,
    scope: "Hardware & Network",
    description:
      "Responsible for charger reliability, live monitoring, diagnostics, firmware deployment, and remote controls. Restricted from billing and financial accounts.",
    isSystem: true,
  },
  {
    role: "client_admin",
    name: "Corporate Client / Fleet Manager",
    badgeColor: "#45c4a0", // Emerald
    level: 40,
    scope: "Corporate Client / Tenant",
    description:
      "Administers corporate fleet drivers, employee RFID cards, assigned stations/chargers, and monthly company invoices.",
    isSystem: true,
  },
  {
    role: "user",
    name: "EV Driver / Standard User",
    badgeColor: "#54a8c7", // Cyan
    level: 20,
    scope: "Self / Personal",
    description:
      "End-user charging access. Can view personal charging sessions, manage own RFID tags, vehicle battery profiles, and receipts.",
    isSystem: true,
  },
];

/**
 * GET /api/roles - Get system roles and custom roles with capability matrix
 */
export const getRoles = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.userRole || "user";
    const userId = req.userId;

    // Count active users per system role
    const userRoleCounts = await prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null, customRoleId: null },
      _count: { id: true },
    });

    const systemCountsMap: Record<string, number> = {};
    for (const item of userRoleCounts) {
      systemCountsMap[item.role] = item._count.id;
    }

    const enrichedSystemRoles = SYSTEM_ROLES.map((r) => ({
      ...r,
      userCount: systemCountsMap[r.role] || 0,
      capabilities: SYSTEM_CAPABILITIES.filter((c) => c.allowedRoles.includes(r.role)).map(
        (c) => c.key
      ),
    }));

    // Fetch custom roles
    const customRoles = await prisma.customRole.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        company: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedCustomRoles = customRoles.map((cr) => ({
      id: cr.id,
      role: cr.slug,
      name: cr.name,
      slug: cr.slug,
      description: cr.description || "",
      badgeColor: cr.color || "#3f78e0",
      level: 50,
      scope: cr.company ? `Company: ${cr.company.name}` : "Custom Policy",
      isSystem: false,
      isCustom: true,
      companyId: cr.companyId,
      companyName: cr.company?.name || null,
      userCount: cr._count.users,
      permissions: Array.isArray(cr.permissions) ? cr.permissions : [],
      siteScopes: Array.isArray(cr.siteScopes) ? cr.siteScopes : [],
      capabilities: Array.isArray(cr.permissions) ? cr.permissions : [],
      createdAt: cr.createdAt,
      updatedAt: cr.updatedAt,
    }));

    return res.json({
      success: true,
      data: {
        systemRoles: enrichedSystemRoles,
        customRoles: enrichedCustomRoles,
        roles: [...enrichedSystemRoles, ...enrichedCustomRoles],
        capabilities: SYSTEM_CAPABILITIES,
      },
    });
  } catch (error: any) {
    logger.error(`Error getting roles: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to get roles" });
  }
};

/**
 * GET /api/roles/capabilities - Get all capabilities catalog
 */
export const getCapabilities = async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    data: SYSTEM_CAPABILITIES,
  });
};

/**
 * POST /api/roles - Create a new Custom Role with PBAC permissions
 */
export const createCustomRole = async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, description, color, permissions, siteScopes, companyId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Role name is required" });
    }

    const generatedSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check slug collision
    const existingSystemRole = SYSTEM_ROLES.find((r) => r.role === generatedSlug);
    if (existingSystemRole) {
      return res.status(400).json({ success: false, error: `Slug "${generatedSlug}" conflicts with a reserved system role` });
    }

    const existingCustomRole = await prisma.customRole.findUnique({
      where: { slug: generatedSlug },
    });

    if (existingCustomRole) {
      return res.status(400).json({ success: false, error: `A custom role with slug "${generatedSlug}" already exists` });
    }

    const rolePermissions = Array.isArray(permissions) ? permissions : [];
    const validScopes = Array.isArray(siteScopes) ? siteScopes : [];

    const newRole = await prisma.customRole.create({
      data: {
        name: name.trim(),
        slug: generatedSlug,
        description: description?.trim() || null,
        color: color || "#3f78e0",
        permissions: rolePermissions,
        siteScopes: validScopes.length > 0 ? validScopes : undefined,
        companyId: companyId ? parseInt(String(companyId), 10) : null,
      },
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "CUSTOM_ROLE_CREATE",
      target: "CustomRole",
      targetId: newRole.id,
      payload: { name: newRole.name, slug: newRole.slug, permissions: rolePermissions },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.status(201).json({
      success: true,
      data: newRole,
      message: `Custom role "${newRole.name}" created successfully`,
    });
  } catch (error: any) {
    logger.error(`Error creating custom role: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to create custom role" });
  }
};

/**
 * PUT /api/roles/:id - Update an existing Custom Role
 */
export const updateCustomRole = async (req: AuthRequest, res: Response) => {
  try {
    const roleId = parseInt(String(req.params.id), 10);
    if (isNaN(roleId)) {
      return res.status(400).json({ success: false, error: "Invalid role ID" });
    }

    const existingRole = await prisma.customRole.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return res.status(404).json({ success: false, error: "Custom role not found" });
    }

    const { name, description, color, permissions, siteScopes, companyId } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (color) updateData.color = color;
    if (Array.isArray(permissions)) updateData.permissions = permissions;
    if (Array.isArray(siteScopes)) updateData.siteScopes = siteScopes;
    if (companyId !== undefined) updateData.companyId = companyId ? parseInt(String(companyId), 10) : null;

    const updatedRole = await prisma.customRole.update({
      where: { id: roleId },
      data: updateData,
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "CUSTOM_ROLE_UPDATE",
      target: "CustomRole",
      targetId: roleId,
      payload: updateData,
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      data: updatedRole,
      message: `Custom role "${updatedRole.name}" updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Error updating custom role: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to update custom role" });
  }
};

/**
 * DELETE /api/roles/:id - Delete a Custom Role
 */
export const deleteCustomRole = async (req: AuthRequest, res: Response) => {
  try {
    const roleId = parseInt(String(req.params.id), 10);
    if (isNaN(roleId)) {
      return res.status(400).json({ success: false, error: "Invalid role ID" });
    }

    const existingRole = await prisma.customRole.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });

    if (!existingRole) {
      return res.status(404).json({ success: false, error: "Custom role not found" });
    }

    if (existingRole._count.users > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete role "${existingRole.name}" because it is currently assigned to ${existingRole._count.users} user(s). Reassign them first.`,
      });
    }

    await prisma.customRole.delete({
      where: { id: roleId },
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "CUSTOM_ROLE_DELETE",
      target: "CustomRole",
      targetId: roleId,
      payload: { name: existingRole.name, slug: existingRole.slug },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      message: `Custom role "${existingRole.name}" deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Error deleting custom role: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to delete custom role" });
  }
};

/**
 * POST /api/roles/assign - Assign system or custom role to a user
 */
export const assignUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role, customRoleId } = req.body;

    const targetUserId = parseInt(String(userId), 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, error: "Valid userId is required" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    let updateData: any = {};

    if (customRoleId) {
      const customRoleIdNum = parseInt(String(customRoleId), 10);
      const customRole = await prisma.customRole.findUnique({
        where: { id: customRoleIdNum },
      });

      if (!customRole) {
        return res.status(404).json({ success: false, error: "Custom role not found" });
      }

      updateData = {
        role: customRole.slug,
        customRoleId: customRole.id,
      };
    } else if (role) {
      const validSystemRole = SYSTEM_ROLES.find((r) => r.role === role);
      if (!validSystemRole) {
        return res.status(400).json({ success: false, error: `Invalid system role: "${role}"` });
      }

      updateData = {
        role: validSystemRole.role,
        customRoleId: null,
      };
    } else {
      return res.status(400).json({ success: false, error: "Either role or customRoleId must be provided" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        customRoleId: true,
        customRole: true,
      },
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "USER_ROLE_ASSIGN",
      target: "User",
      targetId: targetUserId,
      payload: { previousRole: targetUser.role, updatedData: updateData },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      data: updatedUser,
      message: `Role assigned successfully to user ${updatedUser.email}`,
    });
  } catch (error: any) {
    logger.error(`Error assigning user role: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to assign role" });
  }
};
