import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { sanitizeUser } from "../../utils/user.dto.js";
import { parseId, parsePagination } from "../../utils/validation.js";
import type { CreateStationDto } from "../../types/index.js";

/**
 * GET /api/stations - Get all stations
 */
export const getAllStations = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, status, search } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }

    if (search) {
      where.OR = [
        { station_name: { contains: search as string, mode: "insensitive" } },
        { city: { contains: search as string, mode: "insensitive" } }
      ];
    }

    const [stations, total] = await Promise.all([
      prisma.chargingStation.findMany({
        skip,
        take,
        where,
        include: {
          owner: { select: { id: true, email: true } },
        parkingSpots: true,
          chargers: {
            include: { evses: { include: { connectors: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.chargingStation.count({ where }),
    ]);

    res.json({
      success: true,
      data: stations.map(s => ({ ...s, owner: s.owner ? sanitizeUser(s.owner) : s.owner })),
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error(`Error getting stations: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get stations",
    });
  }
};

/**
 * GET /api/stations/:id - Get specific station
 */
export const getStationById = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: "Invalid station ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { id: stationId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }

    const station = await prisma.chargingStation.findFirst({
      where,
      include: {
        owner: { select: { id: true, email: true } },
        parkingSpots: true,
        chargers: {
          include: { evses: { include: { connectors: true } } },
        },
      },
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        error: "Station not found",
      });
    }

    // Sanitize owner field just in case
    if (station.owner) {
      station.owner = sanitizeUser(station.owner) as any;
    }

    res.json({ success: true, data: station });
  } catch (error) {
    logger.error(`Error getting station: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get station",
    });
  }
};

/**
 * GET /api/stations/:id/chargers - Get all chargers for a station
 */
export const getStationChargers = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: "Invalid station ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { charging_station_id: stationId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }

    const chargers = await prisma.charger.findMany({
      where,
      include: { evses: { include: { connectors: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: chargers });
  } catch (error) {
    logger.error(`Error getting station chargers: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get station chargers",
    });
  }
};

/**
 * POST /api/stations - Create new station
 */
export const createStation = async (req: Request, res: Response) => {
  try {
    const data = req.body as CreateStationDto;

    // Validate required fields
    if (!data.owner_id) {
      return res.status(400).json({
        success: false,
        error: "owner_id is required",
      });
    }

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: data.owner_id },
    });

    if (!owner) {
      return res.status(400).json({
        success: false,
        error: "Owner not found",
      });
    }

    const station = await prisma.chargingStation.create({
      data,
      include: { owner: true, chargers: true },
    });

    if (station.owner) {
      station.owner = sanitizeUser(station.owner) as any;
    }

    logger.info(`Station created: ${station.station_name}`);
    res.status(201).json({ success: true, data: station });
  } catch (error) {
    logger.error(`Error creating station: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to create station",
    });
  }
};

/**
 * PUT /api/stations/:id - Update station
 */
export const updateStation = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: "Invalid station ID",
      });
    }

    const station = await prisma.chargingStation.update({
      where: { id: stationId },
      data: req.body,
      include: { owner: true, chargers: true },
    });

    if (station.owner) {
      station.owner = sanitizeUser(station.owner) as any;
    }
    logger.info(`Station updated: ${station.station_name}`);
    res.json({ success: true, data: station });
  } catch (error) {
    logger.error(`Error updating station: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to update station",
    });
  }
};

/**
 * DELETE /api/stations/:id - Delete station
 */
export const deleteStation = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);

    if (!stationId) {
      return res.status(400).json({
        success: false,
        error: "Invalid station ID",
      });
    }

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: { chargers: { select: { charger_id: true } } },
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        error: "Station not found",
      });
    }

    const chargerIds = station.chargers.map((c) => c.charger_id);

    await prisma.$transaction(async (tx) => {
      // 1. Clean up charger dependencies if any chargers exist on station
      if (chargerIds.length > 0) {
        await tx.meterValue.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.chargerAlert.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.chargingSchedulePlan.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.diagnosticEvent.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.deviceComponent.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.transaction.deleteMany({ where: { charger_id: { in: chargerIds } } });
        await tx.ocppLog.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.rfidSession.deleteMany({ where: { charger_id: { in: chargerIds } } });
        await tx.chargerConfiguration.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.chargingProfile.deleteMany({ where: { chargerId: { in: chargerIds } } });
        await tx.connector.deleteMany({ where: { evse: { charger_id: { in: chargerIds } } } });
        await tx.evse.deleteMany({ where: { charger_id: { in: chargerIds } } });
        await tx.charger.deleteMany({ where: { charger_id: { in: chargerIds } } });
      }

      // 2. Clean up station-level resources
      await tx.parkingSpot.deleteMany({ where: { stationId } });
      await tx.roamingSession.deleteMany({ where: { stationId } });
      await tx.cDR.deleteMany({ where: { stationId } });
      await tx.mediaCampaign.deleteMany({ where: { stationId } });
      await tx.reimbursementContract.deleteMany({ where: { stationId } });

      // 3. Delete the station
      await tx.chargingStation.delete({
        where: { id: stationId },
      });
    });

    logger.info(`Station deleted: ID ${stationId}`);
    res.json({ success: true, message: "Station deleted" });
  } catch (error) {
    logger.error(`Error deleting station: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete station",
    });
  }
};

/**
 * GET /api/stations/:id/parking-spots
 */
export const getParkingSpots = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);
    if (!stationId) {
      return res.status(400).json({ success: false, error: "Invalid station ID" });
    }

    const parkingSpots = await prisma.parkingSpot.findMany({
      where: { stationId },
      include: {
        connector: {
           include: {
             evse: {
                include: {
                   charger: true
                }
             }
           }
        }
      }
    });

    res.json({ success: true, data: parkingSpots });
  } catch (error) {
    logger.error(`Error getting parking spots: ${error}`);
    res.status(500).json({ success: false, error: "Failed to get parking spots" });
  }
};

/**
 * PUT /api/stations/:id/parking-spots
 * Updates the entire ground plan for a station. Expects an array of parking spots.
 */
export const updateParkingSpots = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);
    if (!stationId) {
      return res.status(400).json({ success: false, error: "Invalid station ID" });
    }

    const spots = req.body.spots || [];

    // Begin a transaction to update the entire ground plan
    await prisma.$transaction(async (tx) => {
      // Clear out existing connectors' associations for this station's parking spots
      const existingSpots = await tx.parkingSpot.findMany({ where: { stationId }, select: { id: true } });
      const existingSpotIds = existingSpots.map(s => s.id);

      if (existingSpotIds.length > 0) {
         await tx.connector.updateMany({
           where: { parkingSpotId: { in: existingSpotIds } },
           data: { parkingSpotId: null }
         });
         await tx.parkingSpot.deleteMany({
           where: { stationId }
         });
      }

      // Insert new spots and update connectors
      for (const spot of spots) {
        const createdSpot = await tx.parkingSpot.create({
          data: {
            stationId,
            name: spot.name || 'Unnamed Spot',
            type: spot.type || 'spot',
            fillColor: spot.fillColor,
            lineColor: spot.lineColor,
            lineWidth: spot.lineWidth,
            x: spot.x,
            y: spot.y,
            width: spot.width,
            height: spot.height,
            rotation: spot.rotation || 0,
          }
        });

        if (spot.connectorId) {
          await tx.connector.update({
            where: { connector_id: parseInt(spot.connectorId, 10) },
            data: { parkingSpotId: createdSpot.id }
          });
        }
      }
    });

    const updatedSpots = await prisma.parkingSpot.findMany({
      where: { stationId },
      include: { connector: { include: { evse: { include: { charger: true } } } } }
    });

    res.json({ success: true, data: updatedSpots });
  } catch (error) {
    logger.error(`Error updating parking spots: ${error}`);
    res.status(500).json({ success: false, error: "Failed to update parking spots" });
  }
};
