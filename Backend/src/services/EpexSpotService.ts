import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import axios from "axios";
import { redisClient } from "../config/redis.js";
import { XMLParser } from "fast-xml-parser";
import { EnergyChartsService } from "./EnergyChartsService.js";

export class EpexSpotService {
  private static workerIntervalId: NodeJS.Timeout | null = null;

  public static async fetchAndStoreDayAheadPrices() {
    try {
      // Trigger Energy-Charts sync in parallel
      EnergyChartsService.fetchAndStoreDayAheadPrices().catch(err => {
        logger.error(`Error triggering EnergyChartsService from EpexWorker: ${err}`);
      });

      const now = new Date();
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

      const countTodayNL = await prisma.epexSpotPrice.count({
        where: { timestamp: { gte: startOfToday }, country: "NL", provider: "EnergyZero" }
      });
      const countTodayBE = await prisma.epexSpotPrice.count({
        where: { timestamp: { gte: startOfToday }, country: "BE", provider: "EnergyZero" }
      });

      const cetHour = (now.getUTCHours() + 1) % 24;
      const isPastPublishTime = cetHour >= 14 || (cetHour === 13 && now.getUTCMinutes() >= 30);

      const tomorrowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 0, 0, 0));

      const countTomorrowNL = await prisma.epexSpotPrice.count({
        where: { timestamp: tomorrowEnd, country: "NL", provider: "EnergyZero" }
      });
      const countTomorrowBE = await prisma.epexSpotPrice.count({
        where: { timestamp: tomorrowEnd, country: "BE", provider: "EnergyZero" }
      });

      const needsFetchNL = countTodayNL === 0 || (isPastPublishTime && countTomorrowNL === 0);
      const needsFetchBE = countTodayBE === 0 || (isPastPublishTime && countTomorrowBE === 0);

      if (!needsFetchNL && !needsFetchBE) {
        return;
      }

      const endOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0, 0));
      endOfTomorrow.setUTCMilliseconds(-1);
      const chunkSize = 50;

      // 1. Fetch NL prices via EnergyZero
      if (needsFetchNL) {
        try {
          logger.info("Fetching day-ahead EPEX spot prices for NL from EnergyZero...");
          const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${startOfToday.toISOString()}&tillDate=${endOfTomorrow.toISOString()}&interval=4&usageType=1&inclBtw=false`;

          let response;
          let retries = 3;
          while (retries > 0) {
            try {
              response = await axios.get(url, { timeout: 10000 });
              break;
            } catch (err) {
              retries--;
              if (retries === 0) throw err;
              await new Promise(resolve => setTimeout(resolve, 2000 * (3 - retries)));
            }
          }
          const data = response?.data;

          if (data && Array.isArray(data.Prices)) {
            const nlOperations = [];
            for (const pricePoint of data.Prices) {
              const timestamp = new Date(pricePoint.readingDate);
              timestamp.setUTCMinutes(0, 0, 0);
              const pricePerKwh = pricePoint.price;
              if (typeof pricePerKwh !== 'number') continue;
              const pricePerMwh = pricePerKwh * 1000;

              nlOperations.push(
                prisma.epexSpotPrice.upsert({
                  where: { timestamp_country_provider: { timestamp, country: "NL", provider: "EnergyZero" } },
                  update: { pricePerMwh },
                  create: { timestamp, country: "NL", pricePerMwh, provider: "EnergyZero" },
                })
              );
            }

            for (let i = 0; i < nlOperations.length; i += chunkSize) {
              await prisma.$transaction(nlOperations.slice(i, i + chunkSize));
            }
            logger.info(`Successfully fetched and stored ${nlOperations.length} day-ahead EPEX spot prices for NL.`);
          }
        } catch (nlError) {
          logger.error(`Error fetching/processing EPEX prices for NL: ${nlError}`);
        }
      }

      // 2. Fetch BE prices
      // We check if ENTSOE key exists. If yes, we can use it. If not, fallback to energy-charts.
      let entsoeKey = null;
      try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: "ENTSOE_API_KEY" } });
        if (setting && setting.value) {
          entsoeKey = setting.value;
        }
      } catch (e) {
        logger.error("Error reading ENTSOE API key from DB: " + e);
      }
      if (needsFetchBE) {

        let entsoeSuccess = false;
        try {
          if (entsoeKey) {
            logger.info("Fetching day-ahead EPEX spot prices for BE from ENTSO-E...");

            const formatEntsoeDate = (d: Date) => {
               return d.toISOString().replace(/[:-]/g, '').substring(0, 12) + '00';
            };

            const periodStart = formatEntsoeDate(startOfToday);
            const periodEnd = formatEntsoeDate(endOfTomorrow);

            // BZN for Belgium is 10YBE----------2
            const entsoeUrl = `https://web-api.tp.entsoe.eu/api?securityToken=${entsoeKey}&documentType=A44&in_Domain=10YBE----------2&out_Domain=10YBE----------2&periodStart=${periodStart}&periodEnd=${periodEnd}`;

            const entsoeResponse = await axios.get(entsoeUrl, { timeout: 15000 });

            if (entsoeResponse.data) {
               const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
               const parsed = parser.parse(entsoeResponse.data);

               const timeseries = parsed.Publication_MarketDocument?.TimeSeries;
               if (timeseries) {
                  const beOperations = [];
                  const seriesList = Array.isArray(timeseries) ? timeseries : [timeseries];

                  for (const series of seriesList) {
                     const period = series.Period;
                     if (!period) continue;
                     const startPeriod = new Date(period.timeInterval.start);

                     const points = Array.isArray(period.Point) ? period.Point : [period.Point];
                     for (const pt of points) {
                        const position = parseInt(pt.position, 10);
                        const pricePerMwh = parseFloat(pt["price.amount"]);

                        // ENTSO-E positions are 1-based offset from period start
                        const timestamp = new Date(startPeriod.getTime() + (position - 1) * 3600 * 1000);
                        timestamp.setUTCMinutes(0, 0, 0);

                        if (timestamp >= startOfToday && timestamp <= endOfTomorrow) {
                           beOperations.push(
                             prisma.epexSpotPrice.upsert({
                               where: { timestamp_country_provider: { timestamp, country: "BE", provider: "ENTSO-E" } },
                               update: { pricePerMwh },
                               create: { timestamp, country: "BE", pricePerMwh, provider: "ENTSO-E" },
                             })
                           );
                        }
                     }
                  }
                  for (let i = 0; i < beOperations.length; i += chunkSize) {
                    await prisma.$transaction(beOperations.slice(i, i + chunkSize));
                  }
                  logger.info(`Successfully fetched and stored ${beOperations.length} day-ahead EPEX spot prices for BE from ENTSO-E.`);
                  entsoeSuccess = true;
               }
            }
          }

          if (!entsoeSuccess) {
            logger.info("Fetching day-ahead EPEX spot prices for BE from energy-charts...");
            const beUrl = `https://api.energy-charts.info/price?bzn=BE&start=${startOfToday.toISOString()}&end=${endOfTomorrow.toISOString()}`;

            let beResponse;
            let beRetries = 3;
            while (beRetries > 0) {
              try {
                beResponse = await axios.get(beUrl, { timeout: 10000 });
                break;
              } catch (err) {
                beRetries--;
                if (beRetries === 0) throw err;
                await new Promise(resolve => setTimeout(resolve, 2000 * (3 - beRetries)));
              }
            }
            const beData = beResponse?.data;

            if (beData && Array.isArray(beData.unix_seconds) && Array.isArray(beData.price) && beData.unix_seconds.length === beData.price.length) {
              const beOperations = [];
              for (let i = 0; i < beData.unix_seconds.length; i++) {
                const timestamp = new Date(beData.unix_seconds[i] * 1000);
                timestamp.setUTCMinutes(0, 0, 0);
                const pricePerMwh = beData.price[i];

                if (typeof pricePerMwh !== 'number') continue;

                // Only insert if it's within our target range
                if (timestamp >= startOfToday && timestamp <= endOfTomorrow) {
                  beOperations.push(
                    prisma.epexSpotPrice.upsert({
                      where: { timestamp_country_provider: { timestamp, country: "BE", provider: "Energy-Charts" } },
                      update: { pricePerMwh },
                      create: { timestamp, country: "BE", pricePerMwh, provider: "Energy-Charts" },
                    })
                  );
                }
              }

              for (let i = 0; i < beOperations.length; i += chunkSize) {
                await prisma.$transaction(beOperations.slice(i, i + chunkSize));
              }
              logger.info(`Successfully processed ${beOperations.length} prices for BE.`);
            }
          }
        } catch (beError) {
          logger.error(`Error fetching/processing EPEX prices for BE: ${beError}`);
        }
      }

    } catch (error) {
      logger.error(`Error in EPEX spot price fetch worker: ${error}`);
    }
  }

  public static startEpexWorker() {
    this.fetchAndStoreDayAheadPrices();

    // Schedule to run every 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    this.workerIntervalId = setInterval(() => {
      this.fetchAndStoreDayAheadPrices();
    }, fiveMinutes);

    logger.info("Started EPEX Spot Service worker");
  }

  public static async getPriceForTimestamp(country: string, timestamp: Date, provider: string = "EnergyZero"): Promise<number | null> {
    try {
      const targetTime = new Date(timestamp);
      targetTime.setUTCMinutes(0, 0, 0);

      const cacheKey = `epex_price:${provider}:${country}:${targetTime.toISOString()}`;
      const cachedPrice = await redisClient.get(cacheKey);

      if (cachedPrice) {
        return parseFloat(cachedPrice);
      }

      const priceRecord = await prisma.epexSpotPrice.findUnique({
        where: {
          timestamp_country_provider: {
            timestamp: targetTime,
            country,
            provider,
          },
        },
      });

      if (priceRecord) {
        try {
          await redisClient.set(cacheKey, priceRecord.pricePerMwh.toString(), "EX", 86400); // 24h
        } catch (cacheErr) {
          logger.warn(`Could not cache EPEX price: ${cacheErr}`);
        }
        return priceRecord.pricePerMwh;
      }

      // Fallback: get the most recent price for the country and provider if the exact hour isn't found
      const latestPrice = await prisma.epexSpotPrice.findFirst({
        where: { country, provider },
        orderBy: { timestamp: "desc" },
      });

      if (latestPrice) {
        logger.warn(`Exact EPEX price not found for ${provider} ${country} at ${targetTime.toISOString()}. Using latest available price.`);
        try {
          await redisClient.set(cacheKey, latestPrice.pricePerMwh.toString(), "EX", 3600); // 1h
        } catch (cacheErr) {
          logger.warn(`Could not cache EPEX fallback price: ${cacheErr}`);
        }
        return latestPrice.pricePerMwh;
      }

      return null;
    } catch (error) {
      logger.error(`Error getting EPEX price for timestamp: ${error}`);
      return null;
    }
  }
}
