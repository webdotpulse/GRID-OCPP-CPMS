import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { ReservationService } from "../../services/ReservationService.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/reservations
 */
export const getReservations = async (req: AuthRequest, res: Response) => {
  try {
    const { chargerId, status, search, page, limit } = req.query;

    const filter: any = {};
    if (chargerId) filter.chargerId = parseInt(chargerId as string, 10);
    if (status) filter.status = String(status);
    if (search) filter.search = String(search);
    if (page) filter.page = parseInt(page as string, 10);
    if (limit) filter.limit = parseInt(limit as string, 10);

    // If not admin/superadmin, scope to own reservations
    if (req.userRole !== "admin" && req.userRole !== "superadmin") {
      filter.userId = req.userId;
    }

    const result = await ReservationService.getReservations(filter);
    return res.json({
      success: true,
      data: result.reservations,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    logger.error(`Error in getReservations: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to retrieve reservations" });
  }
};

/**
 * POST /api/reservations
 */
export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    const { chargerId, connectorId, idTag, parentIdTag, expiryDate } = req.body;

    if (!chargerId || !connectorId || !idTag || !expiryDate) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, connectorId, idTag, expiryDate",
      });
    }

    const parsedExpiry = new Date(expiryDate);
    if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      return res.status(400).json({
        success: false,
        error: "expiryDate must be a valid future datetime",
      });
    }

    const reservation = await ReservationService.createReservation({
      chargerId: Number(chargerId),
      connectorId: Number(connectorId),
      idTag: String(idTag),
      parentIdTag: parentIdTag ? String(parentIdTag) : undefined,
      expiryDate: parsedExpiry,
      userId: req.userId,
    });

    // Audit log
    await AuditLogService.logAction({
      userId: req.userId,
      action: "RESERVATION_CREATE",
      target: "Reservation",
      targetId: String(reservation.reservationId),
      payload: { chargerId, connectorId, idTag, expiryDate },
      ip: req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.status(201).json({ success: true, data: reservation });
  } catch (error: any) {
    logger.error(`Error in createReservation: ${error.message}`);
    return res.status(400).json({ success: false, error: error.message || "Failed to create reservation" });
  }
};

/**
 * POST /api/reservations/:id/cancel
 */
export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reservationId = parseInt(idParam, 10);
    if (isNaN(reservationId)) {
      return res.status(400).json({ success: false, error: "Invalid reservation ID" });
    }

    const result = await ReservationService.cancelReservation(reservationId);

    // Audit log
    await AuditLogService.logAction({
      userId: req.userId,
      action: "RESERVATION_CANCEL",
      target: "Reservation",
      targetId: String(reservationId),
      payload: { result },
      ip: req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({ success: true, data: result.data });
  } catch (error: any) {
    logger.error(`Error in cancelReservation: ${error.message}`);
    return res.status(400).json({ success: false, error: error.message || "Failed to cancel reservation" });
  }
};
