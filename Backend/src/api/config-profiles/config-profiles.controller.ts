import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { changeConfiguration } from "../../ocpp/remoteControl.js";

export const getConfigProfiles = async (req: Request, res: Response) => {
  try {
    const profiles = await prisma.configurationProfile.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: profiles });
  } catch (error) {
    logger.error("Failed to fetch configuration profiles", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const getConfigProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const profile = await prisma.configurationProfile.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error(`Failed to fetch configuration profile ${id}`, error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const createConfigProfile = async (req: Request, res: Response) => {
  const { name, description, items } = req.body;
  try {
    const profile = await prisma.configurationProfile.create({
      data: {
        name,
        description,
        items: {
          create: items.map((item: any) => ({
            key: item.key,
            value: item.value,
          })),
        },
      },
      include: { items: true },
    });
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    logger.error("Failed to create configuration profile", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const updateConfigProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, items } = req.body;
  try {
    // We update name/description, and for simplicity, we delete all items and recreate them
    const profile = await prisma.$transaction(async (tx) => {
      await tx.configurationProfileItem.deleteMany({
        where: { profileId: Number(id) },
      });

      return await tx.configurationProfile.update({
        where: { id: Number(id) },
        data: {
          name,
          description,
          items: {
            create: items.map((item: any) => ({
              key: item.key,
              value: item.value,
            })),
          },
        },
        include: { items: true },
      });
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error(`Failed to update configuration profile ${id}`, error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const deleteConfigProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.configurationProfile.delete({
      where: { id: Number(id) },
    });
    res.json({ success: true, message: "Profile deleted successfully" });
  } catch (error) {
    logger.error(`Failed to delete configuration profile ${id}`, error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const applyConfigProfile = async (req: Request, res: Response) => {
  const { profileId, chargerId } = req.params;

  try {
    const profile = await prisma.configurationProfile.findUnique({
      where: { id: Number(profileId) },
      include: { items: true },
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    const charger = await prisma.charger.findUnique({
      where: { charger_id: Number(chargerId) },
      include: { chargingStation: true, owner: true },
    });

    if (!charger) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }

    // @ts-expect-error userRole is attached by middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by middleware
    const userId = req.userId;

    if (userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      const isOwner = charger.owner_id === userId;
      const isSameCompany = currentUser?.companyId && (
        charger.chargingStation?.companyId === currentUser.companyId ||
        charger.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Charger not in your organization" });
      }
    }

    if (charger.status === "offline") {
      return res.status(400).json({ success: false, error: "Charger is offline" });
    }

    let successCount = 0;
    let failCount = 0;

    // Dispatch ChangeConfiguration commands sequentially
    for (const item of profile.items) {
      try {
        const response = await changeConfiguration(
          charger.charger_id,
          [{ key: item.key, value: item.value }]
        );

        if (response.status === "Accepted" || response.status === "RebootRequired") {
          successCount++;

          // Upsert into ChargerConfiguration model to keep it in sync locally
          await prisma.chargerConfiguration.upsert({
            where: {
              chargerId_key: {
                chargerId: charger.charger_id,
                key: item.key,
              },
            },
            update: { value: item.value },
            create: {
              chargerId: charger.charger_id,
              key: item.key,
              value: item.value,
            },
          });

        } else {
          failCount++;
        }
      } catch (cmdError) {
        logger.error(`Failed to apply config ${item.key} to charger ${charger.charger_id}`, cmdError);
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Profile applied. Successful configurations: ${successCount}, Failed: ${failCount}`,
    });
  } catch (error) {
    logger.error(`Failed to apply profile ${profileId} to charger ${chargerId}`, error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const generateRecoveryProfile = async (req: Request, res: Response) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ success: false, error: "transactionId is required" });
  }

  try {
    const { createProfileBasedOnTransaction } = await import("../../utils/config-profile-helpers.js");
    const profile = await createProfileBasedOnTransaction(Number(transactionId));
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    logger.error(`Failed to generate recovery profile for transaction ${transactionId}`, error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

export const generateStandardProfile = async (req: Request, res: Response) => {
  try {
    const { createSuperExtremeAdvancedProfile } = await import("../../utils/config-profile-helpers.js");
    const profile = await createSuperExtremeAdvancedProfile();
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    logger.error("Failed to generate standard advanced profile", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

/**
 * Returns the list of curated Benelux OEM presets and universal baseline definitions with metadata.
 */
export const getPresetDefinitions = async (req: Request, res: Response) => {
  try {
    const { BENELUX_CHARGER_PROFILES } = await import("../../utils/benelux-charger-profiles.js");
    res.json({ success: true, data: BENELUX_CHARGER_PROFILES });
  } catch (error: any) {
    logger.error("Failed to get preset definitions", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

/**
 * Seeds or updates all Benelux OEM & Universal configuration profiles in the database.
 */
export const seedPresets = async (req: Request, res: Response) => {
  try {
    const { seedAllBeneluxProfiles } = await import("../../utils/benelux-charger-profiles.js");
    const profiles = await seedAllBeneluxProfiles();
    res.status(201).json({
      success: true,
      message: `Successfully seeded ${profiles.length} Benelux and Universal configuration profiles`,
      data: profiles,
    });
  } catch (error: any) {
    logger.error("Failed to seed configuration presets", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};
