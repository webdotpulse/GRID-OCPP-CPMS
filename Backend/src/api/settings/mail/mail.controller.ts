import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";

/**
 * GET /api/settings/mail
 */
export const getMailConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.mailConfig.findFirst();

    if (!config) {
      return res.status(200).json({ success: true, data: null });
    }

    const sanitizedConfig = {
      ...config,
      password: config.password ? "********" : "",
      hasPassword: !!config.password,
    };

    res.status(200).json({
      success: true,
      data: sanitizedConfig,
    });
  } catch (error) {
    logger.error("Error fetching Mail config:", error);
    res.status(500).json({ success: false, error: "Failed to fetch Mail config" });
  }
};

/**
 * PUT /api/settings/mail
 */
export const updateMailConfig = async (req: Request, res: Response) => {
  try {
    const { host, port, username, password, fromAddress, isActive } = req.body;

    if (!host || !port || !username || !fromAddress || isActive === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const existingConfig = await prisma.mailConfig.findFirst();

    const passwordToSave = (!password || password === "********") && existingConfig
      ? existingConfig.password
      : password;

    if (!passwordToSave) {
      return res.status(400).json({ success: false, error: "Password is required" });
    }

    let updatedConfig;
    if (existingConfig) {
      updatedConfig = await prisma.mailConfig.update({
        where: { id: existingConfig.id },
        data: { host, port: Number(port), username, password: passwordToSave, fromAddress, isActive }
      });
    } else {
      updatedConfig = await prisma.mailConfig.create({
        data: { host, port: Number(port), username, password: passwordToSave, fromAddress, isActive }
      });
    }

    const sanitizedResponse = {
      ...updatedConfig,
      password: "********",
      hasPassword: true,
    };

    res.status(200).json({
      success: true,
      data: sanitizedResponse,
      message: "Mail configuration updated successfully"
    });
  } catch (error) {
    logger.error("Error updating Mail config:", error);
    res.status(500).json({ success: false, error: "Failed to update Mail config" });
  }
};
