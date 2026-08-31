import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface RecordLogParams {
  userId?: number | null;
  action: string;
  target: string;
  targetId?: string | number | null;
  payload?: any;
  ip?: string;
  userAgent?: string;
}

export interface GetLogsFilter {
  userId?: number;
  target?: string;
  targetId?: string;
  action?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  /**
   * Record an immutable audit log entry
   */
  public static logAction(params: RecordLogParams): Promise<any> {
    return this.recordLog(params);
  }

  public static async recordLog(params: RecordLogParams): Promise<any> {
    try {
      const { userId, action, target, targetId, payload, ip, userAgent } = params;

      // Clean payload (omit sensitive credentials like passwords, tokens, private keys)
      const sanitizedPayload = this.sanitizePayload(payload);

      const logEntry = await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          target,
          targetId: targetId !== undefined && targetId !== null ? String(targetId) : null,
          payload: sanitizedPayload !== undefined ? sanitizedPayload : undefined,
          ip: ip || "127.0.0.1",
          userAgent: userAgent || null,
        },
      });

      logger.debug(`[AuditLog] Recorded action ${action} on ${target}:${targetId || "global"} (User: ${userId || "system"})`);
      return logEntry;
    } catch (error: any) {
      logger.error(`Failed to record audit log: ${error.message}`);
      return null;
    }
  }

  /**
   * Query audit logs with filtering and pagination
   */
  public static async getLogs(filter: GetLogsFilter = {}): Promise<{ total: number; logs: any[] }> {
    try {
      const where: any = {};

      if (filter.userId) {
        where.userId = filter.userId;
      }
      if (filter.target) {
        where.target = filter.target;
      }
      if (filter.targetId) {
        where.targetId = filter.targetId;
      }
      if (filter.action) {
        where.action = filter.action;
      }
      if (filter.search) {
        where.OR = [
          { action: { contains: filter.search, mode: "insensitive" } },
          { target: { contains: filter.search, mode: "insensitive" } },
          { targetId: { contains: filter.search, mode: "insensitive" } },
          { ip: { contains: filter.search, mode: "insensitive" } },
          { user: { email: { contains: filter.search, mode: "insensitive" } } },
          { user: { name: { contains: filter.search, mode: "insensitive" } } },
        ];
      }
      if (filter.dateFrom || filter.dateTo) {
        where.createdAt = {};
        if (filter.dateFrom) where.createdAt.gte = filter.dateFrom;
        if (filter.dateTo) where.createdAt.lte = filter.dateTo;
      }

      const skip = filter.offset || 0;
      const take = filter.limit || 50;

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
      ]);

      return { total, logs };
    } catch (error: any) {
      logger.error(`Failed to retrieve audit logs: ${error.message}`);
      return { total: 0, logs: [] };
    }
  }

  /**
   * Clear all or filtered audit logs (Admin/Superadmin only)
   */
  public static async clearLogs(filter: { dateBefore?: Date; target?: string } = {}): Promise<{ deletedCount: number }> {
    try {
      const where: any = {};
      if (filter.dateBefore) {
        where.createdAt = { lte: filter.dateBefore };
      }
      if (filter.target && filter.target !== "all") {
        where.target = filter.target;
      }

      const result = await prisma.auditLog.deleteMany({ where });
      logger.info(`[AuditLog] Cleared ${result.count} audit log entries`);
      return { deletedCount: result.count };
    } catch (error: any) {
      logger.error(`Failed to clear audit logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sanitizes payload object to remove secret credentials
   */
  private static sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== "object") {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizePayload(item));
    }

    const sanitized: any = {};
    const sensitiveKeys = ["password", "token", "secret", "privatekey", "apikey", "pin", "cvv", "authpassword"];

    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
