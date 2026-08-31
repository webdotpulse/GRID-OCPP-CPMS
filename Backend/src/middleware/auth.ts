import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

/**
 * Middleware to verify JWT token
 */
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Response {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access token required",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: number;
      email: string;
      role: string;
    };

    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    logger.error(`JWT verification failed: ${error}`);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Response {
  if (req.userRole !== "admin" && req.userRole !== "superadmin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
    });
  }
  next();
}

/**
 * Middleware to check if user is superadmin
 */
export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Response {
  if (req.userRole !== "superadmin") {
    return res.status(403).json({
      success: false,
      error: "Superadmin access required",
    });
  }
  next();
}

/**
 * Middleware to check if user has one of the required roles
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    const role = req.userRole || "user";
    if (role === "superadmin" || allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: `Insufficient permissions. Required role(s): ${allowedRoles.join(", ")}`,
    });
  };
}

/**
 * Generate JWT token
 */
export function generateToken(userId: number, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    config.jwtSecret as jwt.Secret,
    { expiresIn: config.jwtExpiresIn as any }
  );
}

export type ResourceType = "station" | "charger" | "transaction" | "user" | "vehicle" | "company";

/**
 * Attribute-Based Access Control (ABAC) Middleware
 * Enforces multi-tenant organizational isolation and user ownership
 */
export function requireResourceAccess(resourceType: ResourceType) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      const role = req.userRole;
      const userId = req.userId;

      // 1. Superadmin has global unrestricted access
      if (role === "superadmin") {
        return next();
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Query authenticated user context
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "User not found",
        });
      }

      // Extract target resource ID from params, body, or query
      const rawId =
        req.params.id ||
        req.params[`${resourceType}Id`] ||
        req.params.stationId ||
        req.params.chargerId ||
        req.params.transactionId ||
        req.body?.id ||
        req.body?.[`${resourceType}Id`] ||
        req.body?.stationId ||
        req.body?.chargerId ||
        req.query?.id ||
        req.query?.[`${resourceType}Id`];

      // If no specific resource ID is targeted (e.g. list/create), proceed
      if (!rawId) {
        return next();
      }

      const resourceIdStr = String(rawId);
      const resourceIdNum = parseInt(resourceIdStr, 10);

      switch (resourceType) {
        case "station": {
          if (isNaN(resourceIdNum)) return next();
          const station = await prisma.chargingStation.findUnique({
            where: { id: resourceIdNum },
            include: { owner: true },
          });
          if (!station) {
            return res.status(404).json({ success: false, error: "Charging station not found" });
          }
          const isOwner = station.owner_id === userId;
          const isSameCompany =
            role === "admin" &&
            user.companyId &&
            station.owner?.companyId &&
            user.companyId === station.owner.companyId;

          if (!isOwner && !isSameCompany) {
            return res.status(403).json({
              success: false,
              error: "Access denied: station does not belong to your organization",
            });
          }
          break;
        }

        case "charger": {
          const charger = await prisma.charger.findFirst({
            where: isNaN(resourceIdNum) ? { name: resourceIdStr } : { charger_id: resourceIdNum },
            include: {
              owner: true,
              chargingStation: { include: { owner: true } },
            },
          });
          if (!charger) {
            return res.status(404).json({ success: false, error: "Charger not found" });
          }
          const isOwner = charger.owner_id === userId || charger.chargingStation?.owner_id === userId;
          const isSameCompany =
            role === "admin" &&
            user.companyId &&
            ((charger.owner?.companyId && user.companyId === charger.owner.companyId) ||
              (charger.chargingStation?.owner?.companyId &&
                user.companyId === charger.chargingStation.owner.companyId));

          if (!isOwner && !isSameCompany) {
            return res.status(403).json({
              success: false,
              error: "Access denied: charger does not belong to your organization",
            });
          }
          break;
        }

        case "transaction": {
          const tx = await prisma.transaction.findFirst({
            where: isNaN(resourceIdNum) ? { transactionId: resourceIdStr } : { id: resourceIdNum },
            include: {
              charger: { include: { chargingStation: { include: { owner: true } } } },
              rfidUser: true,
            },
          });
          if (!tx) {
            return res.status(404).json({ success: false, error: "Transaction not found" });
          }

          if (role === "admin") {
            const isOwner = tx.charger?.chargingStation?.owner_id === userId;
            const isSameCompany =
              user.companyId &&
              tx.charger?.chargingStation?.owner?.companyId &&
              user.companyId === tx.charger.chargingStation.owner.companyId;

            if (!isOwner && !isSameCompany) {
              return res.status(403).json({
                success: false,
                error: "Access denied: transaction not within your organization",
              });
            }
          } else {
            // Driver / End-user: can only view own transactions
            const isDriverOwner =
              tx.rfidUser?.owner_id === userId ||
              tx.idTag === user.email ||
              (tx.rfidUser && tx.rfidUser.rfid_user_id === user.id);

            if (!isDriverOwner) {
              return res.status(403).json({
                success: false,
                error: "Access denied: you can only view your own charging sessions",
              });
            }
          }
          break;
        }

        case "user": {
          if (isNaN(resourceIdNum)) return next();
          if (resourceIdNum === userId) {
            return next();
          }
          const targetUser = await prisma.user.findUnique({
            where: { id: resourceIdNum },
          });
          if (!targetUser) {
            return res.status(404).json({ success: false, error: "User not found" });
          }

          const isSameCompanyAdmin =
            role === "admin" &&
            user.companyId &&
            targetUser.companyId &&
            user.companyId === targetUser.companyId;

          if (!isSameCompanyAdmin) {
            return res.status(403).json({
              success: false,
              error: "Access denied: cannot access users outside your company",
            });
          }
          break;
        }

        case "vehicle": {
          if (isNaN(resourceIdNum)) return next();
          const vehicle = await prisma.vehicleEnergyProfile.findFirst({
            where: { id: resourceIdNum },
          });
          if (!vehicle) {
            return res.status(404).json({ success: false, error: "Vehicle profile not found" });
          }

          const isVehicleOwner = (vehicle as any).userId === userId || (vehicle as any).owner_id === userId;
          if (!isVehicleOwner && role !== "admin") {
            return res.status(403).json({
              success: false,
              error: "Access denied: not your vehicle energy profile",
            });
          }
          break;
        }

        case "company": {
          if (isNaN(resourceIdNum)) return next();
          if (role !== "admin" || user.companyId !== resourceIdNum) {
            return res.status(403).json({
              success: false,
              error: "Access denied: cannot access foreign company records",
            });
          }
          break;
        }
      }

      return next();
    } catch (err: any) {
      logger.error(`Error in requireResourceAccess (${resourceType}): ${err.message}`);
      return res.status(500).json({ success: false, error: "Authorization error" });
    }
  };
}

/**
 * Policy-Based Access Control (PBAC) / Fine-Grained RBAC Middleware
 * Validates whether the authenticated user possesses the specific capability/permission.
 */
export function requirePermission(permissionKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      const role = req.userRole || "user";
      const userId = req.userId;

      // 1. Superadmin has global unrestricted bypass
      if (role === "superadmin") {
        return next();
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // 2. Fetch user along with customRole
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { customRole: true },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "User not found",
        });
      }

      // 3. If user has a custom role, evaluate policy permissions array
      if (user.customRole) {
        const permissions = Array.isArray(user.customRole.permissions)
          ? (user.customRole.permissions as string[])
          : [];

        const hasPermission =
          permissions.includes("*") ||
          permissions.includes(permissionKey) ||
          permissions.some((p) => p.endsWith(".*") && permissionKey.startsWith(p.slice(0, -2)));

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: `Insufficient permissions. Custom role "${user.customRole.name}" lacks permission: ${permissionKey}`,
          });
        }

        // Check site-level restrictions if specified
        if (user.customRole.siteScopes && Array.isArray(user.customRole.siteScopes)) {
          const scopes = user.customRole.siteScopes as number[];
          if (scopes.length > 0) {
            const rawStationId = req.params.stationId || req.body?.stationId || req.query?.stationId;
            if (rawStationId) {
              const stationIdNum = parseInt(String(rawStationId), 10);
              if (!isNaN(stationIdNum) && !scopes.includes(stationIdNum)) {
                return res.status(403).json({
                  success: false,
                  error: `Access denied: Role is restricted to specific sites (${scopes.join(", ")})`,
                });
              }
            }
          }
        }

        return next();
      }

      // 4. Default fallback: evaluate against SYSTEM_CAPABILITIES for default roles
      const { SYSTEM_CAPABILITIES } = await import("../api/roles/roles.controller.js");
      const capability = SYSTEM_CAPABILITIES.find((c) => c.key === permissionKey);

      if (capability && capability.allowedRoles.includes(role)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Role "${role}" lacks required permission: ${permissionKey}`,
      });
    } catch (error: any) {
      logger.error(`Error in requirePermission (${permissionKey}): ${error.message}`);
      return res.status(500).json({ success: false, error: "Authorization verification failed" });
    }
  };
}

