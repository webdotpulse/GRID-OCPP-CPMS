import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import {
  isChargerConnected,
  getChargerProtocol,
} from "../../ocpp/remoteControl.js";
import { sanitizeUser } from "../../utils/user.dto.js";
import { parseId, parsePagination } from "../../utils/validation.js";
import type { CreateChargerDto, UpdateChargerDto } from "../../types/index.js";
import { redisClient } from "../../config/redis.js";
import { chargerRegistry } from "../../ocpp/chargerRegistry.js";

/**
 * GET /api/chargers - Get all chargers
 */

/**
 * GET /api/chargers/unrecognized - Get all unrecognized connections
 */
export const getUnrecognizedConnections = async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    const unrecognized = await prisma.unrecognizedConnection.findMany({
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });

    res.json({ success: true, data: unrecognized });
  } catch (error) {
    logger.error(`Error getting unrecognized connections: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get unrecognized connections",
    });
  }
};

/**
 * DELETE /api/chargers/unrecognized - Clear all unrecognized connections
 */
export const deleteUnrecognizedConnections = async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.unrecognizedConnection.deleteMany({});

    logger.info(`Cleared ${deleted.count} unrecognized connections`);
    res.json({ success: true, message: "Unrecognized connections cleared", count: deleted.count });
  } catch (error) {
    logger.error(`Error deleting unrecognized connections: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete unrecognized connections",
    });
  }
};

/**
 * GET /api/chargers/:id/logs - Get charger logs
 */
export const getChargerLogs = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    const { limit = 50 } = req.query;

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { chargerId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const logs = await prisma.ocppLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error(`Error getting charger logs: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get charger logs",
    });
  }
};

/**
 * GET /api/chargers/:id/configurations - Get saved charger configurations
 */
export const getChargerConfigurations = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { chargerId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const configs = await prisma.chargerConfiguration.findMany({
      where,
      orderBy: { key: "asc" },
    });

    res.json({ success: true, data: configs });
  } catch (error) {
    logger.error(`Error getting charger configurations: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get charger configurations",
    });
  }
};

export const getAllChargers = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, search } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const skip = (page - 1) * limit;
    const take = limit;

    let where: any = {};
    if (userRole === "superadmin") {
      where = {};
    } else if (userRole === "admin" || userRole === "client_admin" || userRole === "operator") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      if (currentUser?.companyId) {
        where = {
          OR: [
            { chargingStation: { companyId: currentUser.companyId } },
            { owner: { companyId: currentUser.companyId } },
            { owner_id: userId },
          ],
        };
      } else {
        where = { owner_id: userId };
      }
    } else {
      where = { owner_id: userId };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: search as string, mode: "insensitive" } },
            { serial_number: { contains: search as string, mode: "insensitive" } }
          ]
        }
      ];
    }

    const [chargers, total] = await Promise.all([
      prisma.charger.findMany({
        skip,
        take,
        where,
        include: {
          chargingStation: true,
          chargeGroup: true,
          pairedCharger: true,
          evses: { include: { connectors: true } },
          owner: { select: { id: true, email: true } },
          product: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.charger.count({ where }),
    ]);

    res.json({
      success: true,
      data: chargers.map(c => ({ ...c, owner: c.owner ? sanitizeUser(c.owner) : c.owner })),
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error(`Error getting chargers: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get chargers",
    });
  }
};

/**
 * GET /api/chargers/:id - Get specific charger
 */
export const getChargerById = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: {
        chargingStation: true,
        pairedCharger: true,
        evses: { include: { connectors: true } },
        transactions: { take: 10, orderBy: { createdAt: "desc" } },
        owner: { select: { id: true, email: true, companyId: true } },
        tariffs: true,
        product: true,
      },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    // Multi-tenant check
    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = charger.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        charger.chargingStation?.companyId === currentUser.companyId ||
        charger.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Charger is not within your organization" });
      }
    }

    if (charger.owner) {
      charger.owner = sanitizeUser(charger.owner) as any;
    }

    res.json({ success: true, data: { ...charger, protocol: await getChargerProtocol(chargerId) } });
  } catch (error) {
    logger.error(`Error getting charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get charger",
    });
  }
};

/**
 * GET /api/chargers/:id/status - Get charger status with connection info
 */
export const getChargerStatus = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { charger_id: chargerId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }

    const charger = await prisma.charger.findFirst({
      where,
      select: {
        charger_id: true,
        name: true,
        status: true,
        last_heartbeat: true,
        isCombined: true,
        pairedChargerId: true,
        pairedRole: true,
        isStraightThroughProxy: true,
      },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...charger,
        isOnline: await isChargerConnected(chargerId),
        protocol: await getChargerProtocol(chargerId),
        connectorsCount: await prisma.connector.count({
          where: { evse: { charger_id: chargerId } },
        }),
      },
    });
  } catch (error) {
    logger.error(`Error getting charger status: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get charger status",
    });
  }
};

/**
 * POST /api/chargers - Create new charger
 */
export const createCharger = async (req: Request, res: Response) => {
  try {
    const data = req.body as CreateChargerDto;

    // Validate required fields
    if (!data.charging_station_id) {
      return res.status(400).json({
        success: false,
        error: "charging_station_id is required",
      });
    }

    // Check if charger name already exists
    const existing = await prisma.charger.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Charger name already exists",
      });
    }

    // Verify station exists
    const station = await prisma.chargingStation.findUnique({
      where: { id: data.charging_station_id },
    });

    if (!station) {
      return res.status(400).json({
        success: false,
        error: "Charging station not found",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const currentUserId = req.userId;

    const owner_id = (userRole === "admin" || userRole === "superadmin") && data.owner_id ? data.owner_id : currentUserId;

    const { tariffId, ...chargerData } = data;

    const charger = await prisma.charger.create({
      data: {
        ...chargerData,
        model: chargerData.model || "Unknown",
        manufacturer: chargerData.manufacturer || "Unknown",
        serial_number: chargerData.serial_number || `SN-${Date.now()}`,
        firmware_version: chargerData.firmware_version || "Unknown",
        power_capacity: chargerData.power_capacity || 22.0,
        service_contacts: chargerData.service_contacts || "Support",
        owner_id,
        isPublic: chargerData.isPublic ?? false,
        isStraightThroughProxy: chargerData.isStraightThroughProxy ?? false,
        isCombined: chargerData.isCombined ?? false,
        pairedChargerId: chargerData.pairedChargerId ?? null,
        pairedRole: chargerData.pairedRole ?? null,
        productId: (chargerData as any).productId ? Number((chargerData as any).productId) : null,
        tariffs: tariffId ? { connect: [{ tariff_id: tariffId }] } : undefined,
      },
      include: { chargingStation: true, owner: true, tariffs: true, pairedCharger: true, product: true },
    });

    // Automatically create default EVSE and connector
    const evse = await prisma.evse.create({
      data: {
        charger_id: charger.charger_id,
        evse_id: 1,
      },
    });

    await prisma.connector.create({
      data: {
        evse_id: evse.id,
        connector_name: "Channel 1",
        status: "Unavailable",
        current_type: "AC",
        max_power: charger.power_capacity,
      },
    });

    // Handle updating protocol in Redis if modified by superadmin
    const protocol = (req.body as any).protocol;
    if (userRole === "superadmin" && protocol !== undefined) {
      try {
        await redisClient.hset(chargerRegistry.getRedisKey(charger.charger_id), "protocol", protocol);
      } catch (redisError) {
        logger.error(`Error updating charger protocol in Redis: ${redisError}`);
      }
    }

    if (charger.owner) {
      charger.owner = sanitizeUser(charger.owner) as any;
    }

    logger.info(`Charger created: ${charger.name}`);
    res.status(201).json({ success: true, data: charger });
  } catch (error) {
    logger.error(`Error creating charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to create charger",
    });
  }
};

/**
 * PUT /api/chargers/:id - Update charger
 */
export const updateCharger = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existingCharger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { chargingStation: true, owner: true },
    });

    if (!existingCharger) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = existingCharger.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        existingCharger.chargingStation?.companyId === currentUser.companyId ||
        existingCharger.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: You do not have permission to modify this charger" });
      }
    }

    const allowedFields = [
      "chargeGroupId",
      "quirkProfileId",
      "model",
      "name",
      "manufacturer",
      "serial_number",
      "manufacturing_date",
      "power_capacity",
      "status",
      "firmware_version",
      "service_contacts",
      "tariffId",
      "isPublic",
      "isPredictiveBalancingEnabled",
      "localSolarKwp",
      "thirdPartyBackendUrl",
      "isStraightThroughProxy",
      "isCombined",
      "pairedChargerId",
      "pairedRole",
      "productId",
      "phaseCommutationSupported",
      "currentPhaseMode"
    ];

    if (userRole === "superadmin") {
      allowedFields.push("requireAuth", "protocol");
    }

    const data = req.body as UpdateChargerDto;

    // Strip unallowed fields
    const safeData: any = {};
    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) {
        safeData[key] = (data as any)[key];
      }
    }

    const { tariffId, protocol, productId, ...rest } = safeData;

    const charger = await prisma.charger.update({
      where: { charger_id: chargerId },
      data: {
        ...rest,
        productId: productId !== undefined ? (productId ? Number(productId) : null) : undefined,
        tariffs: tariffId !== undefined ? { set: tariffId ? [{ tariff_id: tariffId }] : [] } : undefined,
      },
      include: { chargingStation: true, owner: true, tariffs: true, product: true },
    });

    if (charger.owner) {
      charger.owner = sanitizeUser(charger.owner) as any;
    }

    logger.info(`Charger updated: ${charger.name}`);
    res.json({ success: true, data: { ...charger, protocol: await getChargerProtocol(chargerId) } });
  } catch (error) {
    logger.error(`Error updating charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to update charger",
    });
  }
};

/**
 * DELETE /api/chargers/:id - Delete charger
 */
export const deleteCharger = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { chargingStation: true, owner: true },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = charger.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        charger.chargingStation?.companyId === currentUser.companyId ||
        charger.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: You do not have permission to delete this charger" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.meterValue.deleteMany({ where: { chargerId } });
      await tx.chargerAlert.deleteMany({ where: { chargerId } });
      await tx.chargingSchedulePlan.deleteMany({ where: { chargerId } });
      await tx.diagnosticEvent.deleteMany({ where: { chargerId } });
      await tx.deviceComponent.deleteMany({ where: { chargerId } });
      await tx.transaction.deleteMany({ where: { charger_id: chargerId } });
      await tx.ocppLog.deleteMany({ where: { chargerId } });
      await tx.rfidSession.deleteMany({ where: { charger_id: chargerId } });
      await tx.chargerConfiguration.deleteMany({ where: { chargerId } });
      await tx.chargingProfile.deleteMany({ where: { chargerId } });
      await tx.connector.deleteMany({ where: { evse: { charger_id: chargerId } } });
      await tx.evse.deleteMany({ where: { charger_id: chargerId } });
      await tx.charger.delete({ where: { charger_id: chargerId } });
    });

    logger.info(`Charger deleted: ID ${chargerId}`);
    res.json({ success: true, message: "Charger deleted" });
  } catch (error) {
    logger.error(`Error deleting charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete charger",
    });
  }
};

/**
 * POST /api/chargers/connectors - Bulk create connectors
 */
export const createBulkConnectors = async (req: Request, res: Response) => {
  try {
    const connectors = req.body;

    const created = await prisma.connector.createMany({
      data: connectors,
    });

    logger.info(`Created ${created.count} connectors`);
    res.status(201).json({ success: true, count: created.count });
  } catch (error) {
    logger.error(`Error creating connectors: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to create connectors",
    });
  }
};

export const getPredictiveSchedule = async (req: Request, res: Response) => {
  try {
    const chargerId = parseInt(req.params.id as string);
    const schedule = await prisma.chargingSchedulePlan.findMany({
      where: { chargerId },
      orderBy: { timestamp: 'asc' },
      take: 24,
    });
    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error(`Error fetching predictive schedule: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch schedule" });
  }
};

/**
 * POST /api/chargers/combine - Combine 2 single chargers of same model/brand as 1 charger with 2 channels
 */
export const combineChargers = async (req: Request, res: Response) => {
  try {
    const { primaryChargerId, secondaryChargerId } = req.body as { primaryChargerId: number; secondaryChargerId: number };

    if (!primaryChargerId || !secondaryChargerId) {
      return res.status(400).json({
        success: false,
        error: "Both primaryChargerId and secondaryChargerId are required",
      });
    }

    if (Number(primaryChargerId) === Number(secondaryChargerId)) {
      return res.status(400).json({
        success: false,
        error: "Cannot combine a charger with itself",
      });
    }

    const [primary, secondary] = await Promise.all([
      prisma.charger.findUnique({
        where: { charger_id: Number(primaryChargerId) },
        include: { evses: { include: { connectors: true } } },
      }),
      prisma.charger.findUnique({
        where: { charger_id: Number(secondaryChargerId) },
        include: { evses: { include: { connectors: true } } },
      }),
    ]);

    if (!primary || !secondary) {
      return res.status(404).json({
        success: false,
        error: "One or both chargers could not be found",
      });
    }

    // Role / ownership checks
    // @ts-expect-error userRole is attached by authenticateToken
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken
    const userId = req.userId;
    if (userRole !== "admin" && userRole !== "superadmin") {
      if (primary.owner_id !== userId || secondary.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You do not have permission to combine these chargers",
        });
      }
    }

    // Validate brand (manufacturer) and model match
    const primaryMfg = (primary.manufacturer || "").trim().toLowerCase();
    const secondaryMfg = (secondary.manufacturer || "").trim().toLowerCase();
    const primaryModel = (primary.model || "").trim().toLowerCase();
    const secondaryModel = (secondary.model || "").trim().toLowerCase();

    if (primaryMfg !== secondaryMfg || primaryModel !== secondaryModel) {
      return res.status(400).json({
        success: false,
        error: `Chargers must have the same brand and model to be combined. Found: Primary [${primary.manufacturer} / ${primary.model}] vs Secondary [${secondary.manufacturer} / ${secondary.model}]`,
      });
    }

    // Check if either is already paired with a different charger
    if (primary.isCombined && primary.pairedChargerId && primary.pairedChargerId !== secondary.charger_id) {
      return res.status(400).json({
        success: false,
        error: `Primary charger ${primary.name} is already paired with charger #${primary.pairedChargerId}. Uncombine it first.`,
      });
    }
    if (secondary.isCombined && secondary.pairedChargerId && secondary.pairedChargerId !== primary.charger_id) {
      return res.status(400).json({
        success: false,
        error: `Secondary charger ${secondary.name} is already paired with charger #${secondary.pairedChargerId}. Uncombine it first.`,
      });
    }

    // Setup EVSE and connectors for Primary (representing the combined 2 sockets)
    let primaryEvse = primary.evses.find(e => e.evse_id === 1) || primary.evses[0];
    if (!primaryEvse) {
      primaryEvse = await prisma.evse.create({
        data: {
          charger_id: primary.charger_id,
          evse_id: 1,
        },
        include: { connectors: true },
      });
    }

    // Ensure Channel 1 on Primary
    const primaryConnectors = primaryEvse.connectors || [];
    const channel1 = primaryConnectors.find(c => c.connector_name === "Channel 1") || primaryConnectors[0];
    if (channel1) {
      if (channel1.connector_name !== "Channel 1") {
        await prisma.connector.update({
          where: { connector_id: channel1.connector_id },
          data: { connector_name: "Channel 1" },
        });
      }
    } else {
      await prisma.connector.create({
        data: {
          evse_id: primaryEvse.id,
          connector_name: "Channel 1",
          status: primary.status === "offline" ? "Unavailable" : "Available",
          current_type: "AC",
          max_power: primary.power_capacity,
        },
      });
    }

    // Ensure Channel 2 on Primary
    const channel2 = primaryConnectors.find(c => c.connector_name === "Channel 2");
    if (!channel2) {
      const secConn = secondary.evses?.[0]?.connectors?.[0];
      const secStatus = secConn?.status || (secondary.status === "offline" ? "Unavailable" : "Available");
      await prisma.connector.create({
        data: {
          evse_id: primaryEvse.id,
          connector_name: "Channel 2",
          status: secStatus,
          current_type: "AC",
          max_power: secondary.power_capacity,
        },
      });
    }

    // Ensure Secondary's connector is labeled Channel 2
    const secEvse = secondary.evses[0];
    if (secEvse && secEvse.connectors?.length > 0) {
      await prisma.connector.update({
        where: { connector_id: secEvse.connectors[0].connector_id },
        data: { connector_name: "Channel 2" },
      });
    }

    // Update both chargers in database
    await prisma.$transaction([
      prisma.charger.update({
        where: { charger_id: primary.charger_id },
        data: {
          isCombined: true,
          pairedChargerId: secondary.charger_id,
          pairedRole: "primary",
        },
      }),
      prisma.charger.update({
        where: { charger_id: secondary.charger_id },
        data: {
          isCombined: true,
          pairedChargerId: primary.charger_id,
          pairedRole: "secondary",
        },
      }),
    ]);

    logger.info(
      `Successfully combined chargers ${primary.name} (Primary - Channel 1) and ${secondary.name} (Secondary - Channel 2)`
    );

    res.json({
      success: true,
      message: `Chargers combined successfully: ${primary.name} as Channel 1 and ${secondary.name} as Channel 2`,
      data: {
        primaryChargerId: primary.charger_id,
        secondaryChargerId: secondary.charger_id,
      },
    });
  } catch (error) {
    logger.error(`Error combining chargers: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to combine chargers",
    });
  }
};

/**
 * POST /api/chargers/uncombine - Uncombine paired chargers
 */
export const uncombineChargers = async (req: Request, res: Response) => {
  try {
    const { chargerId } = req.body as { chargerId: number };

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "chargerId is required",
      });
    }

    const charger = await prisma.charger.findUnique({
      where: { charger_id: Number(chargerId) },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    // Role / ownership checks
    // @ts-expect-error userRole is attached by authenticateToken
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken
    const userId = req.userId;
    if (userRole !== "admin" && userRole !== "superadmin") {
      if (charger.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You do not have permission to uncombine this charger",
        });
      }
    }

    const pairedId = charger.pairedChargerId;

    await prisma.$transaction(async (tx) => {
      await tx.charger.update({
        where: { charger_id: charger.charger_id },
        data: {
          isCombined: false,
          pairedChargerId: null,
          pairedRole: null,
        },
      });

      if (pairedId) {
        await tx.charger.update({
          where: { charger_id: pairedId },
          data: {
            isCombined: false,
            pairedChargerId: null,
            pairedRole: null,
          },
        });
      }
    });

    logger.info(`Successfully uncombined charger ${charger.name}`);
    res.json({
      success: true,
      message: "Chargers uncombined successfully into independent units",
    });
  } catch (error) {
    logger.error(`Error uncombining chargers: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to uncombine chargers",
    });
  }
};

/**
 * GET /api/chargers/:id/combine-candidates - Get eligible pairing candidates
 */
export const getCombineCandidates = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);
    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    const targetCharger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!targetCharger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken
    const userId = req.userId;

    const where: any = {
      charger_id: { not: chargerId },
      isCombined: false,
      manufacturer: { equals: targetCharger.manufacturer, mode: "insensitive" },
      model: { equals: targetCharger.model, mode: "insensitive" },
      charging_station_id: targetCharger.charging_station_id,
    };

    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }

    const candidates = await prisma.charger.findMany({
      where,
      include: {
        chargingStation: true,
        evses: { include: { connectors: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: candidates,
    });
  } catch (error) {
    logger.error(`Error getting combine candidates: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get combine candidates",
    });
  }
};

/**
 * POST /api/chargers/:id/phase-commutation - Evaluate and trigger dynamic phase switching
 */
export const triggerPhaseCommutation = async (req: Request, res: Response) => {
  try {
    const chargerId = parseId(req.params.id);
    if (!chargerId) {
      return res.status(400).json({ success: false, error: "Invalid charger ID" });
    }

    const { availablePowerKw, mode, limitAmps, forceSwitch } = req.body;
    const { PhaseCommutationService } = await import("../../services/PhaseCommutationService.js");

    if (mode === "1-Phase" || mode === "3-Phase") {
      const result = await PhaseCommutationService.setManualPhaseMode(
        chargerId,
        mode,
        limitAmps ? Number(limitAmps) : 16
      );
      return res.json({ success: true, data: result });
    }

    if (availablePowerKw !== undefined) {
      const result = await PhaseCommutationService.evaluatePhaseCommutation({
        chargerId,
        availablePowerKw: Number(availablePowerKw),
        forceSwitch: forceSwitch === true,
      });
      return res.json({ success: true, data: result });
    }

    // Default: evaluate using current active transactions or power capacity
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { transactions: { where: { status: "charging" } } },
    });

    const activePowerKw = charger?.transactions?.[0]?.currentPower
      ? charger.transactions[0].currentPower / 1000
      : charger?.power_capacity || 11.0;

    const result = await PhaseCommutationService.evaluatePhaseCommutation({
      chargerId,
      availablePowerKw: activePowerKw,
      forceSwitch: forceSwitch === true,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error triggering phase commutation: ${error}`);
    res.status(500).json({ success: false, error: error.message || "Failed to trigger phase commutation" });
  }
};


