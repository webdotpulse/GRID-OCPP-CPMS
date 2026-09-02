import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";

/**
 * GET /api/charge-groups
 */
export const getAllChargeGroups = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, search } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } }
      ];
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    if (userRole !== "admin" && userRole !== "superadmin") {
      where.users = { some: { userId } };
    }

    const [groups, total] = await Promise.all([
      prisma.chargeGroup.findMany({
        skip,
        take,
        where,
        include: {
          chargers: {
            include: {
              chargingStation: true,
            },
          },
          users: { include: { user: true, tariff: true } }
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.chargeGroup.count({ where }),
    ]);

    res.json({
      success: true,
      data: groups,
      pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error(`Error getting charge groups: ${error}`);
    res.status(500).json({ success: false, error: "Failed to get charge groups" });
  }
};

/**
 * GET /api/charge-groups/:id
 */
export const getChargeGroupById = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid ID" });

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { id };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.users = { some: { userId } };
    }

    const group = await prisma.chargeGroup.findFirst({
      where,
      include: {
        chargers: {
          include: {
            chargingStation: true,
          },
        },
        users: { include: { user: true, tariff: true } }
      },
    });

    if (!group) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: group });
  } catch (error) {
    logger.error(`Error getting charge group: ${error}`);
    res.status(500).json({ success: false, error: "Failed to get charge group" });
  }
};

/**
 * POST /api/charge-groups
 */
export const createChargeGroup = async (req: Request, res: Response) => {
  try {
    const { name, description, chargerIds, users, maxPower } = req.body;

    if (!name) return res.status(400).json({ success: false, error: "Name is required" });

    if (chargerIds && !Array.isArray(chargerIds)) {
      return res.status(400).json({ success: false, error: "chargerIds must be an array" });
    }

    if (users && !Array.isArray(users)) {
      return res.status(400).json({ success: false, error: "users must be an array" });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    if (userRole !== "superadmin" && chargerIds && chargerIds.length > 0) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const targetChargers = await prisma.charger.findMany({
        where: { charger_id: { in: chargerIds } },
        include: { chargingStation: true, owner: true },
      });

      for (const ch of targetChargers) {
        const isOwner = ch.owner_id === userId;
        const isSameCompany = currentUser?.companyId && (
          ch.chargingStation?.companyId === currentUser.companyId ||
          ch.owner?.companyId === currentUser.companyId
        );
        if (!isOwner && !isSameCompany) {
          return res.status(403).json({ success: false, error: `Access denied: Charger #${ch.charger_id} does not belong to your organization` });
        }
      }
    }

    const group = await prisma.chargeGroup.create({
      data: {
        name,
        description,
        maxPower,
        users: {
          create: users?.map((u: any) => ({ userId: u.userId, tariffId: u.tariffId })) || []
        }
      },
      include: {
        chargers: true,
        users: true
      }
    });

    if (chargerIds && chargerIds.length > 0) {
      await prisma.charger.updateMany({
        where: { charger_id: { in: chargerIds } },
        data: { chargeGroupId: group.id }
      });
    }

    // Refetch to include updated chargers
    const updatedGroup = await prisma.chargeGroup.findUnique({
      where: { id: group.id },
      include: { chargers: true, users: true }
    });

    res.status(201).json({ success: true, data: updatedGroup });
  } catch (error) {
    logger.error(`Error creating charge group: ${error}`);
    res.status(500).json({ success: false, error: "Failed to create charge group" });
  }
};

/**
 * PUT /api/charge-groups/:id
 */
export const updateChargeGroup = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid ID" });

    const { name, description, chargerIds, users, maxPower } = req.body;

    if (chargerIds && !Array.isArray(chargerIds)) {
      return res.status(400).json({ success: false, error: "chargerIds must be an array" });
    }

    if (users && !Array.isArray(users)) {
      return res.status(400).json({ success: false, error: "users must be an array" });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    if (userRole !== "superadmin" && chargerIds && chargerIds.length > 0) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const targetChargers = await prisma.charger.findMany({
        where: { charger_id: { in: chargerIds } },
        include: { chargingStation: true, owner: true },
      });

      for (const ch of targetChargers) {
        const isOwner = ch.owner_id === userId;
        const isSameCompany = currentUser?.companyId && (
          ch.chargingStation?.companyId === currentUser.companyId ||
          ch.owner?.companyId === currentUser.companyId
        );
        if (!isOwner && !isSameCompany) {
          return res.status(403).json({ success: false, error: `Access denied: Charger #${ch.charger_id} does not belong to your organization` });
        }
      }
    }

    // We do a transaction to clear existing relations and recreate them
    const group = await prisma.$transaction(async (tx: any) => {
      if (chargerIds) {
        // Unlink all chargers from this group first
        await tx.charger.updateMany({
          where: { chargeGroupId: id },
          data: { chargeGroupId: null }
        });

        // Link the selected chargers to this group
        if (chargerIds.length > 0) {
          await tx.charger.updateMany({
            where: { charger_id: { in: chargerIds } },
            data: { chargeGroupId: id }
          });
        }
      }

      if (users) {
        await tx.chargeGroupUser.deleteMany({ where: { chargeGroupId: id } });
      }

      return tx.chargeGroup.update({
        where: { id },
        data: {
          name,
          description,
          maxPower,
          users: users ? { create: users.map((u: any) => ({ userId: u.userId, tariffId: u.tariffId })) } : undefined
        },
        include: { chargers: true, users: true }
      });
    });

    res.json({ success: true, data: group });
  } catch (error) {
    logger.error(`Error updating charge group: ${error}`);
    res.status(500).json({ success: false, error: "Failed to update charge group" });
  }
};

/**
 * DELETE /api/charge-groups/:id
 */
export const deleteChargeGroup = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid ID" });

    await prisma.chargeGroup.delete({ where: { id } });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    logger.error(`Error deleting charge group: ${error}`);
    res.status(500).json({ success: false, error: "Failed to delete charge group" });
  }
};
