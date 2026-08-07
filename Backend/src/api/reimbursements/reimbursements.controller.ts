import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { SepaXmlService } from "../../services/SepaXmlService.js";

export const getContracts = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;

    let whereClause = {};
    if (userRole !== 'admin') {
       whereClause = { userId: userId };
    }

    const contracts = await prisma.reimbursementContract.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } },
        rfidUser: { select: { rfid_user_id: true, rfid_tag: true, name: true } },
        station: { select: { id: true, station_name: true } },
        tariff: { select: { tariff_id: true, tariff_name: true, electricity_rate: true, tariffType: true } },
      }
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
    if (userRole === 'admin' && req.body.userId) {
       targetUserId = req.body.userId;
    }

    if (!targetUserId || !rfidUserId || !stationId || !tariffId || !iban) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const contract = await prisma.reimbursementContract.upsert({
      where: {
        userId_rfidUserId_stationId: {
          userId: targetUserId as number,
          rfidUserId: Number(rfidUserId),
          stationId: Number(stationId),
        }
      },
      update: {
        tariffId: Number(tariffId),
        iban,
      },
      create: {
        userId: targetUserId as number,
        rfidUserId: Number(rfidUserId),
        stationId: Number(stationId),
        tariffId: Number(tariffId),
        iban,
      }
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

    let whereClause = {};
    if (userRole !== 'admin') {
       whereClause = { contract: { userId: userId } };
    }

    const ledgers = await prisma.reimbursementLedger.findMany({
      where: whereClause,
      include: {
        contract: {
          include: {
            user: { select: { name: true, email: true } },
            rfidUser: { select: { rfid_tag: true } },
            station: { select: { station_name: true } },
            tariff: { select: { tariff_name: true } },
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ]
    });

    res.json({ success: true, data: ledgers });
  } catch (error) {
    logger.error("Error fetching reimbursement ledgers:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const exportSepa = async (req: AuthRequest, res: Response) => {
  try {
    const { userRole } = req;

    if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const pendingLedgers = await prisma.reimbursementLedger.findMany({
      where: { status: 'pending' },
      include: {
        contract: {
          include: {
            user: { select: { name: true } },
          }
        }
      }
    });

    if (pendingLedgers.length === 0) {
      return res.status(404).json({ success: false, error: "No pending reimbursements found" });
    }

    const items = pendingLedgers.map((ledger) => ({
      id: ledger.id,
      totalAmount: ledger.totalAmount,
      month: ledger.month,
      year: ledger.year,
      userName: ledger.contract.user.name,
      iban: ledger.contract.iban,
    }));

    const sepaXml = SepaXmlService.generatePain001003(items);

    res.header('Content-Type', 'application/xml');
    res.attachment('sepa-export.xml');
    return res.send(sepaXml);

  } catch (error) {
    logger.error("Error exporting SEPA:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
