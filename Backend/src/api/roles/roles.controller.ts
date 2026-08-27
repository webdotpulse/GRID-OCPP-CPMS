import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { AuthRequest } from "../../middleware/auth.js";

export interface RoleCapability {
  key: string;
  name: string;
  category: "Infrastructure" | "Energy & Smart Grid" | "Fleet & Access" | "Invoices & Finance" | "Operations & Logs" | "Administration";
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

  // Administration
  {
    key: "users.manage",
    name: "User Account Administration",
    category: "Administration",
    description: "Create, update, deactivate, reset passwords, and manage individual user accounts",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "clients.manage",
    name: "Client & Corporate Organization Management",
    category: "Administration",
    description: "Create and administer B2B corporate client accounts, billing entities, and assigned fleets",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "roles.assign",
    name: "Role & Permission Assignment",
    category: "Administration",
    description: "Assign and modify system access roles and organizational scoping",
    allowedRoles: ["superadmin", "admin"],
  },
  {
    key: "audit.view",
    name: "Enterprise Audit Trail",
    category: "Administration",
    description: "Inspect tamper-evident immutable security logs for all platform state mutations",
    allowedRoles: ["superadmin"],
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
    isSystem: false,
  },
  {
    role: "client_admin",
    name: "Corporate Client / Fleet Manager",
    badgeColor: "#45c4a0", // Emerald
    level: 40,
    scope: "Corporate Client / Tenant",
    description:
      "Administers corporate fleet drivers, employee RFID cards, assigned stations/chargers, and monthly company invoices.",
    isSystem: false,
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
 * GET /api/roles - Get system roles and capabilities matrix
 */
export const getRoles = async (req: AuthRequest, res: Response) => {
  try {
    // Count active users per role
    const userRoleCounts = await prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { id: true },
    });

    const countsMap: Record<string, number> = {};
    for (const item of userRoleCounts) {
      countsMap[item.role] = item._count.id;
    }

    const enrichedRoles = SYSTEM_ROLES.map((r) => ({
      ...r,
      userCount: countsMap[r.role] || 0,
      capabilities: SYSTEM_CAPABILITIES.filter((c) => c.allowedRoles.includes(r.role)).map(
        (c) => c.key
      ),
    }));

    res.json({
      success: true,
      data: {
        roles: enrichedRoles,
        capabilities: SYSTEM_CAPABILITIES,
      },
    });
  } catch (error: any) {
    logger.error(`Error getting roles: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to get roles" });
  }
};
