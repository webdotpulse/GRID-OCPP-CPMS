import { enqueueMeterValue, MeterValueJobData } from "../queues/queueManager.js";
import { processMeterValuesBatch } from "../workers/meterValuesWorker.js";
import { logger } from "../utils/logger.js";
import { enqueueMeterValue, MeterValueJobData } from "../queues/queueManager.js";

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
  /**
<<<<<<< HEAD
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
=======
   * Pushes a new meter value payload to the BullMQ meter-values queue.
   */
  public static async addMeterValue(payload: MeterValuePayload): Promise<void> {
    try {
      await enqueueMeterValue(payload as MeterValueJobData);
    } catch (error) {
      logger.error(`Error adding meter value to BullMQ queue: ${error}`);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
    }
  }

  /**
<<<<<<< HEAD
   * Starts the background interval to process meter values in batches (legacy fallback).
=======
   * Starts the worker (lifecycle managed via workerManager).
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
   */
  public static async startWorker(): Promise<void> {
    logger.info("MeterValueService using BullMQ worker engine.");
  }

  /**
   * Stops the worker.
   */
  public static stopWorker(): void {
    logger.info("MeterValueService worker stopped.");
  }

  /**
   * Batch processor helper for direct/testing invocations.
   */
  public static async processMeterValuesBatch(payloads?: MeterValuePayload[]): Promise<void> {
    if (payloads && payloads.length > 0) {
      await processMeterValuesBatch(payloads as MeterValueJobData[]);
    }
  }
}
