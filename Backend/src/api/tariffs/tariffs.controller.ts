import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";
import { EpexSpotService } from "../../services/EpexSpotService.js";
import type { CreateTariffDto, UpdateTariffDto } from "../../types/index.js";

/**
 * GET /api/tariffs - Get all tariffs
 */
export const getAllTariffs = async (req: Request, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, search } = req.query;
    const { page, limit } = parsePagination(queryPage, queryLimit);

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};
    if (search) {
      where.tariff_name = {
        contains: search as string,
        mode: "insensitive",
      };
    }

    // @ts-expect-error userRole is attached by authenticateToken middleware
    const userRole = req.userRole;
    // @ts-expect-error userId is attached by authenticateToken middleware
    const userId = req.userId;

    if (userRole !== "admin" && userRole !== "superadmin") {
      where.OR = [
        { chargers: { some: { owner_id: userId } } },
        { chargeGroupUsers: { some: { userId } } }
      ];
    }

    const [tariffs, total] = await Promise.all([
      prisma.tariff.findMany({
        skip,
        take,
        where,
        include: {
          chargers: {
            select: {
              charger_id: true,
              name: true,
              model: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tariff.count({ where }),
    ]);

    res.json({
      success: true,
      data: tariffs,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error(`Error getting tariffs: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get tariffs",
    });
  }
};

/**
 * GET /api/tariffs/:id - Get specific tariff
 */
export const getTariffById = async (req: Request, res: Response) => {
  try {
    const tariffId = parseId(req.params.id);

    if (!tariffId) {
      return res.status(400).json({
        success: false,
        error: "Invalid tariff ID",
      });
    }

    const tariff = await prisma.tariff.findUnique({
      where: { tariff_id: tariffId },
      include: {
        chargers: {
          select: {
            charger_id: true,
            name: true,
            model: true,
            status: true,
            chargingStation: {
              select: {
                id: true,
                station_name: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    if (!tariff) {
      return res.status(404).json({
        success: false,
        error: "Tariff not found",
      });
    }

    res.json({ success: true, data: tariff });
  } catch (error) {
    logger.error(`Error getting tariff: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get tariff",
    });
  }
};

/**
 * POST /api/tariffs - Create new tariff (admin only)
 */
export const createTariff = async (req: Request, res: Response) => {
  try {
    const data = req.body as CreateTariffDto;

    // Validate required fields
    if (!data.tariff_name) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: tariff_name",
      });
    }

    if (data.tariffType === "DYNAMIC_EPEX") {
      if (!data.country || data.markupPerKwh === undefined || data.taxPercentage === undefined || data.fixedFeePerMonth === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields for DYNAMIC_EPEX: country, markupPerKwh, taxPercentage, fixedFeePerMonth",
        });
      }
    } else {
      if (data.charge === undefined || data.electricity_rate === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields for FIXED tariff: charge, electricity_rate",
        });
      }
    }

    // Check if tariff name already exists
    const existing = await prisma.tariff.findUnique({
      where: { tariff_name: data.tariff_name },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Tariff with this name already exists",
      });
    }

    const tariff = await prisma.tariff.create({
      data: {
        tariff_name: data.tariff_name,
        charge: data.charge ?? 0,
        electricity_rate: data.electricity_rate ?? 0,
        tariffType: data.tariffType || "FIXED",
        country: data.country,
        dynamicProvider: data.dynamicProvider || "EnergyZero",
        markupPerKwh: data.markupPerKwh,
        taxPercentage: data.taxPercentage,
        fixedFeePerMonth: data.fixedFeePerMonth,
        time_fee: data.time_fee ?? 0,
        idle_fee: data.idle_fee ?? 0,
      },
    });

    logger.info(`Tariff created: ${tariff.tariff_name} (ID: ${tariff.tariff_id})`);

    // Dispatch Webhook for tariff.created
    import("../../services/WebhookService.js")
      .then(({ WebhookService }) => {
        WebhookService.dispatch("tariff.created", {
          tariffId: tariff.tariff_id,
          tariffName: tariff.tariff_name,
          pricingType: tariff.tariffType,
          energyFee: tariff.electricity_rate,
          connectionFee: tariff.charge,
          idleFee: tariff.idle_fee,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      })
      .catch(() => {});

    res.status(201).json({ success: true, data: tariff });
  } catch (error) {
    logger.error(`Error creating tariff: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to create tariff",
    });
  }
};

/**
 * PUT /api/tariffs/:id - Update tariff (admin only)
 */
export const updateTariff = async (req: Request, res: Response) => {
  try {
    const tariffId = parseId(req.params.id);

    if (!tariffId) {
      return res.status(400).json({
        success: false,
        error: "Invalid tariff ID",
      });
    }

    const data = req.body as UpdateTariffDto;

    // Check if tariff exists
    const existing = await prisma.tariff.findUnique({
      where: { tariff_id: tariffId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Tariff not found",
      });
    }

    // If updating tariff_name, check for duplicates
    if (data.tariff_name && data.tariff_name !== existing.tariff_name) {
      const duplicate = await prisma.tariff.findUnique({
        where: { tariff_name: data.tariff_name },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: "Tariff with this name already exists",
        });
      }
    }

    const tariff = await prisma.tariff.update({
      where: { tariff_id: tariffId },
      data: {
        ...(data.tariff_name !== undefined && { tariff_name: data.tariff_name }),
        ...(data.charge !== undefined && { charge: data.charge }),
        ...(data.electricity_rate !== undefined && { electricity_rate: data.electricity_rate }),
        ...(data.tariffType !== undefined && { tariffType: data.tariffType }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.dynamicProvider !== undefined && { dynamicProvider: data.dynamicProvider }),
        ...(data.markupPerKwh !== undefined && { markupPerKwh: data.markupPerKwh }),
        ...(data.taxPercentage !== undefined && { taxPercentage: data.taxPercentage }),
        ...(data.fixedFeePerMonth !== undefined && { fixedFeePerMonth: data.fixedFeePerMonth }),
        ...(data.time_fee !== undefined && { time_fee: data.time_fee }),
        ...(data.idle_fee !== undefined && { idle_fee: data.idle_fee }),
      },
    });

    logger.info(`Tariff updated: ${tariff.tariff_name} (ID: ${tariff.tariff_id})`);

    // Dispatch Webhook for tariff.updated
    import("../../services/WebhookService.js")
      .then(({ WebhookService }) => {
        WebhookService.dispatch("tariff.updated", {
          tariffId: tariff.tariff_id,
          tariffName: tariff.tariff_name,
          pricingType: tariff.tariffType,
          energyFee: tariff.electricity_rate,
          connectionFee: tariff.charge,
          idleFee: tariff.idle_fee,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      })
      .catch(() => {});

    res.json({ success: true, data: tariff });
  } catch (error) {
    logger.error(`Error updating tariff: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to update tariff",
    });
  }
};

/**
 * DELETE /api/tariffs/:id - Delete tariff (admin only)
 */
export const deleteTariff = async (req: Request, res: Response) => {
  try {
    const tariffId = parseId(req.params.id);

    if (!tariffId) {
      return res.status(400).json({
        success: false,
        error: "Invalid tariff ID",
      });
    }

    // Check if tariff exists
    const existing = await prisma.tariff.findUnique({
      where: { tariff_id: tariffId },
      include: { chargers: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Tariff not found",
      });
    }

    // Check if tariff is assigned to any chargers
    if (existing.chargers.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete tariff: it is assigned to one or more chargers",
      });
    }

    await prisma.tariff.delete({
      where: { tariff_id: tariffId },
    });

    logger.info(`Tariff deleted: ${existing.tariff_name} (ID: ${tariffId})`);
    res.json({ success: true, message: "Tariff deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting tariff: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete tariff",
    });
  }
};

/**
 * POST /api/tariffs/:id/chargers/:chargerId - Assign tariff to charger (admin only)
 */
export const assignTariffToCharger = async (req: Request, res: Response) => {
  try {
    const tariffId = parseId(req.params.id);
    const chargerId = parseId(req.params.chargerId);

    if (!tariffId || !chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid ID(s) provided",
      });
    }

    // Check if tariff exists
    const tariff = await prisma.tariff.findUnique({
      where: { tariff_id: tariffId },
    });

    if (!tariff) {
      return res.status(404).json({
        success: false,
        error: "Tariff not found",
      });
    }

    // Check if charger exists
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    // Assign tariff to charger using connect
    const updatedCharger = await prisma.charger.update({
      where: { charger_id: chargerId },
      data: {
        tariffs: {
          connect: { tariff_id: tariffId },
        },
      },
    });

    logger.info(`Tariff ${tariff.tariff_name} assigned to charger ${charger.name}`);
    res.json({ success: true, data: updatedCharger });
  } catch (error) {
    logger.error(`Error assigning tariff to charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to assign tariff to charger",
    });
  }
};

/**
 * DELETE /api/tariffs/:id/chargers/:chargerId - Remove tariff from charger (admin only)
 */
export const removeTariffFromCharger = async (req: Request, res: Response) => {
  try {
    const tariffId = parseId(req.params.id);
    const chargerId = parseId(req.params.chargerId);

    if (!tariffId || !chargerId) {
      return res.status(400).json({
        success: false,
        error: "Invalid ID(s) provided",
      });
    }

    // Check if tariff exists
    const tariff = await prisma.tariff.findUnique({
      where: { tariff_id: tariffId },
    });

    if (!tariff) {
      return res.status(404).json({
        success: false,
        error: "Tariff not found",
      });
    }

    // Check if charger exists
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: "Charger not found",
      });
    }

    // Remove tariff from charger using disconnect
    const updatedCharger = await prisma.charger.update({
      where: { charger_id: chargerId },
      data: {
        tariffs: {
          disconnect: { tariff_id: tariffId },
        },
      },
    });

    logger.info(`Tariff ${tariff.tariff_name} removed from charger ${charger.name}`);
    res.json({ success: true, data: updatedCharger });
  } catch (error) {
    logger.error(`Error removing tariff from charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to remove tariff from charger",
    });
  }
};

/**
 * POST /api/tariffs/preview-epex - Preview EPEX dynamic tariff prices
 */
export const previewEpexTariff = async (req: Request, res: Response) => {
  try {
    const { country, markupPerKwh, taxPercentage, dynamicProvider } = req.body;

    if (!country || markupPerKwh === undefined || taxPercentage === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: country, markupPerKwh, taxPercentage",
      });
    }

    const now = new Date();
    now.setMinutes(0, 0, 0);

    const previewData = [];
    const provider = dynamicProvider || "EnergyZero";

    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() + i * 60 * 60 * 1000);
      const pricePerMwh = await EpexSpotService.getPriceForTimestamp(country, timestamp, provider);

      if (pricePerMwh !== null) {
        const baseKwhPrice = pricePerMwh / 1000;
        const finalPrice = (baseKwhPrice + Number(markupPerKwh)) * (1 + Number(taxPercentage) / 100);

        previewData.push({
          timestamp,
          price: Number(finalPrice.toFixed(4)),
        });
      }
    }

    res.json({ success: true, data: previewData });
  } catch (error) {
    logger.error(`Error previewing EPEX tariff: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to preview EPEX tariff",
    });
  }
};

/**
 * GET /api/tariffs/:id/chargers - Get all chargers assigned to a tariff
 */
export const getTariffChargers = async (req: Request, res: Response) => {
  try {
    const tariffId = parseId(req.params.id);

    if (!tariffId) {
      return res.status(400).json({
        success: false,
        error: "Invalid tariff ID",
      });
    }

    const tariff = await prisma.tariff.findUnique({
      where: { tariff_id: tariffId },
      include: {
        chargers: {
          select: {
            charger_id: true,
            name: true,
            model: true,
            status: true,
            chargingStation: {
              select: {
                id: true,
                station_name: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    if (!tariff) {
      return res.status(404).json({
        success: false,
        error: "Tariff not found",
      });
    }

    res.json({ success: true, data: tariff.chargers });
  } catch (error) {
    logger.error(`Error getting tariff chargers: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get tariff chargers",
    });
  }
};
