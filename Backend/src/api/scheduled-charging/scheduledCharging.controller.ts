import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { ScheduledChargingService } from "../../services/ScheduledChargingService.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/scheduled-charging
 */
export const getScheduledChargings = async (req: AuthRequest, res: Response) => {
  try {
    const { chargerId, status, search, skip, take } = req.query;

    const result = await ScheduledChargingService.getSchedules({
      userId: req.userId,
      role: req.userRole,
      chargerId: chargerId ? parseInt(chargerId as string, 10) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      skip: skip ? parseInt(skip as string, 10) : 0,
      take: take ? parseInt(take as string, 10) : 50,
    });

    return res.json({
      success: true,
      data: result.data,
      total: result.total,
    });
  } catch (error: any) {
    logger.error(`Error in getScheduledChargings: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to retrieve scheduled charges" });
  }
};

/**
 * GET /api/scheduled-charging/:id
 */
export const getScheduledChargingById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid schedule ID" });
    }

    const schedule = await ScheduledChargingService.getScheduleById(id, req.userId, req.userRole);
    return res.json({
      success: true,
      data: schedule,
    });
  } catch (error: any) {
    logger.error(`Error in getScheduledChargingById: ${error.message}`);
    const statusCode = error.message?.includes("not found") ? 404 : error.message?.includes("Unauthorized") ? 403 : 500;
    return res.status(statusCode).json({ success: false, error: error.message || "Failed to retrieve schedule" });
  }
};

/**
 * POST /api/scheduled-charging
 */
export const createScheduledCharging = async (req: AuthRequest, res: Response) => {
  try {
    const {
      chargerId,
      connectorId,
      idTag,
      name,
      scheduleType,
      recurrence,
      daysOfWeek,
      startTime,
      stopTime,
      startDate,
      stopDate,
      departureTime,
      maxCurrentAmps,
      maxPowerKw,
      targetSoc,
      energyLimitKwh,
      userId,
    } = req.body;

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: chargerId",
      });
    }

    const schedule = await ScheduledChargingService.createSchedule(
      {
        chargerId: Number(chargerId),
        connectorId: connectorId ? Number(connectorId) : 1,
        idTag,
        name,
        scheduleType,
        recurrence,
        daysOfWeek,
        startTime,
        stopTime,
        startDate,
        stopDate,
        departureTime,
        maxCurrentAmps,
        maxPowerKw,
        targetSoc,
        energyLimitKwh,
        userId: userId ? Number(userId) : undefined,
      },
      req.userId,
      req.userRole
    );

    await AuditLogService.logAction({
      userId: req.userId,
      action: "SCHEDULED_CHARGING_CREATE",
      target: "ScheduledCharging",
      targetId: String(schedule.id),
      payload: { chargerId, name: schedule.name, recurrence: schedule.recurrence },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error: any) {
    logger.error(`Error in createScheduledCharging: ${error.message}`);
    const statusCode = error.message?.includes("Unauthorized")
      ? 403
      : error.message?.includes("not found")
      ? 404
      : error.message?.includes("required") || error.message?.includes("Invalid")
      ? 400
      : 500;
    return res.status(statusCode).json({ success: false, error: error.message || "Failed to create scheduled charge" });
  }
};

/**
 * PUT /api/scheduled-charging/:id
 */
export const updateScheduledCharging = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid schedule ID" });
    }

    const updated = await ScheduledChargingService.updateSchedule(id, req.body, req.userId, req.userRole);

    await AuditLogService.logAction({
      userId: req.userId,
      action: "SCHEDULED_CHARGING_UPDATE",
      target: "ScheduledCharging",
      targetId: String(id),
      payload: req.body,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error(`Error in updateScheduledCharging: ${error.message}`);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : error.message?.includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ success: false, error: error.message || "Failed to update scheduled charge" });
  }
};

/**
 * DELETE /api/scheduled-charging/:id
 */
export const deleteScheduledCharging = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid schedule ID" });
    }

    const result = await ScheduledChargingService.deleteSchedule(id, req.userId, req.userRole);

    await AuditLogService.logAction({
      userId: req.userId,
      action: "SCHEDULED_CHARGING_DELETE",
      target: "ScheduledCharging",
      targetId: String(id),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    logger.error(`Error in deleteScheduledCharging: ${error.message}`);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : error.message?.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({ success: false, error: error.message || "Failed to delete scheduled charge" });
  }
};

/**
 * POST /api/scheduled-charging/:id/toggle
 */
export const toggleScheduledCharging = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid schedule ID" });
    }

    const updated = await ScheduledChargingService.toggleSchedule(id, req.userId, req.userRole);

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error(`Error in toggleScheduledCharging: ${error.message}`);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : error.message?.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({ success: false, error: error.message || "Failed to toggle schedule" });
  }
};

/**
 * POST /api/scheduled-charging/:id/execute-now
 */
export const executeScheduledChargingNow = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid schedule ID" });
    }

    const result = await ScheduledChargingService.executeNow(id, req.userId, req.userRole);

    await AuditLogService.logAction({
      userId: req.userId,
      action: "SCHEDULED_CHARGING_EXECUTE_NOW",
      target: "ScheduledCharging",
      targetId: String(id),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json(result);
  } catch (error: any) {
    logger.error(`Error in executeScheduledChargingNow: ${error.message}`);
    const statusCode = error.message?.includes("Unauthorized") ? 403 : error.message?.includes("not found") ? 404 : 500;
    return res.status(statusCode).json({ success: false, error: error.message || "Failed to execute scheduled charge" });
  }
};
