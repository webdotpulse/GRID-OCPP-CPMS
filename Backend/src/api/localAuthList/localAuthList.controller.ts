import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { LocalAuthListService } from "../../services/LocalAuthListService.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/chargers/:id/local-auth-list
 */
export const getLocalAuthList = async (req: AuthRequest, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chargerId = parseInt(idParam, 10);
    if (isNaN(chargerId)) {
      return res.status(400).json({ success: false, error: "Invalid charger ID" });
    }

    const localList = await LocalAuthListService.getLocalAuthList(chargerId);
    return res.json({ success: true, data: localList });
  } catch (error: any) {
    logger.error(`Error in getLocalAuthList: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to retrieve local auth list" });
  }
};

/**
 * POST /api/chargers/:id/local-auth-list/sync
 */
export const syncLocalAuthList = async (req: AuthRequest, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chargerId = parseInt(idParam, 10);
    const { updateType } = req.body;

    if (isNaN(chargerId)) {
      return res.status(400).json({ success: false, error: "Invalid charger ID" });
    }

    const result = await LocalAuthListService.syncLocalAuthList(
      chargerId,
      updateType === "Differential" ? "Differential" : "Full"
    );

    // Audit log
    await AuditLogService.logAction({
      userId: req.userId,
      action: "LOCAL_AUTH_SYNC",
      target: "Charger",
      targetId: String(chargerId),
      payload: { updateType: updateType || "Full", result },
      ip: req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"],
    });

    return res.json({ success: result.success, data: result });
  } catch (error: any) {
    logger.error(`Error in syncLocalAuthList: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to synchronize local auth list" });
  }
};

/**
 * POST /api/chargers/:id/local-auth-list/version
 */
export const queryLocalListVersion = async (req: AuthRequest, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chargerId = parseInt(idParam, 10);
    if (isNaN(chargerId)) {
      return res.status(400).json({ success: false, error: "Invalid charger ID" });
    }

    const result = await LocalAuthListService.queryChargerListVersion(chargerId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error in queryLocalListVersion: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to query local list version" });
  }
};
