import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";
import { buildOcpiResponse, OcpiService } from "../../../services/OcpiService.js";

/**
 * OCPI 2.2.1 GET /cdrs (Get Charge Detail Records)
 */
export const getOcpiCdrs = async (req: Request, res: Response) => {
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

    const cdrs = await prisma.cDR.findMany({
      where: whereClause,
      include: {
        station: true,
        partner: true,
      },
      skip,
      take,
      orderBy: { startTime: "desc" },
    });

    const ocpiCdrs = cdrs.map((cdr) => ({
      country_code: cdr.station?.country || "NL",
      party_id: "CPMS",
      id: cdr.cdrId,
      start_date_time: cdr.startTime.toISOString(),
      end_date_time: cdr.endTime.toISOString(),
      auth_id: cdr.transactionId,
      auth_method: "AUTH_REQUEST",
      location_id: String(cdr.stationId),
      evse_uid: `NL-CPMS-E${cdr.stationId}`,
      connector_id: "1",
      currency: cdr.currency || "EUR",
      tariffs: [],
      charging_periods: [
        {
          start_date_time: cdr.startTime.toISOString(),
          dimensions: [
            {
              type: "ENERGY",
              volume: cdr.totalEnergy,
            },
            {
              type: "TIME",
              volume: cdr.totalTime,
            },
          ],
        },
      ],
      total_cost: {
        excl_vat: Math.round((cdr.totalCost / 1.21) * 100) / 100,
        incl_vat: cdr.totalCost,
      },
      total_energy: cdr.totalEnergy,
      total_time: cdr.totalTime,
      last_updated: cdr.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiCdrs));
  } catch (error) {
    logger.error("Error fetching OCPI CDRs:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch CDRs"));
  }
};

/**
 * OCPI 2.2.1 GET /cdrs/:cdr_id
 */
export const getOcpiCdrById = async (req: Request, res: Response) => {
  const cdr_id = String(req.params.cdr_id);

  try {
    const cdr = await prisma.cDR.findUnique({
      where: { cdrId: cdr_id },
      include: {
        station: true,
        partner: true,
      },
    });

    if (!cdr) {
      return res.status(404).json(buildOcpiResponse(null, 2003, "CDR not found"));
    }

    const station = (cdr as any).station;

    const ocpiCdr = {
      country_code: station?.country || "NL",
      party_id: "CPMS",
      id: cdr.cdrId,
      start_date_time: cdr.startTime.toISOString(),
      end_date_time: cdr.endTime.toISOString(),
      auth_id: cdr.transactionId,
      auth_method: "AUTH_REQUEST",
      location_id: String(cdr.stationId),
      evse_uid: `NL-CPMS-E${cdr.stationId}`,
      connector_id: "1",
      currency: cdr.currency || "EUR",
      tariffs: [],
      charging_periods: [
        {
          start_date_time: cdr.startTime.toISOString(),
          dimensions: [
            {
              type: "ENERGY",
              volume: cdr.totalEnergy,
            },
            {
              type: "TIME",
              volume: cdr.totalTime,
            },
          ],
        },
      ],
      total_cost: {
        excl_vat: Math.round((cdr.totalCost / 1.21) * 100) / 100,
        incl_vat: cdr.totalCost,
      },
      total_energy: cdr.totalEnergy,
      total_time: cdr.totalTime,
      last_updated: cdr.updatedAt.toISOString(),
    };

    return res.json(buildOcpiResponse(ocpiCdr));
  } catch (error) {
    logger.error(`Error fetching OCPI CDR ${cdr_id}:`, error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch CDR"));
  }
};

/**
 * OCPI 2.2.1 POST /cdrs (Push foreign CDR or trigger partner dispatch)
 */
export const postOcpiCdr = async (req: Request, res: Response) => {
  const cdrData = req.body;

  try {
    if (!cdrData || !cdrData.id) {
      return res.status(400).json(buildOcpiResponse(null, 2001, "Missing CDR payload or id"));
    }

    logger.info(`Received OCPI CDR push for ID: ${cdrData.id}`);

    // If partner triggers internal CDR push
    if (req.query.dispatch && req.query.partnerId) {
      const dispatched = await OcpiService.dispatchCdrToPartner(
        cdrData.id,
        parseInt(req.query.partnerId as string)
      );
      return res.status(200).json(
        buildOcpiResponse({ dispatched, cdrId: cdrData.id })
      );
    }

    return res.status(201).json(buildOcpiResponse({ id: cdrData.id }));
  } catch (error) {
    logger.error("Error processing OCPI POST CDR:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Error processing CDR"));
  }
};
