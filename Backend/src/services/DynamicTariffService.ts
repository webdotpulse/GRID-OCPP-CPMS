import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { EpexSpotService } from "./EpexSpotService.js";

export interface TariffConfig {
  charge?: number | null;
  electricity_rate?: number | null;
  tariffType: string;
  country?: string | null;
  dynamicProvider?: string | null;
  markupPerKwh?: number | null;
  taxPercentage?: number | null;
  time_fee?: number | null;
  idle_fee?: number | null;
}

export interface SessionCostParams {
  transactionId: string;
  initialMeterValue: number;
  meterStop: number;
  startTime: Date;
  endTime: Date;
  tariff: TariffConfig | null;
}

export interface SessionCostResult {
  connectionFee: number; // in cents
  timeFee: number;       // in cents
  idleFee: number;       // in cents
  energyFee: number;     // in cents
  totalCost: number;     // in cents
  totalKwh: number;
}

export class DynamicTariffService {
  /**
   * Calculates accurate session cost considering time fee, idle fee, connection fee,
   * and either fixed or dynamic EPEX interval spot pricing.
   */
  public static async calculateSessionCost(params: SessionCostParams): Promise<SessionCostResult> {
    const { transactionId, initialMeterValue, meterStop, startTime, endTime, tariff } = params;

    const startTimeMs = startTime.getTime();
    const endTimeMs = endTime.getTime();
    const totalDurationMinutes = Math.max(0, (endTimeMs - startTimeMs) / (1000 * 60));

    // Calculate idle duration based on last positive power reading
    let idleDurationMinutes = 0;
    try {
      const lastActiveMeterValue = await prisma.meterValue.findFirst({
        where: { transactionId: String(transactionId), power: { gt: 0 } },
        orderBy: { timestamp: "desc" },
      });

      if (lastActiveMeterValue) {
        idleDurationMinutes = Math.max(0, (endTimeMs - lastActiveMeterValue.timestamp.getTime()) / (1000 * 60));
      }
    } catch (err) {
      logger.warn(`Could not check idle power for tx ${transactionId}: ${err}`);
    }

    const connectionFee = (tariff?.charge || 0) * 100; // in cents
    const timeFee = (tariff?.time_fee || 0) * totalDurationMinutes * 100; // in cents
    const idleFee = (tariff?.idle_fee || 0) * idleDurationMinutes * 100; // in cents

    const netEnergyWh = Math.max(0, meterStop - (initialMeterValue || 0));
    const totalKwh = netEnergyWh / 1000;

    let energyFee = 0;

    const isDynamic = tariff?.tariffType === "DYNAMIC_EPEX" || tariff?.tariffType === "INTRADAY_15MIN" || tariff?.tariffType === "IMBALANCE_ARBITRAGE";

    if (isDynamic && tariff?.country) {
      const markup = tariff.markupPerKwh || 0;
      const taxRate = tariff.taxPercentage ? tariff.taxPercentage / 100 : 0;
      const provider = tariff.dynamicProvider || "EnergyZero";
      const marketType = tariff.tariffType === "IMBALANCE_ARBITRAGE"
        ? "IMBALANCE_REALTIME"
        : (tariff.tariffType === "INTRADAY_15MIN" ? "INTRADAY_15MIN" : "DAY_AHEAD");

      const { IntradayImbalanceService } = await import("./IntradayImbalanceService.js");

      const fetchPrice = async (ts: Date) => {
        if (marketType === "IMBALANCE_REALTIME" || marketType === "INTRADAY_15MIN") {
          const mktPrice = await IntradayImbalanceService.getPriceForTimestamp(tariff.country!, ts, marketType as any);
          if (mktPrice !== null) return mktPrice;
        }
        return await EpexSpotService.getPriceForTimestamp(tariff.country!, ts, provider);
      };

      // 1. Check if intermediate meter values exist
      let meterValues: Array<{ energy: number | null; timestamp: Date }> = [];
      try {
        meterValues = await prisma.meterValue.findMany({
          where: { transactionId: String(transactionId), energy: { not: null } },
          orderBy: { timestamp: "asc" },
          select: { energy: true, timestamp: true },
        });
      } catch (err) {
        logger.warn(`Could not fetch meter values for tx ${transactionId}: ${err}`);
      }

      if (meterValues.length > 0) {
        let previousEnergy = initialMeterValue || meterValues[0].energy || 0;

        for (const mv of meterValues) {
          const currentEnergy = mv.energy || 0;
          const energyDeltaKwh = Math.max(0, currentEnergy - previousEnergy) / 1000;

          if (energyDeltaKwh > 0) {
            const spotPriceMwh = await fetchPrice(mv.timestamp);
            const spotPriceKwh = spotPriceMwh ? spotPriceMwh / 1000 : 0;
            const hourlyCostKwh = (spotPriceKwh + markup) * (1 + taxRate);
            energyFee += energyDeltaKwh * hourlyCostKwh * 100;
          }
          previousEnergy = currentEnergy;
        }

        const finalDeltaKwh = Math.max(0, meterStop - previousEnergy) / 1000;
        if (finalDeltaKwh > 0) {
          const spotPriceMwh = await fetchPrice(endTime);
          const spotPriceKwh = spotPriceMwh ? spotPriceMwh / 1000 : 0;
          const hourlyCostKwh = (spotPriceKwh + markup) * (1 + taxRate);
          energyFee += finalDeltaKwh * hourlyCostKwh * 100;
        }
      } else {
        // 2. If no intermediate meter values, slice duration into 15-minute or hourly slices
        const sliceDurationMs = (marketType === "INTRADAY_15MIN" || marketType === "IMBALANCE_REALTIME") ? 15 * 60 * 1000 : 60 * 60 * 1000;
        const totalDurationMs = Math.max(1, endTimeMs - startTimeMs);
        let chunkStart = new Date(startTime);

        while (chunkStart.getTime() < endTimeMs) {
          const chunkEndMs = Math.min(endTimeMs, chunkStart.getTime() + sliceDurationMs);
          const chunkDurationMs = chunkEndMs - chunkStart.getTime();

          const chunkFraction = chunkDurationMs / totalDurationMs;
          const chunkKwh = totalKwh * chunkFraction;

          if (chunkKwh > 0) {
            const spotPriceMwh = await fetchPrice(chunkStart);
            const spotPriceKwh = spotPriceMwh ? spotPriceMwh / 1000 : 0;
            const hourlyCostKwh = (spotPriceKwh + markup) * (1 + taxRate);
            energyFee += chunkKwh * hourlyCostKwh * 100;
          }

          chunkStart = new Date(chunkEndMs);
          if (chunkStart.getTime() === chunkEndMs && chunkEndMs === endTimeMs) {
            break;
          }
        }
      }
    } else {
      const tariffRate = tariff?.electricity_rate || tariff?.charge || 0;
      energyFee = totalKwh * tariffRate * 100;
    }

    const totalCost = Math.round(connectionFee + timeFee + idleFee + energyFee);

    return {
      connectionFee: Math.round(connectionFee),
      timeFee: Math.round(timeFee),
      idleFee: Math.round(idleFee),
      energyFee: Math.round(energyFee),
      totalCost,
      totalKwh: Math.round(totalKwh * 100) / 100,
    };
  }
}
