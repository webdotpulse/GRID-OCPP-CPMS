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

    let where: any = {};
    if (status) {
      where.status = status;
    }

    if (userRole === "superadmin") {
      // Superadmin can view all stations
    } else if (userRole === "admin" || userRole === "client_admin" || userRole === "operator") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      if (currentUser?.companyId) {
        where.OR = [
          { companyId: currentUser.companyId },
          { owner_id: userId },
        ];
      } else {
        where.owner_id = userId;
      }
    } else {
      where.owner_id = userId;
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { station_name: { contains: search as string, mode: "insensitive" } },
            { city: { contains: search as string, mode: "insensitive" } }
          ]
        }
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
      data: stations.map(s => ({
        ...s,
        owner: s.owner ? sanitizeUser(s.owner) : s.owner,
        _count: {
          chargers: Array.isArray(s.chargers) ? s.chargers.length : 0,
          parkingSpots: Array.isArray(s.parkingSpots) ? s.parkingSpots.length : 0,
        },
      })),
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

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: {
        owner: { select: { id: true, email: true, companyId: true } },
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

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = station.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        station.companyId === currentUser.companyId ||
        station.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Station is not within your organization" });
      }
    }

    // Sanitize owner field just in case
    if (station.owner) {
      station.owner = sanitizeUser(station.owner) as any;
    }

    res.json({
      success: true,
      data: {
        ...station,
        _count: {
          chargers: Array.isArray(station.chargers) ? station.chargers.length : 0,
          parkingSpots: Array.isArray(station.parkingSpots) ? station.parkingSpots.length : 0,
        },
      },
    });
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

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      select: { id: true, owner_id: true, companyId: true },
    });

    if (!station) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = station.owner_id === userId;
      const isSameCompany = currentUser?.companyId && station.companyId === currentUser.companyId;

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Station is not within your organization" });
      }
    }

    const chargers = await prisma.charger.findMany({
      where: { charging_station_id: stationId },
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

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    // Default owner_id to current user if not provided or non-superadmin
    const targetOwnerId = (userRole === "superadmin" && data.owner_id) ? data.owner_id : (data.owner_id || userId);

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: targetOwnerId },
      select: { id: true, companyId: true },
    });

    if (!owner) {
      return res.status(400).json({
        success: false,
        error: "Owner not found",
      });
    }

    let companyId = (data as any).companyId || owner.companyId || null;
    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      companyId = currentUser?.companyId || owner.companyId || null;
    }

    const station = await prisma.chargingStation.create({
      data: {
        ...data,
        owner_id: targetOwnerId,
        companyId,
      } as any,
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

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existingStation = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: { owner: true },
    });

    if (!existingStation) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = existingStation.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        existingStation.companyId === currentUser.companyId ||
        existingStation.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: You do not have permission to modify this station" });
      }
    }

    const updatePayload = { ...req.body };
    if (userRole !== "superadmin") {
      delete updatePayload.companyId;
      delete updatePayload.owner_id;
    }

    const station = await prisma.chargingStation.update({
      where: { id: stationId },
      data: updatePayload,
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

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: { chargers: { select: { charger_id: true } }, owner: true },
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        error: "Station not found",
      });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = station.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        station.companyId === currentUser.companyId ||
        station.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: You do not have permission to delete this station" });
      }
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

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: { owner: true },
    });

    if (!station) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = station.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        station.companyId === currentUser.companyId ||
        station.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Station not within your organization" });
      }
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

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: { owner: true },
    });

    if (!station) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = station.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        station.companyId === currentUser.companyId ||
        station.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Station not within your organization" });
      }
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
            metadata: spot.metadata || null,
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

/**
 * GET /api/stations/:id/topology - Get live electrical topology, feeder cable loading, and 3-phase telemetry
 */
export const getStationTopology = async (req: Request, res: Response) => {
  try {
    const stationId = parseId(req.params.id);
    if (!stationId) {
      return res.status(400).json({ success: false, error: "Invalid station ID" });
    }

    const station = await prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: {
        parkingSpots: {
          include: {
            connector: {
              include: {
                evse: {
                  include: {
                    charger: true,
                  },
                },
              },
            },
          },
        },
        chargers: {
          include: {
            evses: {
              include: {
                connectors: true,
              },
            },
            meterValues: {
              orderBy: { timestamp: "desc" },
              take: 1,
            },
            transactions: {
              where: { status: "charging" },
              take: 1,
            },
          },
        },
      },
    });

    if (!station) {
      return res.status(404).json({ success: false, error: "Station not found" });
    }

    // Build charger phase telemetry map
    const chargerTelemetryMap = new Map();
    let totalStationCurrentL1 = 0;
    let totalStationCurrentL2 = 0;
    let totalStationCurrentL3 = 0;
    let totalStationPowerKw = 0;

    for (const charger of station.chargers) {
      const latestMeter = charger.meterValues[0];
      const activeTx = charger.transactions[0];

      let l1 = latestMeter?.current_L1 ?? 0;
      let l2 = latestMeter?.current_L2 ?? 0;
      let l3 = latestMeter?.current_L3 ?? 0;
      const v1 = latestMeter?.voltage_L1 ?? 230.0;
      const v2 = latestMeter?.voltage_L2 ?? 230.0;
      const v3 = latestMeter?.voltage_L3 ?? 230.0;
      let kw = (latestMeter?.power ? latestMeter.power / 1000 : 0) || (activeTx?.currentPower || 0);

      // If active session but raw 3-phase amps not recorded individually, compute balanced phase split
      if (activeTx && l1 === 0 && l2 === 0 && l3 === 0) {
        const powerKw = activeTx.currentPower || 11.0;
        kw = powerKw;
        const ampsPerPhase = (powerKw * 1000) / (3 * 230);
        l1 = Math.round(ampsPerPhase * 10) / 10;
        l2 = Math.round(ampsPerPhase * 10) / 10;
        l3 = Math.round(ampsPerPhase * 10) / 10;
      }

      totalStationCurrentL1 += l1;
      totalStationCurrentL2 += l2;
      totalStationCurrentL3 += l3;
      totalStationPowerKw += kw;

      const avgAmps = (l1 + l2 + l3) / 3;
      const maxAmps = Math.max(l1, l2, l3);
      const unbalanceAmps = Math.round(Math.max(0, maxAmps - Math.min(l1, l2, l3)) * 10) / 10;
      const unbalancePercentage = avgAmps > 0 ? Math.round(((maxAmps - avgAmps) / avgAmps) * 100) : 0;

      chargerTelemetryMap.set(charger.charger_id, {
        chargerId: charger.charger_id,
        name: charger.name,
        status: charger.status,
        activePowerKw: Math.round(kw * 100) / 100,
        currentL1: Math.round(l1 * 10) / 10,
        currentL2: Math.round(l2 * 10) / 10,
        currentL3: Math.round(l3 * 10) / 10,
        voltageL1: Math.round(v1 * 10) / 10,
        voltageL2: Math.round(v2 * 10) / 10,
        voltageL3: Math.round(v3 * 10) / 10,
        unbalanceAmps,
        unbalancePercentage,
        isUnbalanced: unbalanceAmps > 16.0,
      });
    }

    // Process nodes and feeder cables
    const nodes = [];
    const feeders = [];

    for (const spot of station.parkingSpots) {
      const type = spot.type || "spot";
      const metadata: any = spot.metadata || {};

      if (type === "feeder") {
        const ratedAmps = metadata.maxCurrentAmps || 160;
        const sourceNodeId = metadata.sourceNodeId;
        const targetNodeId = metadata.targetNodeId;

        // Calculate downstream active current
        let feederCurrentL1 = 0;
        let feederCurrentL2 = 0;
        let feederCurrentL3 = 0;

        // If target is a charger spot or connector
        const targetSpot = station.parkingSpots.find((s) => s.id === targetNodeId);
        const chargerId = targetSpot?.connector?.evse?.charger_id;

        if (chargerId && chargerTelemetryMap.has(chargerId)) {
          const telemetry = chargerTelemetryMap.get(chargerId);
          feederCurrentL1 = telemetry.currentL1;
          feederCurrentL2 = telemetry.currentL2;
          feederCurrentL3 = telemetry.currentL3;
        } else {
          // If feeder originates from main transformer, distribute proportional current
          const feederCount = Math.max(station.parkingSpots.filter(s => s.type === "feeder").length, 1);
          feederCurrentL1 = Math.round((totalStationCurrentL1 / feederCount) * 10) / 10;
          feederCurrentL2 = Math.round((totalStationCurrentL2 / feederCount) * 10) / 10;
          feederCurrentL3 = Math.round((totalStationCurrentL3 / feederCount) * 10) / 10;
        }

        const maxPhaseCurrent = Math.max(feederCurrentL1, feederCurrentL2, feederCurrentL3);
        const loadPercentage = Math.round((maxPhaseCurrent / ratedAmps) * 100);

        let loadLevel: "normal" | "warning" | "critical" = "normal";
        if (loadPercentage > 85) {
          loadLevel = "critical";
        } else if (loadPercentage >= 60) {
          loadLevel = "warning";
        }

        feeders.push({
          id: spot.id,
          name: spot.name,
          sourceNodeId,
          targetNodeId,
          cableType: metadata.cableType || "4x50mm² Cu",
          lengthMeters: metadata.lengthMeters || 25,
          ratedCurrentAmps: ratedAmps,
          activeCurrentL1: feederCurrentL1,
          activeCurrentL2: feederCurrentL2,
          activeCurrentL3: feederCurrentL3,
          maxPhaseCurrent,
          loadPercentage,
          loadLevel,
          points: metadata.points || null,
        });
      } else {
        const chargerId = spot.connector?.evse?.charger_id;
        const telemetry = chargerId ? chargerTelemetryMap.get(chargerId) : null;

        nodes.push({
          id: spot.id,
          name: spot.name,
          type: spot.type,
          x: spot.x,
          y: spot.y,
          width: spot.width,
          height: spot.height,
          rotation: spot.rotation,
          fillColor: spot.fillColor,
          lineColor: spot.lineColor,
          lineWidth: spot.lineWidth,
          connectorId: spot.connector?.connector_id,
          chargerId: chargerId || null,
          metadata: spot.metadata,
          telemetry: telemetry || null,
        });
      }
    }

    const stationMaxAmps = Math.max(totalStationCurrentL1, totalStationCurrentL2, totalStationCurrentL3);
    const stationUnbalanceAmps = Math.round(Math.max(0, stationMaxAmps - Math.min(totalStationCurrentL1, totalStationCurrentL2, totalStationCurrentL3)) * 10) / 10;

    res.json({
      success: true,
      data: {
        stationId: station.id,
        stationName: station.station_name,
        maxPowerKw: station.maxPower || 250,
        activePowerKw: Math.round(totalStationPowerKw * 100) / 100,
        totalCurrentL1: Math.round(totalStationCurrentL1 * 10) / 10,
        totalCurrentL2: Math.round(totalStationCurrentL2 * 10) / 10,
        totalCurrentL3: Math.round(totalStationCurrentL3 * 10) / 10,
        stationUnbalanceAmps,
        isStationUnbalanced: stationUnbalanceAmps > 16.0,
        nodes,
        feeders,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching station electrical topology:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch station topology" });
  }
};
