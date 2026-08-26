import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.js";
import { AuditLogService } from "../services/AuditLogService.js";

/**
 * Express Middleware for recording operational and administrative mutations in AuditLog
 */
export function auditLogMiddleware(actionName?: string, targetName?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Only audit mutating methods (POST, PUT, PATCH, DELETE)
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase());

    if (!isMutation) {
      return next();
    }

    res.on("finish", () => {
      // Record audit log only for successful mutations (2xx and 3xx)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const fallbackTarget = req.baseUrl
          ? req.baseUrl.split("/").filter(Boolean).pop()?.toUpperCase() || "RESOURCE"
          : "RESOURCE";

        const action = actionName || `${req.method.toUpperCase()}_${targetName || fallbackTarget}`;
        const target = targetName || fallbackTarget;

        const targetId =
          req.params.id ||
          req.params.chargerId ||
          req.params.stationId ||
          req.params.tariffId ||
          req.params.transactionId ||
          req.body?.id ||
          req.body?.chargerId ||
          req.body?.transactionId;

        const clientIp =
          (req.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          req.ip ||
          "127.0.0.1";

        AuditLogService.recordLog({
          userId: req.userId || null,
          action,
          target,
          targetId,
          payload: req.body,
          ip: clientIp,
          userAgent: req.headers?.["user-agent"] as string,
        }).catch(() => {});
      }
    });

    next();
  };
}
