import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/audit (List audit logs with filtering)
 */
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, target, action, search, dateFrom, dateTo, limit, offset } = req.query;

    const filter: any = {};
    if (userId) filter.userId = parseInt(userId as string, 10);
    if (target) filter.target = String(target);
    if (action) filter.action = String(action);
    if (search) filter.search = String(search);
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

/**
 * GET /api/audit/export (Export audit logs as CSV)
 */
export const exportAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, target, action, search, dateFrom, dateTo } = req.query;

    const filter: any = { limit: 5000 };
    if (userId) filter.userId = parseInt(userId as string, 10);
    if (target) filter.target = String(target);
    if (action) filter.action = String(action);
    if (search) filter.search = String(search);
    if (dateFrom) filter.dateFrom = new Date(dateFrom as string);
    if (dateTo) filter.dateTo = new Date(dateTo as string);

    const result = await AuditLogService.getLogs(filter);

    const headers = "ID,Timestamp,User ID,User Email,Action,Target,Target ID,IP Address,Payload\n";
    const rows = result.logs.map((log: any) => {
      const payloadStr = log.payload ? JSON.stringify(log.payload).replace(/"/g, '""') : "";
      return `${log.id},"${new Date(log.createdAt).toISOString()}",${log.userId || ""},"${log.user?.email || ""}",${log.action},${log.target},"${log.targetId || ""}",${log.ip},"${payloadStr}"`;
    }).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(headers + rows);
  } catch (error: any) {
    logger.error(`Error in exportAuditLogs: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to export audit logs" });
  }
};
