import { redisClient } from "../config/redis.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { enqueueMeterValue, MeterValueJobData } from "../queues/queueManager.js";

const LIST_KEY = "meter_values_list";
const PROCESSING_KEY = "meter_values_processing";
const FLUSH_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

export interface MeterValuePayload {
  transactionId: string;
  chargerId: number;
  connectorId?: number;
  energyValue?: number;
  powerValue?: number;
  socValue: number | null;
  currentValue: number | null;
  voltageValue: number | null;
  temperatureValue?: number | null;
  current_L1?: number | null;
  current_L2?: number | null;
  current_L3?: number | null;
  voltage_L1?: number | null;
  voltage_L2?: number | null;
  voltage_L3?: number | null;
  timestamp: Date;
}

export class MeterValueService {
  private static isProcessing = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Pushes a new meter value payload to BullMQ queue and Redis List fallback.
   */
  public static async addMeterValue(payload: MeterValuePayload): Promise<void> {
    try {
      // 1. Enqueue to BullMQ for asynchronous worker consumption
      const jobData: MeterValueJobData = {
        ...payload,
        timestamp: payload.timestamp instanceof Date ? payload.timestamp.toISOString() : payload.timestamp,
      };
      await enqueueMeterValue(jobData);

      // 2. Also keep in Redis list if legacy batch worker is running
      if (this.intervalId) {
        await redisClient.rpush(LIST_KEY, JSON.stringify(payload));
        await redisClient.ltrim(LIST_KEY, -100000, -1);
      }
    } catch (error) {
      logger.error(`Error adding meter value to queue: ${error}`);
    }
  }

  /**
   * Starts the background interval to process meter values in batches (legacy fallback).
   */
  public static async startWorker(): Promise<void> {
    if (this.intervalId) return;

    logger.info("MeterValueService background list worker started.");

    this.intervalId = setInterval(() => {
      this.runWorkerTask().catch((err) => {
        logger.error(`MeterValueService worker task error: ${err}`);
      });
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Stops the background worker.
   */
  public static stopWorker(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public static async processMeterValuesBatch(): Promise<void> {
    return this.runWorkerTask();
  }

  private static async runWorkerTask(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      // Check if there are elements in the list
      const listExists = await redisClient.exists(LIST_KEY);
      if (!listExists) {
        this.isProcessing = false;
        return;
      }

      const { config } = await import("../config/index.js");
      const instanceProcessingKey = `${PROCESSING_KEY}_${config.instanceId}`;

      // Atomically rename the list to a processing key
      try {
        await redisClient.rename(LIST_KEY, instanceProcessingKey);
      } catch (err: any) {
        if (err.message && err.message.includes("no such key")) {
          // List was emptied before rename
          this.isProcessing = false;
          return;
        }
        throw err;
      }

      // Read all elements from the processing list
      const items = await redisClient.lrange(instanceProcessingKey, 0, -1);

      if (!items || items.length === 0) {
        await redisClient.del(instanceProcessingKey);
        this.isProcessing = false;
        return;
      }

      const payloads: MeterValuePayload[] = items.map((item) => JSON.parse(item));

      const diagnosticEvents = payloads
        .filter((p) => p.temperatureValue && p.temperatureValue > 80)
        .map((p) => ({
          chargerId: p.chargerId,
          connectorId: p.connectorId,
          type: "HighTemperature",
          description: `Temperature exceeded threshold: ${p.temperatureValue}°C`
        }));

      if (diagnosticEvents.length > 0) {
        try {
          await prisma.diagnosticEvent.createMany({
            data: diagnosticEvents
          });
        } catch (e) {
          logger.error("Error logging high temperature diagnostic events: " + e);
        }
      }

      let retryCount = 0;
      let dbSuccess = false;

      while (retryCount <= MAX_RETRIES && !dbSuccess) {
        try {
          // Batch insert into MeterValue
          const meterValueData = payloads.map((p) => ({
            transactionId: p.transactionId,
            chargerId: p.chargerId,
            connectorId: p.connectorId,
            energy: p.energyValue ?? null,
            power: p.powerValue ?? null,
            soc: p.socValue,
            current: p.currentValue,
            voltage: p.voltageValue,
            current_L1: p.current_L1 ?? null,
            current_L2: p.current_L2 ?? null,
            current_L3: p.current_L3 ?? null,
            voltage_L1: p.voltage_L1 ?? null,
            voltage_L2: p.voltage_L2 ?? null,
            voltage_L3: p.voltage_L3 ?? null,
            timestamp: new Date(p.timestamp),
          }));

          await prisma.meterValue.createMany({
            data: meterValueData,
            skipDuplicates: true,
          });

          // Group by transactionId to merge the values, keeping the most recent non-null/non-zero values
          const latestValuesByTx = new Map<string, MeterValuePayload>();
          for (const p of payloads) {
            if (latestValuesByTx.has(p.transactionId)) {
              const existing = latestValuesByTx.get(p.transactionId)!;
              latestValuesByTx.set(p.transactionId, {
                ...existing,
                ...p,
                // Ensure partial metrics are not lost if a subsequent payload omits them
                energyValue: p.energyValue !== undefined && p.energyValue !== null ? p.energyValue : existing.energyValue,
                powerValue: p.powerValue !== undefined && p.powerValue !== null ? p.powerValue : existing.powerValue,
                socValue: p.socValue !== null ? p.socValue : existing.socValue,
                currentValue: p.currentValue !== null ? p.currentValue : existing.currentValue,
                voltageValue: p.voltageValue !== null ? p.voltageValue : existing.voltageValue,
                current_L1: p.current_L1 !== null && p.current_L1 !== undefined ? p.current_L1 : existing.current_L1,
                current_L2: p.current_L2 !== null && p.current_L2 !== undefined ? p.current_L2 : existing.current_L2,
                current_L3: p.current_L3 !== null && p.current_L3 !== undefined ? p.current_L3 : existing.current_L3,
                voltage_L1: p.voltage_L1 !== null && p.voltage_L1 !== undefined ? p.voltage_L1 : existing.voltage_L1,
                voltage_L2: p.voltage_L2 !== null && p.voltage_L2 !== undefined ? p.voltage_L2 : existing.voltage_L2,
                voltage_L3: p.voltage_L3 !== null && p.voltage_L3 !== undefined ? p.voltage_L3 : existing.voltage_L3,
                timestamp: new Date(Math.max(new Date(existing.timestamp).getTime(), new Date(p.timestamp).getTime())),
              });
            } else {
              latestValuesByTx.set(p.transactionId, p);
            }
          }

          // Update Transactions and RfidSessions
          for (const [transactionId, latest] of latestValuesByTx.entries()) {
            let sessionEnergy: number | undefined = undefined;
            if (latest.energyValue !== undefined) {
              const tx = await prisma.transaction.findFirst({
                where: { transactionId },
                select: { initialMeterValue: true }
              });
              sessionEnergy = Math.max(0, latest.energyValue - (tx?.initialMeterValue || 0));
            }

            const txUpdateData = {
              ...(sessionEnergy !== undefined && { energyConsumed: sessionEnergy }),
              ...(latest.powerValue !== undefined && { currentPower: latest.powerValue }),
              ...(latest.socValue !== null && { soc: latest.socValue }),
              ...(latest.currentValue !== null && { current: latest.currentValue }),
              ...(latest.voltageValue !== null && { voltage: latest.voltageValue }),
              status: "charging",
            };

            await prisma.transaction.updateMany({
              where: { transactionId, status: { not: "completed" } },
              data: txUpdateData,
            });

            await prisma.rfidSession.updateMany({
              where: { transactionId, status: { not: "completed" } },
              data: txUpdateData,
            });
          }

          dbSuccess = true;
        } catch (dbError) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            logger.warn(`Database insertion failed for meter values, retrying (${retryCount}/${MAX_RETRIES})... Error: ${dbError}`);
            await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // Exponential-ish backoff
          } else {
            logger.error(`Database insertion failed for meter values after ${MAX_RETRIES} retries. Re-queuing failed items.`);
            // Re-queue the items back to the main list
            if (payloads.length > 0) {
              const rawPayloads = payloads.map((p) => JSON.stringify(p));
              await redisClient.lpush(LIST_KEY, ...rawPayloads);
            }
          }
        }
      }

      // Cleanup processing key
      await redisClient.del(instanceProcessingKey);

      if (dbSuccess) {
        logger.debug(`MeterValueService processed ${payloads.length} entries from the list.`);
      }

    } catch (error) {
      logger.error(`Error processing meter values list: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
