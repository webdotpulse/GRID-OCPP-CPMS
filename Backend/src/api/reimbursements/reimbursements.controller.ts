import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { SepaXmlService } from "../../services/SepaXmlService.js";
import { calculateMonthlyReimbursements } from "../../cron/reimbursementCron.js";

const isAdminOrSuperAdmin = (role?: string) => role === "admin" || role === "superadmin";

export const getContracts = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;

    let whereClause: any = {};
    if (userRole === "superadmin") {
      whereClause = {};
    } else if (isAdminOrSuperAdmin(userRole)) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      if (currentUser?.companyId) {
        whereClause = { user: { companyId: currentUser.companyId } };
      } else {
        whereClause = { userId: userId };
      }
    } else {
      whereClause = { userId: userId };
    }

    const contracts = await prisma.reimbursementContract.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, companyId: true } },
        rfidUser: { select: { rfid_user_id: true, rfid_tag: true, name: true } },
        station: { select: { id: true, station_name: true } },
        tariff: { select: { tariff_id: true, tariff_name: true, electricity_rate: true, tariffType: true } },
      },
    });

    res.json({ success: true, data: contracts });
  } catch (error) {
    logger.error("Error fetching reimbursement contracts:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const createOrUpdateContract = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;
    const { rfidUserId, stationId, tariffId, iban } = req.body;

    let targetUserId = userId;
    // Allow admin to specify userId in body, otherwise default to self
    if (isAdminOrSuperAdmin(userRole) && req.body.userId) {
      targetUserId = Number(req.body.userId);
    }

    if (!targetUserId || !rfidUserId || !stationId || !tariffId || !iban) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (userRole !== "superadmin" && targetUserId !== userId) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { companyId: true } });
      if (!currentUser?.companyId || currentUser.companyId !== targetUser?.companyId) {
        return res.status(403).json({ success: false, error: "Access denied: User not in your organization" });
      }
    }

    const contract = await prisma.reimbursementContract.upsert({
      where: {
        userId_rfidUserId_stationId: {
          userId: targetUserId as number,
          rfidUserId: Number(rfidUserId),
          stationId: Number(stationId),
        },
      },
      update: {
        tariffId: Number(tariffId),
        iban: String(iban).trim(),
      },
      create: {
        userId: targetUserId as number,
        rfidUserId: Number(rfidUserId),
        stationId: Number(stationId),
        tariffId: Number(tariffId),
        iban: String(iban).trim(),
      },
    });

    res.json({ success: true, data: contract });
  } catch (error) {
    logger.error("Error saving reimbursement contract:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const getLedgers = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;

    let whereClause: any = {};
    if (userRole === "superadmin") {
      whereClause = {};
    } else if (isAdminOrSuperAdmin(userRole)) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      if (currentUser?.companyId) {
        whereClause = { contract: { user: { companyId: currentUser.companyId } } };
      } else {
        whereClause = { contract: { userId: userId } };
      }
    } else {
      whereClause = { contract: { userId: userId } };
    }

    const ledgers = await prisma.reimbursementLedger.findMany({
      where: whereClause,
      include: {
        contract: {
          include: {
            user: { select: { name: true, email: true, companyId: true } },
            rfidUser: { select: { rfid_tag: true } },
            station: { select: { station_name: true } },
            tariff: { select: { tariff_name: true } },
          },
        },
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" },
      ],
    });

    res.json({ success: true, data: ledgers });
  } catch (error) {
    logger.error("Error fetching reimbursement ledgers:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const exportSepa = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;

    if (!isAdminOrSuperAdmin(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const includeExported = req.query.includeExported === "true";
    const statusFilter = includeExported
      ? { in: ["pending", "exported"] }
      : "pending";

    let whereClause: any = { status: statusFilter };
    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      if (currentUser?.companyId) {
        whereClause = {
          status: statusFilter,
          contract: { user: { companyId: currentUser.companyId } },
        };
      } else {
        whereClause = {
          status: statusFilter,
          contract: { userId: userId },
        };
      }
    }

    const ledgersToExport = await prisma.reimbursementLedger.findMany({
      where: whereClause,
      include: {
        contract: {
          include: {
            user: { select: { name: true, email: true, companyId: true } },
          },
        },
      },
    });

    if (ledgersToExport.length === 0) {
      return res.status(404).json({ success: false, error: "No pending reimbursements found" });
    }

    const ledgerIds = ledgersToExport.map((l) => l.id);

    // Update exported records atomically in a transaction
    await prisma.$transaction(
      ledgerIds.map((id) =>
        prisma.reimbursementLedger.update({
          where: { id },
          data: {
            status: "exported",
            exportedAt: new Date(),
          },
        })
      )
    );

    const items = ledgersToExport.map((ledger) => ({
      id: ledger.id,
      totalAmount: ledger.totalAmount,
      month: ledger.month,
      year: ledger.year,
      userName: ledger.contract.user.name || ledger.contract.user.email,
      iban: ledger.contract.iban,
    }));

    const sepaXml = SepaXmlService.generatePain001003(items);

    res.header("Content-Type", "application/xml");
    res.attachment("sepa-export.xml");
    return res.send(sepaXml);
  } catch (error) {
    logger.error("Error exporting SEPA:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const markLedgerPaid = async (req: AuthRequest, res: Response) => {
  try {
    const { userRole } = req;
    const ledgerId = parseInt(req.params.id as string, 10);

    if (!isAdminOrSuperAdmin(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (isNaN(ledgerId)) {
      return res.status(400).json({ success: false, error: "Invalid ledger ID" });
    }

    const ledger = await prisma.reimbursementLedger.findUnique({
      where: { id: ledgerId },
      include: {
        contract: {
          include: {
            user: { select: { id: true, companyId: true } },
          },
        },
      },
    });

    if (!ledger) {
      return res.status(404).json({ success: false, error: "Reimbursement ledger not found" });
    }

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
      if (!currentUser?.companyId || currentUser.companyId !== ledger.contract?.user?.companyId) {
        return res.status(403).json({ success: false, error: "Access denied: Ledger not within your organization" });
      }
    }

    const updated = await prisma.reimbursementLedger.update({
      where: { id: ledgerId },
      data: { status: "paid" },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Error marking ledger as paid:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const calculateReimbursementsManual = async (req: AuthRequest, res: Response) => {
  try {
    const { userRole } = req;

    if (!isAdminOrSuperAdmin(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { targetDate, month, year } = req.body;
    let calculationDate: Date | undefined;

    if (month && year) {
      calculationDate = new Date(Date.UTC(Number(year), Number(month) - 1, 15, 0, 0, 0, 0));
    } else if (targetDate) {
      calculationDate = new Date(targetDate);
    }

    const result = await calculateMonthlyReimbursements(calculationDate);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Error manually calculating reimbursements:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
