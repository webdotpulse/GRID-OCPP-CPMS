import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";

/**
 * GET /api/settings/tariffs/entsoe-key
 */
export const getEntsoeApiKey = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "ENTSOE_API_KEY" }
    });

    const maskedKey = setting?.value && setting.value.length > 8
      ? `${setting.value.slice(0, 4)}...${setting.value.slice(-4)}`
      : setting?.value ? "********" : "";

    res.status(200).json({
      success: true,
      data: {
        hasKey: !!setting?.value,
        key: maskedKey
      }
    });
  } catch (error) {
    logger.error("Error fetching ENTSOE API key:", error);
    res.status(500).json({ success: false, error: "Failed to fetch API key" });
  }
};

/**
 * POST /api/settings/tariffs/entsoe-key
 */
export const updateEntsoeApiKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.body;

    if (key === undefined) {
      return res.status(400).json({ success: false, error: "Missing key in body" });
    }

    if (typeof key === "string" && (key.includes("...") || key === "********")) {
      return res.status(200).json({ success: true, message: "API key unchanged" });
    }

    await prisma.systemSetting.upsert({
      where: { key: "ENTSOE_API_KEY" },
      update: { value: key },
      create: { key: "ENTSOE_API_KEY", value: key }
    });

    res.status(200).json({
      success: true,
      message: "API key updated successfully"
    });
  } catch (error) {
    logger.error("Error updating ENTSOE API key:", error);
    res.status(500).json({ success: false, error: "Failed to update API key" });
  }
};
