import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { TelemetryAnomalyService } from "../services/TelemetryAnomalyService.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/diagnostics
 * Returns overview of hardware at risk, recent diagnostic events, and health scores summary
 */
export const getDiagnostics = async (req: Request, res: Response) => {
  try {
    const hardwareAtRisk = await prisma.charger.findMany({
      where: { isHardwareAtRisk: true },
      select: {
        charger_id: true,
        name: true,
        model: true,
        consecutiveErrors: true,
        last_heartbeat: true,
        status: true,
      },
    });

    const events = await prisma.diagnosticEvent.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
      include: {
        charger: {
          select: {
            name: true,
          },
        },
      },
    });

    const anomalies = await prisma.anomalyEvent.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        charger: {
          select: {
            name: true,
            model: true,
          },
        },
      },
    });

    const healthScores = await prisma.componentHealthScore.findMany({
      orderBy: { healthScore: "asc" },
      take: 30,
      include: {
        charger: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      events,
      hardwareAtRisk,
      anomalies,
      healthScores,
    });
  } catch (error) {
    logger.error(`Error fetching diagnostics: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/diagnostics/anomalies
 * Lists anomaly events with filtering
 */
export const getAnomalyEvents = async (req: Request, res: Response) => {
  try {
    const { chargerId, severity, resolved, limit = "50" } = req.query;

    const where: any = {};
    if (chargerId) where.chargerId = Number(chargerId);
    if (severity) where.severity = String(severity);
    if (resolved !== undefined) where.resolved = resolved === "true";

    const anomalies = await prisma.anomalyEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 50, 100),
      include: {
        charger: {
          select: {
            charger_id: true,
            name: true,
            model: true,
            serial_number: true,
          },
        },
      },
    });

    res.json({ anomalies });
  } catch (error) {
    logger.error(`Error fetching anomaly events: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/diagnostics/health-scores
 * Lists component health scores by charger
 */
export const getComponentHealthScores = async (req: Request, res: Response) => {
  try {
    const { chargerId, status } = req.query;

    const where: any = {};
    if (chargerId) where.chargerId = Number(chargerId);
    if (status) where.status = String(status);

    const healthScores = await prisma.componentHealthScore.findMany({
      where,
      orderBy: [{ healthScore: "asc" }, { updatedAt: "desc" }],
      include: {
        charger: {
          select: {
            charger_id: true,
            name: true,
            model: true,
          },
        },
      },
    });

    // Compute fleet-wide health statistics
    const totalComponents = healthScores.length;
    const criticalCount = healthScores.filter((s) => s.status === "CRITICAL").length;
    const atRiskCount = healthScores.filter((s) => s.status === "AT_RISK").length;
    const degradingCount = healthScores.filter((s) => s.status === "DEGRADING").length;
    const healthyCount = healthScores.filter((s) => s.status === "HEALTHY").length;

    const avgHealthScore = totalComponents > 0
      ? Number((healthScores.reduce((acc, s) => acc + s.healthScore, 0) / totalComponents).toFixed(1))
      : 100.0;

    res.json({
      healthScores,
      stats: {
        totalComponents,
        avgHealthScore,
        criticalCount,
        atRiskCount,
        degradingCount,
        healthyCount,
      },
    });
  } catch (error) {
    logger.error(`Error fetching component health scores: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/diagnostics/telemetry-stream/:chargerId/:connectorId
 * Returns the high-frequency sliding window buffer from Redis
 */
export const getTelemetryStreamWindow = async (req: Request, res: Response) => {
  try {
    const chargerId = Number(req.params.chargerId);
    const connectorId = Number(req.params.connectorId || 1);

    if (isNaN(chargerId)) {
      return res.status(400).json({ error: "Invalid chargerId" });
    }

    const window = await TelemetryAnomalyService.getTelemetryStreamWindow(chargerId, connectorId);
    res.json({
      chargerId,
      connectorId,
      sampleCount: window.length,
      samples: window,
    });
  } catch (error) {
    logger.error(`Error fetching telemetry stream window: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/diagnostics/anomalies/:id/resolve
 * Marks an anomaly event as resolved
 */
export const resolveAnomalyEvent = async (req: Request, res: Response) => {
  try {
    const anomalyId = Number(req.params.id);
    const { notes } = req.body;

    if (isNaN(anomalyId)) {
      return res.status(400).json({ error: "Invalid anomaly ID" });
    }

    const anomaly = await prisma.anomalyEvent.update({
      where: { id: anomalyId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolutionNotes: notes || "Resolved by technician inspection.",
      },
      include: {
        charger: true,
      },
    });

    // Check if there are any remaining unresolved anomalies for this charger
    const remainingUnresolved = await prisma.anomalyEvent.count({
      where: {
        chargerId: anomaly.chargerId,
        resolved: false,
      },
    });

    if (remainingUnresolved === 0 && anomaly.charger.consecutiveErrors === 0) {
      await prisma.charger.update({
        where: { charger_id: anomaly.chargerId },
        data: { isHardwareAtRisk: false },
      });
    }

    res.json({ success: true, anomaly });
  } catch (error) {
    logger.error(`Error resolving anomaly event: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/diagnostics/anomalies/:id/clear-derating
 * Clears safety derating profile on the charger
 */
export const clearAnomalyDerating = async (req: Request, res: Response) => {
  try {
    const anomalyId = Number(req.params.id);

    const anomaly = await prisma.anomalyEvent.findUnique({
      where: { id: anomalyId },
    });

    if (!anomaly) {
      return res.status(404).json({ error: "Anomaly event not found" });
    }

    const cleared = await TelemetryAnomalyService.clearSafetyDerating(
      anomaly.chargerId,
      anomaly.connectorId || 1
    );

    await prisma.anomalyEvent.update({
      where: { id: anomalyId },
      data: { deratingApplied: false },
    });

    res.json({ success: true, cleared });
  } catch (error) {
    logger.error(`Error clearing anomaly derating: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
