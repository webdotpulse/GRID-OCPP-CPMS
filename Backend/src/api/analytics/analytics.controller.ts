import { Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";

/**
 * High-level analytics summary endpoint
 */
export const getAnalyticsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const [stationCount, chargerCount, activeChargers, totalKwhResult, totalTransactions] = await Promise.all([
      prisma.chargingStation.count(),
      prisma.charger.count(),
      prisma.charger.count({ where: { status: "Available" } }),
      prisma.transaction.aggregate({
        _sum: { energyConsumed: true },
      }),
      prisma.transaction.count(),
    ]);

    const totalEnergyKwh = totalKwhResult._sum.energyConsumed || 0;
    // Calculate uptime ratio safely
    const uptimePercentage = chargerCount > 0 ? Math.round((activeChargers / chargerCount) * 100) : 100;

    return res.json({
      success: true,
      data: {
        totalStations: stationCount,
        totalChargers: chargerCount,
        activeChargers,
        uptimePercentage,
        totalEnergyKwh: Math.round(totalEnergyKwh * 100) / 100,
        totalTransactions,
      },
    });
  } catch (error) {
    logger.error("Error fetching analytics summary:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * Export detailed transactions & revenue analytics as CSV
 */
export const exportAnalyticsCsv = async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      take: 1000,
      orderBy: { createdAt: "desc" },
      include: {
        charger: { select: { name: true, model: true } },
      },
    });

    let csvContent = "Transaction ID,Charger Name,Charger Model,Status,Energy (kWh),Current Power (kW),Start Time,End Time\n";

    transactions.forEach((tx) => {
      const chargerName = (tx.charger?.name || "Unknown").replace(/,/g, " ");
      const chargerModel = (tx.charger?.model || "Unknown").replace(/,/g, " ");
      const energy = (tx.energyConsumed || 0).toFixed(2);
      const power = (tx.currentPower || 0).toFixed(2);
      const startTime = tx.startTime ? tx.startTime.toISOString() : "";
      const endTime = tx.stopTime ? tx.stopTime.toISOString() : "";

      csvContent += `${tx.transactionId},${chargerName},${chargerModel},${tx.status},${energy},${power},${startTime},${endTime}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment(`analytics-export-${Date.now()}.csv`);
    return res.send(csvContent.trim());
  } catch (error) {
    logger.error("Error exporting analytics CSV:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
