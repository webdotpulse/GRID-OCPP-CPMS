import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { AutoHealPlaybookService } from "../../services/AutoHealPlaybookService.js";

const parseId = (id: string | string[] | undefined) => {
  if (typeof id !== "string") return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * GET /api/auto-heal-playbooks - List all playbooks
 */
export const getPlaybooks = async (req: Request, res: Response) => {
  try {
    const { vendor, category, search, isActive } = req.query;

    const where: any = {};
    if (vendor && typeof vendor === "string" && vendor !== "All") {
      where.vendor = vendor;
    }
    if (category && typeof category === "string" && category !== "All") {
      where.category = category;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }
    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { errorCodePattern: { contains: search, mode: "insensitive" } },
      ];
    }

    const playbooks = await prisma.autoHealPlaybook.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    res.json({ success: true, data: playbooks });
  } catch (error) {
    logger.error(`Error fetching auto-heal playbooks: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch playbooks" });
  }
};

/**
 * GET /api/auto-heal-playbooks/stats - KPI stats for Auto-Healing
 */
export const getPlaybookStats = async (req: Request, res: Response) => {
  try {
    const totalPlaybooks = await prisma.autoHealPlaybook.count();
    const activePlaybooks = await prisma.autoHealPlaybook.count({ where: { isActive: true } });
    const totalExecutions = await prisma.autoHealExecution.count();
    const successfulExecutions = await prisma.autoHealExecution.count({ where: { status: "COMPLETED" } });
    const failedExecutions = await prisma.autoHealExecution.count({ where: { status: "FAILED" } });
    const activeRunning = await prisma.autoHealExecution.count({ where: { status: "RUNNING" } });

    const uniqueChargersHealed = await prisma.autoHealExecution.groupBy({
      by: ["chargerId"],
      where: { status: "COMPLETED" },
    });

    const successRate =
      totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 100;

    res.json({
      success: true,
      data: {
        totalPlaybooks,
        activePlaybooks,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        activeRunning,
        healedChargersCount: uniqueChargersHealed.length,
        successRate,
      },
    });
  } catch (error) {
    logger.error(`Error fetching playbook stats: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
};

/**
 * GET /api/auto-heal-playbooks/executions - List recent executions
 */
export const getExecutions = async (req: Request, res: Response) => {
  try {
    const { chargerId, playbookId, status, limit = "50", offset = "0" } = req.query;

    const where: any = {};
    if (chargerId) where.chargerId = parseInt(String(chargerId), 10);
    if (playbookId) where.playbookId = parseInt(String(playbookId), 10);
    if (status) where.status = String(status);

    const [executions, total] = await Promise.all([
      prisma.autoHealExecution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: parseInt(String(limit), 10),
        skip: parseInt(String(offset), 10),
        include: {
          playbook: {
            select: {
              name: true,
              vendor: true,
              category: true,
              severity: true,
            },
          },
          charger: {
            select: {
              name: true,
              model: true,
              manufacturer: true,
              status: true,
            },
          },
        },
      }),
      prisma.autoHealExecution.count({ where }),
    ]);

    res.json({ success: true, data: executions, total });
  } catch (error) {
    logger.error(`Error fetching auto-heal executions: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch executions" });
  }
};

/**
 * GET /api/auto-heal-playbooks/executions/:id - Single execution detail with step timeline
 */
export const getExecution = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid execution ID" });

    const execution = await prisma.autoHealExecution.findUnique({
      where: { id },
      include: {
        playbook: true,
        charger: {
          select: {
            charger_id: true,
            name: true,
            model: true,
            manufacturer: true,
            status: true,
          },
        },
      },
    });

    if (!execution) {
      return res.status(404).json({ success: false, error: "Execution not found" });
    }

    res.json({ success: true, data: execution });
  } catch (error) {
    logger.error(`Error fetching execution detail: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch execution" });
  }
};

/**
 * GET /api/auto-heal-playbooks/:id - Get single playbook
 */
export const getPlaybook = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid playbook ID" });

    const playbook = await prisma.autoHealPlaybook.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 10,
          include: {
            charger: {
              select: { name: true, model: true },
            },
          },
        },
      },
    });

    if (!playbook) {
      return res.status(404).json({ success: false, error: "Playbook not found" });
    }

    res.json({ success: true, data: playbook });
  } catch (error) {
    logger.error(`Error getting playbook: ${error}`);
    res.status(500).json({ success: false, error: "Failed to get playbook" });
  }
};

/**
 * POST /api/auto-heal-playbooks - Create a new playbook
 */
export const createPlaybook = async (req: Request, res: Response) => {
  try {
    const {
      name,
      vendor,
      modelPattern,
      errorCodePattern,
      severity,
      category,
      description,
      priority,
      cooldownMinutes,
      maxRetries,
      steps,
      isActive,
    } = req.body;

    if (!name || !vendor || !errorCodePattern || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, vendor, errorCodePattern, steps (array)",
      });
    }

    const existing = await prisma.autoHealPlaybook.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Playbook with this name already exists",
      });
    }

    const playbook = await prisma.autoHealPlaybook.create({
      data: {
        name,
        vendor,
        modelPattern: modelPattern || null,
        errorCodePattern,
        severity: severity || "HIGH",
        category: category || "Hardware",
        description: description || null,
        priority: priority ? parseInt(String(priority), 10) : 100,
        cooldownMinutes: cooldownMinutes ? parseInt(String(cooldownMinutes), 10) : 15,
        maxRetries: maxRetries ? parseInt(String(maxRetries), 10) : 3,
        steps,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    logger.info(`Created auto-heal playbook: ${playbook.name}`);
    res.status(201).json({ success: true, data: playbook });
  } catch (error) {
    logger.error(`Error creating playbook: ${error}`);
    res.status(500).json({ success: false, error: "Failed to create playbook" });
  }
};

/**
 * PUT /api/auto-heal-playbooks/:id - Update playbook
 */
export const updatePlaybook = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid playbook ID" });

    const {
      name,
      vendor,
      modelPattern,
      errorCodePattern,
      severity,
      category,
      description,
      priority,
      cooldownMinutes,
      maxRetries,
      steps,
      isActive,
    } = req.body;

    const existing = await prisma.autoHealPlaybook.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Playbook not found" });
    }

    if (name && name !== existing.name) {
      const duplicate = await prisma.autoHealPlaybook.findUnique({ where: { name } });
      if (duplicate) {
        return res.status(400).json({ success: false, error: "Playbook with this name already exists" });
      }
    }

    const updated = await prisma.autoHealPlaybook.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(vendor !== undefined && { vendor }),
        ...(modelPattern !== undefined && { modelPattern }),
        ...(errorCodePattern !== undefined && { errorCodePattern }),
        ...(severity !== undefined && { severity }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority: parseInt(String(priority), 10) }),
        ...(cooldownMinutes !== undefined && { cooldownMinutes: parseInt(String(cooldownMinutes), 10) }),
        ...(maxRetries !== undefined && { maxRetries: parseInt(String(maxRetries), 10) }),
        ...(steps !== undefined && { steps }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    logger.info(`Updated auto-heal playbook: ${updated.name}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`Error updating playbook: ${error}`);
    res.status(500).json({ success: false, error: "Failed to update playbook" });
  }
};

/**
 * DELETE /api/auto-heal-playbooks/:id - Delete playbook
 */
export const deletePlaybook = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid playbook ID" });

    const existing = await prisma.autoHealPlaybook.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Playbook not found" });
    }

    await prisma.autoHealPlaybook.delete({ where: { id } });
    logger.info(`Deleted auto-heal playbook: ${existing.name}`);
    res.json({ success: true, message: "Playbook deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting playbook: ${error}`);
    res.status(500).json({ success: false, error: "Failed to delete playbook" });
  }
};

/**
 * POST /api/auto-heal-playbooks/:id/toggle - Toggle active state
 */
export const togglePlaybook = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid playbook ID" });

    const existing = await prisma.autoHealPlaybook.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Playbook not found" });
    }

    const updated = await prisma.autoHealPlaybook.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`Error toggling playbook: ${error}`);
    res.status(500).json({ success: false, error: "Failed to toggle playbook" });
  }
};

/**
 * POST /api/auto-heal-playbooks/:id/execute - Trigger playbook manually on a charger
 */
export const executePlaybook = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { chargerId, connectorId } = req.body;

    if (!id) return res.status(400).json({ success: false, error: "Invalid playbook ID" });
    if (!chargerId) return res.status(400).json({ success: false, error: "Missing chargerId" });

    const parsedChargerId = parseInt(String(chargerId), 10);
    const parsedConnectorId = connectorId ? parseInt(String(connectorId), 10) : 1;

    const result = await AutoHealPlaybookService.executePlaybook(
      id,
      parsedChargerId,
      parsedConnectorId,
      `Manual operator trigger by ${(req as any).user?.email || "Admin"}`
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      message: "Playbook execution started",
      executionId: result.executionId,
    });
  } catch (error) {
    logger.error(`Error triggering playbook: ${error}`);
    res.status(500).json({ success: false, error: "Failed to execute playbook" });
  }
};

/**
 * POST /api/auto-heal-playbooks/ai-analyze - AI-assisted error log analyzer
 */
export const aiAnalyze = async (req: Request, res: Response) => {
  try {
    const { rawLog, errorCode, vendorErrorCode, info, vendor, chargerId } = req.body;

    if (!rawLog && !errorCode && !vendorErrorCode && !info) {
      return res.status(400).json({
        success: false,
        error: "Provide at least one of: rawLog, errorCode, vendorErrorCode, info",
      });
    }

    const analysis = await AutoHealPlaybookService.parseErrorAndRecommendPlaybook({
      rawLog,
      errorCode,
      vendorErrorCode,
      info,
      vendor,
      chargerId: chargerId ? parseInt(String(chargerId), 10) : undefined,
    });

    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error(`Error in AI log analysis: ${error}`);
    res.status(500).json({ success: false, error: "Failed to analyze error log" });
  }
};

/**
 * POST /api/auto-heal-playbooks/seed-defaults - Re-seed default vendor playbooks
 */
export const seedDefaults = async (req: Request, res: Response) => {
  try {
    const count = await AutoHealPlaybookService.seedDefaultPlaybooks();
    res.json({ success: true, message: `Seeded ${count} default playbooks`, count });
  } catch (error) {
    logger.error(`Error seeding default playbooks: ${error}`);
    res.status(500).json({ success: false, error: "Failed to seed default playbooks" });
  }
};

/**
 * GET /api/auto-heal-playbooks/export - Export playbooks as JSON
 */
export const exportPlaybooks = async (req: Request, res: Response) => {
  try {
    const playbooks = await prisma.autoHealPlaybook.findMany({
      select: {
        name: true,
        vendor: true,
        modelPattern: true,
        errorCodePattern: true,
        severity: true,
        category: true,
        description: true,
        priority: true,
        cooldownMinutes: true,
        maxRetries: true,
        steps: true,
        isActive: true,
      },
    });

    res.setHeader("Content-disposition", "attachment; filename=auto-heal-playbooks.json");
    res.setHeader("Content-type", "application/json");
    res.send(JSON.stringify(playbooks, null, 2));
  } catch (error) {
    logger.error(`Error exporting playbooks: ${error}`);
    res.status(500).json({ success: false, error: "Failed to export playbooks" });
  }
};

/**
 * POST /api/auto-heal-playbooks/import - Import playbooks from JSON
 */
export const importPlaybooks = async (req: Request, res: Response) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Expected JSON array of playbooks" });
    }

    let importedCount = 0;
    for (const item of items) {
      if (item.name && item.vendor && item.errorCodePattern && item.steps) {
        await prisma.autoHealPlaybook.upsert({
          where: { name: String(item.name) },
          create: {
            name: String(item.name),
            vendor: String(item.vendor),
            modelPattern: item.modelPattern ? String(item.modelPattern) : null,
            errorCodePattern: String(item.errorCodePattern),
            severity: item.severity ? String(item.severity) : "HIGH",
            category: item.category ? String(item.category) : "Hardware",
            description: item.description ? String(item.description) : null,
            priority: item.priority ? parseInt(String(item.priority), 10) : 100,
            cooldownMinutes: item.cooldownMinutes ? parseInt(String(item.cooldownMinutes), 10) : 15,
            maxRetries: item.maxRetries ? parseInt(String(item.maxRetries), 10) : 3,
            steps: item.steps,
            isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          },
          update: {
            vendor: String(item.vendor),
            modelPattern: item.modelPattern ? String(item.modelPattern) : null,
            errorCodePattern: String(item.errorCodePattern),
            severity: item.severity ? String(item.severity) : "HIGH",
            category: item.category ? String(item.category) : "Hardware",
            description: item.description ? String(item.description) : null,
            steps: item.steps,
          },
        });
        importedCount++;
      }
    }

    res.json({ success: true, message: `Successfully imported ${importedCount} playbooks`, count: importedCount });
  } catch (error) {
    logger.error(`Error importing playbooks: ${error}`);
    res.status(500).json({ success: false, error: "Failed to import playbooks" });
  }
};
