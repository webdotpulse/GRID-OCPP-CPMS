import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { IntradayImbalanceService } from "../../services/IntradayImbalanceService.js";

/**
 * GET /api/tariffs/market-prices - Query Intraday, Imbalance, and Day-Ahead prices
 */
export const getMarketPrices = async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string) || "NL";
    const marketType = (req.query.marketType as string) || "INTRADAY_15MIN";
    const limit = Math.min(100, parseInt(req.query.limit as string) || 48);

    const prices = await prisma.energyMarketPrice.findMany({
      where: {
        country,
        ...(marketType !== "ALL" && { marketType }),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    res.json({
      success: true,
      data: prices.reverse(),
    });
  } catch (error) {
    logger.error(`Error fetching market prices: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch market prices" });
  }
};

/**
 * POST /api/tariffs/arbitrage-dispatch - Trigger arbitrage evaluation and flexibility dispatch
 */
export const triggerArbitrageDispatch = async (req: Request, res: Response) => {
  try {
    const country = (req.body.country as string) || "NL";
    const result = await IntradayImbalanceService.evaluateArbitrageOpportunity(country);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Error triggering arbitrage dispatch: ${error}`);
    res.status(500).json({ success: false, error: "Failed to dispatch arbitrage optimization" });
  }
};

/**
 * POST /api/tariffs/imbalance-ingest - Ingest national TSO/DSO imbalance price point
 */
export const ingestImbalancePrice = async (req: Request, res: Response) => {
  try {
    const { country, timestamp, pricePerMwh, priceType, provider } = req.body;

    if (!country || !pricePerMwh || !timestamp) {
      return res.status(400).json({ success: false, error: "country, timestamp, and pricePerMwh are required" });
    }

    const recorded = await IntradayImbalanceService.recordImbalancePrice({
      country,
      timestamp: new Date(timestamp),
      pricePerMwh: Number(pricePerMwh),
      priceType,
      provider,
    });

    res.status(201).json({ success: true, data: recorded });
  } catch (error) {
    logger.error(`Error ingesting imbalance price: ${error}`);
    res.status(500).json({ success: false, error: "Failed to record imbalance price" });
  }
};
