import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import axios from "axios";
import { redisClient } from "../config/redis.js";
import { setChargingProfile } from "../ocpp/remoteControl.js";
import { V2GOrchestrationService } from "./V2GOrchestrationService.js";

export interface ArbitrageEvaluationResult {
  country: string;
  timestamp: Date;
  marketType: string;
  pricePerMwh: number;
  action: "FLEXIBILITY_CHARGE_BOOST" | "PEAK_SHAVE_CURTAILMENT" | "V2G_DISCHARGE_EXPORT" | "NORMAL_OPERATION";
  reason: string;
  triggeredTransactionsCount: number;
}

export class IntradayImbalanceService {
  public static NEGATIVE_PRICE_THRESHOLD = 0;     // <= 0 EUR/MWh -> Charge Boost
  public static PEAK_PRICE_THRESHOLD = 250;       // >= 250 EUR/MWh -> Peak Curtailment / V2G Discharge

  /**
   * Fetch 15-minute Intraday continuous prices (EnergyZero / ENTSO-E)
   */
  public static async fetchAndStoreIntradayPrices(country: string = "NL") {
    try {
      const now = new Date();
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const endOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0, 0));

      logger.info(`[Intraday] Fetching 15-minute continuous prices for ${country}...`);

      if (country === "NL") {
        // EnergyZero 15-minute interval endpoint
        const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${startOfToday.toISOString()}&tillDate=${endOfTomorrow.toISOString()}&interval=15&usageType=1&inclBtw=false`;
        const response = await axios.get(url, { timeout: 10000 }).catch(() => null);

        if (response?.data && Array.isArray(response.data.Prices)) {
          const ops = [];
          for (const pt of response.data.Prices) {
            const timestamp = new Date(pt.readingDate);
            const pricePerKwh = pt.price;
            if (typeof pricePerKwh !== "number") continue;
            const pricePerMwh = pricePerKwh * 1000;

            ops.push(
              prisma.energyMarketPrice.upsert({
                where: {
                  timestamp_country_marketType_provider: {
                    timestamp,
                    country: "NL",
                    marketType: "INTRADAY_15MIN",
                    provider: "EnergyZero",
                  },
                },
                update: { pricePerMwh },
                create: {
                  timestamp,
                  country: "NL",
                  marketType: "INTRADAY_15MIN",
                  priceType: "settled",
                  pricePerMwh,
                  provider: "EnergyZero",
                },
              })
            );
          }

          const chunkSize = 50;
          for (let i = 0; i < ops.length; i += chunkSize) {
            await prisma.$transaction(ops.slice(i, i + chunkSize));
          }
          logger.info(`[Intraday] Stored ${ops.length} 15-minute intraday prices for NL`);
        }
      }
    } catch (err) {
      logger.error(`[Intraday] Error fetching 15-minute prices: ${err}`);
    }
  }

  /**
   * Ingest Real-Time National Imbalance Settlement Prices (TenneT / Elia / ENTSO-E)
   */
  public static async recordImbalancePrice(params: {
    country: string;
    timestamp: Date;
    pricePerMwh: number;
    priceType?: "settled" | "forecast" | "imbalance_pos" | "imbalance_neg";
    provider?: string;
  }) {
    const { country, timestamp, pricePerMwh, priceType = "settled", provider = "TenneT" } = params;

    const roundedTime = new Date(timestamp);
    roundedTime.setSeconds(0, 0);

    return await prisma.energyMarketPrice.upsert({
      where: {
        timestamp_country_marketType_provider: {
          timestamp: roundedTime,
          country,
          marketType: "IMBALANCE_REALTIME",
          provider,
        },
      },
      update: { pricePerMwh, priceType },
      create: {
        timestamp: roundedTime,
        country,
        marketType: "IMBALANCE_REALTIME",
        priceType,
        pricePerMwh,
        provider,
      },
    });
  }

  /**
   * Query spot / intraday / imbalance price for a given timestamp
   */
  public static async getPriceForTimestamp(
    country: string,
    timestamp: Date,
    marketType: "INTRADAY_15MIN" | "IMBALANCE_REALTIME" | "DAY_AHEAD" = "INTRADAY_15MIN"
  ): Promise<number | null> {
    const targetTime = new Date(timestamp);
    targetTime.setSeconds(0, 0);

    const cacheKey = `market_price:${marketType}:${country}:${targetTime.toISOString()}`;
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return parseFloat(cached);
      } catch {}
    }

    const price = await prisma.energyMarketPrice.findFirst({
      where: {
        country,
        marketType,
        timestamp: { lte: targetTime },
      },
      orderBy: { timestamp: "desc" },
    });

    if (price) {
      if (redisClient) {
        try {
          await redisClient.set(cacheKey, price.pricePerMwh.toString(), "EX", 900); // 15m
        } catch {}
      }
      return price.pricePerMwh;
    }

    return null;
  }

  /**
   * Evaluate arbitrage opportunities across active charging fleet
   */
  public static async evaluateArbitrageOpportunity(
    country: string = "NL",
    targetDate: Date = new Date()
  ): Promise<ArbitrageEvaluationResult> {
    // Check real-time imbalance first, then fallback to 15-min intraday
    let currentPrice = await this.getPriceForTimestamp(country, targetDate, "IMBALANCE_REALTIME");
    let marketType = "IMBALANCE_REALTIME";

    if (currentPrice === null) {
      currentPrice = await this.getPriceForTimestamp(country, targetDate, "INTRADAY_15MIN");
      marketType = "INTRADAY_15MIN";
    }

    const effectivePrice = currentPrice ?? 50.0; // Default fallback to baseline 50 EUR/MWh

    let action: "FLEXIBILITY_CHARGE_BOOST" | "PEAK_SHAVE_CURTAILMENT" | "V2G_DISCHARGE_EXPORT" | "NORMAL_OPERATION" =
      "NORMAL_OPERATION";
    let reason = `Price ${effectivePrice.toFixed(2)} EUR/MWh is within normal operating corridor (${this.NEGATIVE_PRICE_THRESHOLD} to ${this.PEAK_PRICE_THRESHOLD} EUR/MWh).`;
    let count = 0;

    if (effectivePrice <= this.NEGATIVE_PRICE_THRESHOLD) {
      action = "FLEXIBILITY_CHARGE_BOOST";
      reason = `Negative energy/imbalance price (${effectivePrice.toFixed(2)} EUR/MWh). Operator gets paid to consume power! Maximizing charging rates.`;
      count = await this.dispatchChargeBoost();
    } else if (effectivePrice >= this.PEAK_PRICE_THRESHOLD) {
      action = "V2G_DISCHARGE_EXPORT";
      reason = `High energy/imbalance price spike (${effectivePrice.toFixed(2)} EUR/MWh). Triggering peak-shaving and V2G discharge arbitrage.`;
      count = await this.dispatchPeakShaveOrV2G();
    }

    return {
      country,
      timestamp: targetDate,
      marketType,
      pricePerMwh: effectivePrice,
      action,
      reason,
      triggeredTransactionsCount: count,
    };
  }

  /**
   * Maximize charging rate during negative pricing arbitrage
   */
  private static async dispatchChargeBoost(): Promise<number> {
    try {
      const activeTransactions = await prisma.transaction.findMany({
        where: { status: { in: ["initiated", "charging"] } },
        include: { charger: true },
      });

      let count = 0;
      for (const tx of activeTransactions) {
        const maxAmps = tx.charger.power_capacity ? Math.min(32, Math.floor((tx.charger.power_capacity * 1000) / (3 * 230))) : 32;

        await setChargingProfile({
          chargerId: tx.charger_id,
          connectorId: 0,
          csChargingProfiles: {
            chargingProfileId: 104, // 104 = Arbitrage Flexibility Boost Profile
            stackLevel: 2,
            chargingProfilePurpose: "TxDefaultProfile",
            chargingProfileKind: "Absolute",
            chargingSchedule: {
              chargingRateUnit: "A",
              chargingSchedulePeriod: [{ startPeriod: 0, limit: maxAmps, numberPhases: 3 }],
            },
          },
        }).catch(() => {});
        count++;
      }
      return count;
    } catch (err) {
      logger.error(`[Arbitrage] Error in dispatchChargeBoost: ${err}`);
      return 0;
    }
  }

  /**
   * Curtail charging or trigger V2G discharge during peak price spikes
   */
  private static async dispatchPeakShaveOrV2G(): Promise<number> {
    try {
      const activeTransactions = await prisma.transaction.findMany({
        where: { status: { in: ["initiated", "charging"] } },
        include: { charger: true },
      });

      let count = 0;
      for (const tx of activeTransactions) {
        // Try V2G discharge if supported, otherwise curtail to minimum 6A
        if (tx.soc && tx.soc > 50) {
          try {
            await V2GOrchestrationService.triggerV2GDischargeForClient(tx.charger.owner_id, 11.0);
            count++;
            continue;
          } catch {}
        }

        // Curtail to 6A
        await setChargingProfile({
          chargerId: tx.charger_id,
          connectorId: 0,
          csChargingProfiles: {
            chargingProfileId: 104,
            stackLevel: 2,
            chargingProfilePurpose: "TxDefaultProfile",
            chargingProfileKind: "Absolute",
            chargingSchedule: {
              chargingRateUnit: "A",
              chargingSchedulePeriod: [{ startPeriod: 0, limit: 6, numberPhases: 3 }],
            },
          },
        }).catch(() => {});
        count++;
      }
      return count;
    } catch (err) {
      logger.error(`[Arbitrage] Error in dispatchPeakShaveOrV2G: ${err}`);
      return 0;
    }
  }
}
