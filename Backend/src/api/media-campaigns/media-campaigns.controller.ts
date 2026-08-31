import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { dataTransfer } from "../../ocpp/remoteControl.js";

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const campaigns = await (prisma as any).mediaCampaign.findMany({
      include: {
        station: true,
        chargeGroup: true,
      },
    });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    logger.error(`Error fetching campaigns: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch campaigns" });
  }
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    const { name, assetUrl, displayDuration, targetModels, stationId, chargeGroupId } = req.body;

    if (!name || !assetUrl || !targetModels) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // @ts-expect-error userRole attached by middleware
    const userRole = req.userRole;
    // @ts-expect-error userId attached by middleware
    const userId = req.userId;

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      if (stationId) {
        const station = await prisma.chargingStation.findUnique({ where: { id: parseInt(stationId) } });
        if (!station || (station.owner_id !== userId && (!currentUser?.companyId || station.companyId !== currentUser.companyId))) {
          return res.status(403).json({ success: false, error: "Access denied: Station not in your organization" });
        }
      }
    }

    // @ts-ignore
    const campaign = await (prisma as any).mediaCampaign.create({
      data: {
        name,
        assetUrl,
        displayDuration: parseInt(displayDuration) || 30,
        targetModels: targetModels,
        stationId: stationId ? parseInt(stationId) : null,
        chargeGroupId: chargeGroupId ? parseInt(chargeGroupId) : null,
      },
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    logger.error(`Error creating campaign: ${error}`);
    res.status(500).json({ success: false, error: "Failed to create campaign" });
  }
};

export const uploadMedia = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    // Create direct URL
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    res.json({ success: true, data: { url: fileUrl, filename: req.file.filename } });
  } catch (error) {
    logger.error(`Error uploading media: ${error}`);
    res.status(500).json({ success: false, error: "Failed to upload media" });
  }
};

export const pushCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaignId = Array.isArray(id) ? id[0] : id;

    // @ts-ignore
    const campaign = await (prisma as any).mediaCampaign.findUnique({
      where: { id: parseInt(campaignId as string) },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: "Campaign not found" });
    }

    // @ts-expect-error userRole attached by middleware
    const userRole = req.userRole;
    // @ts-expect-error userId attached by middleware
    const userId = req.userId;

    // Find targeted chargers
    let targetChargers: any[] = [];

    if (campaign.stationId) {
      const station = await prisma.chargingStation.findUnique({
        where: { id: campaign.stationId },
        include: { chargers: true }
      });
      if (station) {
        if (userRole !== "superadmin") {
          const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
          if (station.owner_id !== userId && (!currentUser?.companyId || station.companyId !== currentUser.companyId)) {
            return res.status(403).json({ success: false, error: "Access denied: Station not in your organization" });
          }
        }
        targetChargers = [...targetChargers, ...station.chargers];
      }
    }

    if (campaign.chargeGroupId) {
      const group = await prisma.chargeGroup.findUnique({
        where: { id: campaign.chargeGroupId },
        include: { chargers: true }
      });
      if (group) {
        targetChargers = [...targetChargers, ...group.chargers];
      }
    }

    // Filter by target models (if specified)
    const targetModelList = campaign.targetModels as string[];
    if (targetModelList && targetModelList.length > 0) {
      targetChargers = targetChargers.filter(charger =>
        targetModelList.some(model => charger.charger_model?.includes(model))
      );
    }

    if (targetChargers.length === 0) {
      return res.status(400).json({ success: false, error: "No target chargers found for this campaign" });
    }

    const results = [];

    for (const charger of targetChargers) {
      // Build DataTransfer payload for media push
      const payload = JSON.stringify({
        assetUrl: campaign.assetUrl,
        displayDuration: campaign.displayDuration,
        type: "MediaCampaign"
      });

      const vendorId = "ChargeGrid.Media";
      const result = await dataTransfer(charger.charger_id, vendorId, undefined, payload);
      results.push({ chargerId: charger.charger_id, result });
    }

    res.json({ success: true, data: { results } });
  } catch (error) {
    logger.error(`Error pushing campaign: ${error}`);
    res.status(500).json({ success: false, error: "Failed to push campaign" });
  }
};
