import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";
import { sanitizeUser } from "../../utils/user.dto.js";
import type { CreateRfidUserDto, UpdateRfidUserDto } from "../../types/index.js";

/**
 * GET /api/rfid - Get all RFID users
 */
export const getAllRfidUsers = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, active, search } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (active !== undefined) {
      where.active = active === "true";
    }
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { rfid_tag: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { holderUser: { name: { contains: search as string, mode: "insensitive" } } },
        { holderUser: { email: { contains: search as string, mode: "insensitive" } } },
        { holderCompany: { name: { contains: search as string, mode: "insensitive" } } },
      ];
    }

    const [rfidUsers, total] = await Promise.all([
      prisma.rfidUser.findMany({
        skip,
        take,
        where,
        include: {
          owner: { select: { id: true, email: true, name: true } },
          ownerCompany: true,
          holderUser: { select: { id: true, email: true, name: true } },
          holderCompany: true,
          transactionPayerUser: { select: { id: true, email: true, name: true } },
          transactionPayerCompany: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.rfidUser.count({ where }),
    ]);

    res.json({
      success: true,
      data: rfidUsers.map(r => ({ ...r, owner: r.owner ? sanitizeUser(r.owner) : r.owner })),
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error(`Error getting RFID users: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get RFID users",
    });
  }
};

/**
 * GET /api/rfid/:id - Get specific RFID user
 */
export const getRfidUserById = async (req: Request, res: Response) => {
  try {
    const rfidUserId = parseId(req.params.id);

    if (!rfidUserId) {
      return res.status(400).json({
        success: false,
        error: "Invalid RFID user ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { rfid_user_id: rfidUserId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.owner_id = userId;
    }

    const rfidUser = await prisma.rfidUser.findFirst({
      where,
      include: {
        owner: { select: { id: true, email: true, name: true } },
        ownerCompany: true,
        holderUser: { select: { id: true, email: true, name: true } },
        holderCompany: true,
        transactionPayerUser: { select: { id: true, email: true, name: true } },
        transactionPayerCompany: true,
        rfidSessions: { take: 10, orderBy: { createdAt: "desc" } },
      },
    });

    if (!rfidUser) {
      return res.status(404).json({
        success: false,
        error: "RFID user not found",
      });
    }



    res.json({ success: true, data: { ...rfidUser, owner: rfidUser.owner ? sanitizeUser(rfidUser.owner) : rfidUser.owner } });
  } catch (error) {
    logger.error(`Error getting RFID user: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get RFID user",
    });
  }
};

/**
 * POST /api/rfid - Create new RFID user
 */
export const createRfidUser = async (req: Request, res: Response) => {
  try {
    const data = req.body as CreateRfidUserDto;

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    // Validate required fields
    if (!data.owner_id) {
      return res.status(400).json({
        success: false,
        error: "owner_id is required",
      });
    }

    if (userRole !== "superadmin" && data.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "You can only create RFID tags for your own account.",
      });
    }

    // Check if RFID tag already exists
    const existing = await prisma.rfidUser.findUnique({
      where: { rfid_tag: data.rfid_tag },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "RFID tag already exists",
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

    // Resolve name from connected holder entity if not explicitly provided
    let derivedName = data.name;
    if (!derivedName || derivedName.trim() === "") {
      if (data.holderType === "company" && data.holderCompanyId) {
        const comp = await prisma.company.findUnique({ where: { id: Number(data.holderCompanyId) } });
        if (comp) derivedName = comp.name;
      } else if (data.holderUserId) {
        const u = await prisma.user.findUnique({ where: { id: Number(data.holderUserId) } });
        if (u) derivedName = u.name || u.email;
      } else if (data.ownerCompanyId) {
        const comp = await prisma.company.findUnique({ where: { id: Number(data.ownerCompanyId) } });
        if (comp) derivedName = comp.name;
      } else if (data.owner_id) {
        const u = await prisma.user.findUnique({ where: { id: Number(data.owner_id) } });
        if (u) derivedName = u.name || u.email;
      }
    }

    const rfidUser = await prisma.rfidUser.create({
      data: {
        ...data,
        name: derivedName || "Unassigned",
        ownerType: data.ownerType || "user",
        ownerCompanyId: data.ownerCompanyId ? Number(data.ownerCompanyId) : null,
        holderType: data.holderType || "user",
        holderUserId: data.holderUserId ? Number(data.holderUserId) : null,
        holderCompanyId: data.holderCompanyId ? Number(data.holderCompanyId) : null,
        transactionPayerType: data.transactionPayerType || null,
        transactionPayerUserId: data.transactionPayerUserId ? Number(data.transactionPayerUserId) : null,
        transactionPayerCompanyId: data.transactionPayerCompanyId ? Number(data.transactionPayerCompanyId) : null,
      },
      include: {
        owner: true,
        ownerCompany: true,
        holderUser: true,
        holderCompany: true,
        transactionPayerUser: true,
        transactionPayerCompany: true,
      },
    });





    logger.info(`RFID user created: ${rfidUser.name} (${rfidUser.rfid_tag})`);

    // Auto-sync Local Authorization List to all chargers
    import("../../services/LocalAuthListService.js")
      .then(({ LocalAuthListService }) => LocalAuthListService.syncAllChargers())
      .catch(() => {});

    res.status(201).json({ success: true, data: { ...rfidUser, owner: rfidUser.owner ? sanitizeUser(rfidUser.owner) : rfidUser.owner } });
  } catch (error) {
    logger.error(`Error creating RFID user: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to create RFID user",
    });
  }
};

/**
 * PUT /api/rfid/:id - Update RFID user
 */
export const updateRfidUser = async (req: Request, res: Response) => {
  try {
    const rfidUserId = parseId(req.params.id);

    if (!rfidUserId) {
      return res.status(400).json({
        success: false,
        error: "Invalid RFID user ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existing = await prisma.rfidUser.findUnique({
      where: { rfid_user_id: rfidUserId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "RFID user not found",
      });
    }

    if (userRole !== "admin" && userRole !== "superadmin" && existing.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const data = req.body as UpdateRfidUserDto;

    // Resolve derived name if holder was updated and name was not explicitly provided
    let derivedName = data.name;
    if (derivedName === undefined && (data.holderUserId !== undefined || data.holderCompanyId !== undefined || data.holderType !== undefined)) {
      const hType = data.holderType !== undefined ? data.holderType : existing.holderType;
      const hCompId = data.holderCompanyId !== undefined ? data.holderCompanyId : existing.holderCompanyId;
      const hUserId = data.holderUserId !== undefined ? data.holderUserId : existing.holderUserId;

      if (hType === "company" && hCompId) {
        const comp = await prisma.company.findUnique({ where: { id: Number(hCompId) } });
        if (comp) derivedName = comp.name;
      } else if (hUserId) {
        const u = await prisma.user.findUnique({ where: { id: Number(hUserId) } });
        if (u) derivedName = u.name || u.email;
      } else if (hCompId === null && hUserId === null) {
        derivedName = "Unassigned";
      }
    }

    const rfidUser = await prisma.rfidUser.update({
      where: { rfid_user_id: rfidUserId },
      data: {
        ...data,
        ...(derivedName !== undefined ? { name: derivedName } : {}),
        ownerCompanyId: data.ownerCompanyId !== undefined ? (data.ownerCompanyId ? Number(data.ownerCompanyId) : null) : undefined,
        holderUserId: data.holderUserId !== undefined ? (data.holderUserId ? Number(data.holderUserId) : null) : undefined,
        holderCompanyId: data.holderCompanyId !== undefined ? (data.holderCompanyId ? Number(data.holderCompanyId) : null) : undefined,
        transactionPayerUserId: data.transactionPayerUserId !== undefined ? (data.transactionPayerUserId ? Number(data.transactionPayerUserId) : null) : undefined,
        transactionPayerCompanyId: data.transactionPayerCompanyId !== undefined ? (data.transactionPayerCompanyId ? Number(data.transactionPayerCompanyId) : null) : undefined,
      },
      include: {
        owner: true,
        ownerCompany: true,
        holderUser: true,
        holderCompany: true,
        transactionPayerUser: true,
        transactionPayerCompany: true,
      },
    });

    logger.info(`RFID user updated: ${rfidUser.name}`);

    // Auto-sync Local Authorization List to all chargers
    import("../../services/LocalAuthListService.js")
      .then(({ LocalAuthListService }) => LocalAuthListService.syncAllChargers())
      .catch(() => {});

    res.json({ success: true, data: { ...rfidUser, owner: rfidUser.owner ? sanitizeUser(rfidUser.owner) : rfidUser.owner } });
  } catch (error) {
    logger.error(`Error updating RFID user: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to update RFID user",
    });
  }
};

/**
 * PATCH /api/rfid/:id/toggle - Toggle RFID user active status
 */
export const toggleRfidUserStatus = async (req: Request, res: Response) => {
  try {
    const rfidUserId = parseId(req.params.id);

    if (!rfidUserId) {
      return res.status(400).json({
        success: false,
        error: "Invalid RFID user ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existing = await prisma.rfidUser.findUnique({
      where: { rfid_user_id: rfidUserId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "RFID user not found",
      });
    }

    if (userRole !== "admin" && userRole !== "superadmin" && existing.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const { active } = req.query;

    if (active === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing query parameter: active",
      });
    }

    const rfidUser = await prisma.rfidUser.update({
      where: { rfid_user_id: rfidUserId },
      data: { active: active === "true" },
      include: { owner: true },
    });

    logger.info(
      `RFID user ${rfidUser.name} ${active === "true" ? "activated" : "deactivated"}`
    );

    // Auto-sync Local Authorization List to all chargers
    import("../../services/LocalAuthListService.js")
      .then(({ LocalAuthListService }) => LocalAuthListService.syncAllChargers())
      .catch(() => {});

    res.json({ success: true, data: { ...rfidUser, owner: rfidUser.owner ? sanitizeUser(rfidUser.owner) : rfidUser.owner } });
  } catch (error) {
    logger.error(`Error toggling RFID user: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to toggle RFID user",
    });
  }
};

/**
 * DELETE /api/rfid/:id - Delete RFID user
 */
export const deleteRfidUser = async (req: Request, res: Response) => {
  try {
    const rfidUserId = parseId(req.params.id);

    if (!rfidUserId) {
      return res.status(400).json({
        success: false,
        error: "Invalid RFID user ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const existing = await prisma.rfidUser.findUnique({
      where: { rfid_user_id: rfidUserId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "RFID user not found",
      });
    }

    if (userRole !== "admin" && userRole !== "superadmin" && existing.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    await prisma.rfidUser.delete({
      where: { rfid_user_id: rfidUserId },
    });

    logger.info(`RFID user deleted: ID ${rfidUserId}`);

    // Auto-sync Local Authorization List to all chargers
    import("../../services/LocalAuthListService.js")
      .then(({ LocalAuthListService }) => LocalAuthListService.syncAllChargers())
      .catch(() => {});

    res.json({ success: true, message: "RFID user deleted" });
  } catch (error) {
    logger.error(`Error deleting RFID user: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete RFID user",
    });
  }
};
