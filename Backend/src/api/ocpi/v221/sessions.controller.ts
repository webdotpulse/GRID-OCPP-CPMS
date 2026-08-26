import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";
import { buildOcpiResponse } from "../../../services/OcpiService.js";

/**
 * OCPI 2.2.1 GET /sessions (Get active/historical roaming sessions)
 */
export const getOcpiSessions = async (req: Request, res: Response) => {
  const { date_from, date_to, offset, limit } = req.query;

  try {
    const whereClause: any = {};
    if (date_from) {
      whereClause.startTime = { gte: new Date(date_from as string) };
    }
    if (date_to) {
      whereClause.startTime = { ...whereClause.startTime, lte: new Date(date_to as string) };
    }

    const skip = offset ? parseInt(offset as string) : 0;
    const take = limit ? parseInt(limit as string) : 50;

    const sessions = await prisma.roamingSession.findMany({
      where: whereClause,
      include: {
        station: true,
        partner: true,
      },
      skip,
      take,
      orderBy: { startTime: "desc" },
    });

    const ocpiSessions = sessions.map((s) => ({
      country_code: s.station?.country || "NL",
      party_id: "CPMS",
      id: String(s.id),
      start_date_time: s.startTime.toISOString(),
      end_date_time: s.endTime ? s.endTime.toISOString() : null,
      kwh: s.energyConsumed,
      cdr_token: {
        uid: s.transactionId,
        type: "RFID",
        contract_id: `ROAM-${s.transactionId}`,
      },
      auth_method: "AUTH_REQUEST",
      location_id: String(s.stationId),
      evse_uid: `NL-CPMS-E${s.stationId}`,
      connector_id: "1",
      currency: "EUR",
      total_cost: {
        incl_vat: s.wholesaleCost,
        excl_vat: Math.round((s.wholesaleCost / 1.21) * 100) / 100,
      },
      status: s.status === "active" ? "ACTIVE" : "COMPLETED",
      last_updated: s.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiSessions));
  } catch (error) {
    logger.error("Error fetching OCPI sessions:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch sessions"));
  }
};

/**
 * OCPI 2.2.1 GET /sessions/:session_id
 */
export const getOcpiSessionById = async (req: Request, res: Response) => {
  const sessionId = String(req.params.session_id);
  const numId = parseInt(sessionId);

  try {
    const whereConditions: any[] = [{ transactionId: sessionId }];
    if (!isNaN(numId)) {
      whereConditions.push({ id: numId });
    }

    const session = await prisma.roamingSession.findFirst({
      where: {
        OR: whereConditions,
      },
      include: { station: true, partner: true },
    });

    if (!session) {
      return res.status(404).json(buildOcpiResponse(null, 2003, "Session not found"));
    }

    const station = (session as any).station;

    const ocpiSession = {
      country_code: station?.country || "NL",
      party_id: "CPMS",
      id: String(session.id),
      start_date_time: session.startTime.toISOString(),
      end_date_time: session.endTime ? session.endTime.toISOString() : null,
      kwh: session.energyConsumed,
      auth_id: session.transactionId,
      auth_method: "AUTH_REQUEST",
      location_id: String(session.stationId),
      evse_uid: `NL-CPMS-E${session.stationId}`,
      connector_id: "1",
      currency: "EUR",
      total_cost: {
        incl_vat: session.wholesaleCost,
        excl_vat: Math.round((session.wholesaleCost / 1.21) * 100) / 100,
      },
      status: session.status === "active" ? "ACTIVE" : "COMPLETED",
      last_updated: session.updatedAt.toISOString(),
    };

    return res.json(buildOcpiResponse(ocpiSession));
  } catch (error) {
    logger.error(`Error fetching OCPI session ${sessionId}:`, error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch session"));
  }
};
