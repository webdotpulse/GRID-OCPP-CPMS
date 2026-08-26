import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/audit (List audit logs with filtering)
 */
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, target, action, dateFrom, dateTo, limit, offset } = req.query;

    const filter: any = {};
    if (userId) filter.userId = parseInt(userId as string, 10);
    if (target) filter.target = String(target);
    if (action) filter.action = String(action);
    if (dateFrom) filter.dateFrom = new Date(dateFrom as string);
    if (dateTo) filter.dateTo = new Date(dateTo as string);
    if (limit) filter.limit = parseInt(limit as string, 10);
    if (offset) filter.offset = parseInt(offset as string, 10);

    const result = await AuditLogService.getLogs(filter);

    return res.json({
      success: true,
      data: result.logs,
      total: result.total,
      limit: filter.limit || 50,
      offset: filter.offset || 0,
    });
  } catch (error: any) {
    logger.error(`Error in getAuditLogs: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to retrieve audit logs" });
  }
};
