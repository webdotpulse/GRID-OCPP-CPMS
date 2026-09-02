import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";

/**
 * GET /api/transactions - Get all transactions (basic and RFID sessions)
 */
export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, status, chargerId, search } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (chargerId) {
      const parsedChargerId = parseId(chargerId);
      if (parsedChargerId) {
        where.charger_id = parsedChargerId;
      }
    }
    if (search) {
      where.OR = [
        { transactionId: { contains: search as string, mode: "insensitive" } },
        { status: { contains: search as string, mode: "insensitive" } },
        { idTag: { contains: search as string, mode: "insensitive" } }
      ];
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        skip,
        take,
        where,
        include: { charger: true, rfidUser: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        rfidSessions: [],
      },
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error(`Error getting transactions: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get transactions",
    });
  }
};

/**
 * GET /api/transactions/user/:userId - Get all RFID sessions for a specific user
 */
export const getRfidSessionsByUser = async (req: Request, res: Response) => {
  try {
    const rfidUserId = parseId(req.params.userId);

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

    const where: any = { rfidUserId };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        charger: { include: { chargingStation: true } },
        rfidUser: true,
      },
      orderBy: { startTime: "desc" },
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    logger.error(`Error getting RFID sessions for user: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get RFID sessions",
    });
  }
};

/**
 * GET /api/transactions/active - Get all active charging sessions
 */
export const getActiveTransactions = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { status: { in: ["initiated", "charging"] } };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const activeTransactions = await prisma.transaction.findMany({
      where,
      include: {
        charger: { include: { chargingStation: true } },
        rfidUser: true,
      },
      orderBy: { startTime: "desc" },
    });

    const uniqueSessions = activeTransactions.map((t: any) => ({
      ...t,
      type: t.rfidUserId ? "rfid" : "basic",
      userName: t.rfidUser?.name,
      userTag: t.rfidUser?.rfid_tag || t.idTag,
      durationMinutes: Math.floor((Date.now() - new Date(t.startTime).getTime()) / 60000),
    }));

    res.json({ success: true, data: uniqueSessions, count: uniqueSessions.length });
  } catch (error) {
    logger.error(`Error getting active transactions: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get active transactions",
    });
  }
};

/**
 * GET /api/transactions/charger/:chargerId - Get transactions for a specific charger
 */
export const getChargerTransactions = async (req: Request, res: Response) => {
  try {
    const charger_id = parseId(req.params.chargerId);

    if (!charger_id) {
      return res.status(400).json({
        success: false,
        error: "Invalid charger ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const where: any = { charger_id };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { charger: true, rfidUser: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: {
        transactions,
        rfidSessions: [],
        total: transactions.length,
      },
    });
  } catch (error) {
    logger.error(`Error getting charger transactions: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get charger transactions",
    });
  }
};

/**
 * GET /api/transactions/stats - Get transaction statistics
 */
export const getTransactionStats = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const baseWhereTx: any = {};
    if (userRole !== "admin" && userRole !== "superadmin") {
      baseWhereTx.charger = { owner_id: userId };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalTransactions,
      completedTransactions,
      todayTransactions,
      totalEnergy,
      totalCost,
      totalRfidTransactions,
      completedRfidTransactions,
      todayRfidTransactions,
    ] = await Promise.all([
      prisma.transaction.count({ where: baseWhereTx }),
      prisma.transaction.count({ where: { ...baseWhereTx, status: "completed" } }),
      prisma.transaction.count({
        where: {
          ...baseWhereTx,
          createdAt: { gte: today },
        },
      }),
      prisma.transaction.aggregate({
        where: baseWhereTx,
        _sum: { energyConsumed: true },
      }),
      prisma.transaction.aggregate({
        where: baseWhereTx,
        _sum: { totalCost: true },
      }),
      prisma.transaction.count({ where: { ...baseWhereTx, rfidUserId: { not: null } } }),
      prisma.transaction.count({ where: { ...baseWhereTx, rfidUserId: { not: null }, status: "completed" } }),
      prisma.transaction.count({
        where: {
          ...baseWhereTx,
          rfidUserId: { not: null },
          createdAt: { gte: today },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        transactions: {
          total: totalTransactions,
          completed: completedTransactions,
          today: todayTransactions,
          totalEnergyWh: totalEnergy._sum.energyConsumed || 0,
        },
        rfidSessions: {
          total: totalRfidTransactions,
          completed: completedRfidTransactions,
          today: todayRfidTransactions,
          totalAmountDuePaise: totalCost._sum.totalCost || 0,
        },
      },
    });
  } catch (error) {
    logger.error(`Error getting transaction stats: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction statistics",
    });
  }
};

/**
 * GET /api/transactions/:id - Get specific transaction
 */
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const rawId = String(req.params.id || "").trim();

    if (!rawId) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const parsedInt = parseInt(rawId, 10);
    const isDbId = !isNaN(parsedInt) && parsedInt > 0 && parsedInt <= 2147483647 && String(parsedInt) === rawId;

    const idConditions: any[] = [{ transactionId: rawId }];
    if (isDbId) {
      idConditions.push({ id: parsedInt });
    }

    const where: any = {
      OR: idConditions,
    };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    let transaction = await prisma.transaction.findFirst({
      where,
      include: {
        charger: { include: { chargingStation: true } },
        rfidUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If not found in Transaction table, check RfidSession as fallback
    if (!transaction) {
      const rfidWhere: any = {
        OR: idConditions,
      };
      if (userRole !== "admin" && userRole !== "superadmin") {
        rfidWhere.charger = { owner_id: userId };
      }

      const rfidSession = await prisma.rfidSession.findFirst({
        where: rfidWhere,
        include: {
          charger: { include: { chargingStation: true } },
          rfidUser: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (rfidSession) {
        transaction = {
          ...rfidSession,
          totalCost: rfidSession.amountDue,
        } as any;
      }
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    logger.error(`Error getting transaction: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction",
    });
  }
};

/**
 * GET /api/transactions/rfid/:id - Get specific RFID session
 */
export const getRfidSessionById = async (req: Request, res: Response) => {
  try {
    const rawId = String(req.params.id || "").trim();

    if (!rawId) {
      return res.status(400).json({
        success: false,
        error: "Invalid session ID",
      });
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    const parsedInt = parseInt(rawId, 10);
    const isDbId = !isNaN(parsedInt) && parsedInt > 0 && parsedInt <= 2147483647 && String(parsedInt) === rawId;

    const idConditions: any[] = [{ transactionId: rawId }];
    if (isDbId) {
      idConditions.push({ id: parsedInt });
    }

    const where: any = {
      OR: idConditions,
    };
    if (userRole !== "admin" && userRole !== "superadmin") {
      where.charger = { owner_id: userId };
    }

    const rfidSession = await prisma.rfidSession.findFirst({
      where,
      include: {
        charger: { include: { chargingStation: true } },
        rfidUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!rfidSession) {
      return res.status(404).json({
        success: false,
        error: "RFID session not found",
      });
    }

    res.json({ success: true, data: rfidSession });
  } catch (error) {
    logger.error(`Error getting RFID session: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get RFID session",
    });
  }
};
