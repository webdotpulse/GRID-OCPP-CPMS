import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { WalletPassService } from "../../services/WalletPassService.js";

/**
 * GET /api/rfid/:id/apple-wallet - Download Apple Wallet .pkpass file
 */
export const downloadAppleWalletPass = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid RFID user ID" });
    }

    const rfidCard = await prisma.rfidUser.findUnique({
      where: { rfid_user_id: id },
    });

    if (!rfidCard) {
      return res.status(404).json({ success: false, error: "RFID card not found" });
    }

    const passBuffer = await WalletPassService.generateApplePkPass(rfidCard);

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="GRID_Pass_${rfidCard.rfid_tag}.pkpass"`
    );
    res.send(passBuffer);
  } catch (error) {
    logger.error(`Error generating Apple Wallet pass: ${error}`);
    res.status(500).json({ success: false, error: "Failed to generate Apple Wallet pass" });
  }
};

/**
 * GET /api/rfid/:id/google-wallet - Get Google Wallet "Save to Google Wallet" link
 */
export const getGoogleWalletUrl = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid RFID user ID" });
    }

    const rfidCard = await prisma.rfidUser.findUnique({
      where: { rfid_user_id: id },
    });

    if (!rfidCard) {
      return res.status(404).json({ success: false, error: "RFID card not found" });
    }

    const saveUrl = WalletPassService.generateGoogleWalletUrl(rfidCard);

    res.json({
      success: true,
      data: {
        saveUrl,
        rfidTag: rfidCard.rfid_tag,
        name: rfidCard.name,
      },
    });
  } catch (error) {
    logger.error(`Error generating Google Wallet link: ${error}`);
    res.status(500).json({ success: false, error: "Failed to generate Google Wallet link" });
  }
};

/**
 * GET /api/rfid/my-wallet-passes - Get digital wallet pass objects for current logged-in driver
 */
export const getMyWalletPasses = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId attached by authenticateToken
    const userId = req.userId;

    const cards = await prisma.rfidUser.findMany({
      where: { owner_id: userId, active: true },
      orderBy: { createdAt: "desc" },
    });

    const passes = cards.map((card) => ({
      rfid_user_id: card.rfid_user_id,
      rfid_tag: card.rfid_tag,
      name: card.name,
      cardScope: card.cardScope,
      appleWalletUrl: `/api/rfid/${card.rfid_user_id}/apple-wallet`,
      googleWalletUrl: WalletPassService.generateGoogleWalletUrl(card),
    }));

    res.json({ success: true, data: passes });
  } catch (error) {
    logger.error(`Error fetching user wallet passes: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch wallet passes" });
  }
};
