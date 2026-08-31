import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";

/**
 * GET /api/connectors - Get all connectors
 */
export const getAllConnectors = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, charger_id } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (charger_id) {
      const parsedChargerId = parseId(charger_id);
      if (parsedChargerId) {
        where.evse = { charger_id: parsedChargerId };
      }
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const tenantCondition = currentUser?.companyId
        ? {
            OR: [
              { owner_id: userId },
              { owner: { companyId: currentUser.companyId } },
              { chargingStation: { companyId: currentUser.companyId } },
            ],
          }
        : { owner_id: userId };

      if (where.evse) {
        where.evse.charger = tenantCondition;
      } else {
        where.evse = { charger: tenantCondition };
      }
    }

    const [connectors, total] = await Promise.all([
      prisma.connector.findMany({
        skip,
        take,
        where,
        include: { evse: { include: { charger: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.connector.count({ where }),
    ]);

    res.json({
      success: true,
      data: connectors,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error(`Error getting channels: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get channels",
    });
  }
};

/**
 * GET /api/connectors/:id - Get specific connector
 */
export const getConnectorById = async (req: Request, res: Response) => {
  try {
    const connectorId = parseId(req.params.id);

    if (!connectorId) {
      return res.status(400).json({
        success: false,
        error: "Invalid channel ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const connector = await prisma.connector.findUnique({
      where: { connector_id: connectorId },
      include: { evse: { include: { charger: { include: { chargingStation: true, owner: true } } } } },
    });

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: "Channel not found",
      });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const charger = connector.evse?.charger;
      const isOwner = charger?.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        charger?.chargingStation?.companyId === currentUser.companyId ||
        charger?.owner?.companyId === currentUser.companyId
      );

      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Connector not within your organization" });
      }
    }

    res.json({ success: true, data: connector });
  } catch (error) {
    logger.error(`Error getting channel: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get channel",
    });
  }
};

/**
 * POST /api/connectors - Create new connector
 */
export const createConnector = async (req: Request, res: Response) => {
  try {
    const { charger_id, ...data } = req.body as any;

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    let evseIdToUse = data.evse_id;

    if (charger_id) {
      const parsedChargerId = parseInt(charger_id, 10);
      const charger = await prisma.charger.findUnique({
        where: { charger_id: parsedChargerId },
        include: { chargingStation: true, owner: true },
      });
      if (!charger) {
        return res.status(400).json({
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
          return res.status(403).json({ success: false, error: "Access denied: Target charger not within your organization" });
        }
      }

      let evse = await prisma.evse.findFirst({
        where: { charger_id: parsedChargerId }
      });

      if (!evse) {
        evse = await prisma.evse.create({
          data: {
            charger_id: parsedChargerId,
            evse_id: 1
          }
        });
      }
      evseIdToUse = evse.id;
    }

    if (!evseIdToUse) {
      return res.status(400).json({
        success: false,
        error: "Either evse_id or charger_id must be provided",
      });
    }

    if (!charger_id) {
      const evse = await prisma.evse.findUnique({
        where: { id: evseIdToUse },
        include: { charger: { include: { chargingStation: true, owner: true } } },
      });

      if (!evse) {
        return res.status(400).json({
          success: false,
          error: "EVSE not found",
        });
      }

      if (userRole !== "superadmin") {
        const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
        const isOwner = evse.charger?.owner_id === userId;
        const isSameCompany = currentUser?.companyId && (
          evse.charger?.chargingStation?.companyId === currentUser.companyId ||
          evse.charger?.owner?.companyId === currentUser.companyId
        );
        if (!isOwner && !isSameCompany) {
          return res.status(403).json({ success: false, error: "Access denied: Target EVSE not within your organization" });
        }
      }
    }

    const connector = await prisma.connector.create({
      data: {
        ...data,
        evse_id: evseIdToUse
      },
      include: { evse: { include: { charger: true } } },
    });

    logger.info(`Channel created: ${connector.connector_name}`);
    res.status(201).json({ success: true, data: connector });
  } catch (error) {
    logger.error(`Error creating channel: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to create channel",
    });
  }
};

/**
 * PUT /api/connectors/:id - Update connector
 */
export const updateConnector = async (req: Request, res: Response) => {
  try {
    const connectorId = parseId(req.params.id);

    if (!connectorId) {
      return res.status(400).json({
        success: false,
        error: "Invalid channel ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existing = await prisma.connector.findUnique({
      where: { connector_id: connectorId },
      include: { evse: { include: { charger: { include: { chargingStation: true, owner: true } } } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Channel not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const charger = existing.evse?.charger;
      const isOwner = charger?.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        charger?.chargingStation?.companyId === currentUser.companyId ||
        charger?.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Connector not within your organization" });
      }
    }

    const { charger_id, evse_id, ...updateData } = req.body as any;

    const connector = await prisma.connector.update({
      where: { connector_id: connectorId },
      data: updateData,
      include: { evse: { include: { charger: true } } },
    });

    logger.info(`Channel updated: ${connector.connector_name}`);
    res.json({ success: true, data: connector });
  } catch (error) {
    logger.error(`Error updating channel: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to update channel",
    });
  }
};

/**
 * DELETE /api/connectors/:id - Delete connector
 */
export const deleteConnector = async (req: Request, res: Response) => {
  try {
    const connectorId = parseId(req.params.id);

    if (!connectorId) {
      return res.status(400).json({
        success: false,
        error: "Invalid channel ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existing = await prisma.connector.findUnique({
      where: { connector_id: connectorId },
      include: { evse: { include: { charger: { include: { chargingStation: true, owner: true } } } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Channel not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const charger = existing.evse?.charger;
      const isOwner = charger?.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        charger?.chargingStation?.companyId === currentUser.companyId ||
        charger?.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Connector not within your organization" });
      }
    }

    await prisma.connector.delete({
      where: { connector_id: connectorId },
    });

    logger.info(`Channel deleted: ID ${connectorId}`);
    res.json({ success: true, message: "Channel deleted" });
  } catch (error) {
    logger.error(`Error deleting channel: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete channel",
    });
  }
};
