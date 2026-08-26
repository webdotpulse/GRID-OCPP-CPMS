import { Queue, QueueOptions, JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const isTestEnv = process.env.NODE_ENV === "test";

/**
 * Creates an ioredis client instance configured specifically for BullMQ.
 * BullMQ requires maxRetriesPerRequest to be null.
 */
export function getBullMqRedisConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: isTestEnv,
    enableOfflineQueue: !isTestEnv,
    retryStrategy(times: number) {
      if (isTestEnv) return null;
      return Math.min(times * 50, 2000);
    },
  });
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    count: 5000,
    age: 3600, // 1 hour
  },
  removeOnFail: {
    count: 10000,
    age: 86400, // 24 hours
  },
};

export const DEFAULT_JOB_OPTIONS = defaultJobOptions;

export interface MeterValueJobData {
  transactionId: string;
  chargerId: number;
  connectorId?: number;
  energyValue?: number;
  powerValue?: number;
  socValue?: number | null;
  currentValue?: number | null;
  voltageValue?: number | null;
  temperatureValue?: number | null;
  current_L1?: number | null;
  current_L2?: number | null;
  current_L3?: number | null;
  voltage_L1?: number | null;
  voltage_L2?: number | null;
  voltage_L3?: number | null;
  timestamp: string | Date;
}

export interface StatusEventJobData {
  chargerId: number;
  connectorId: number;
  status: string;
  errorCode?: string;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
  timestamp?: string | Date;
}

export interface BillingJobData {
  chargerId: number;
  transactionId: string;
  meterStop: number;
  timestamp: string | Date;
  idTag?: string;
  reason?: string;
  isV2GDischarging?: boolean;
}

export const QUEUE_NAMES = {
  METER_VALUES: "meter-values-queue",
  STATUS_EVENTS: "status-events-queue",
  BILLING: "billing-queue",
} as const;

export function createRedisConnection(): Redis {
  return getBullMqRedisConnection();
}

const queueConnection = getBullMqRedisConnection();
queueConnection.on("error", (err) => {
  if (!isTestEnv) logger.error(`BullMQ queue Redis connection error: ${err.message}`);
});

const commonQueueOptions: QueueOptions = {
  connection: queueConnection,
  defaultJobOptions,
};

// Initialize typed BullMQ queues
export const meterValuesQueue = new Queue<MeterValueJobData>("meter-values-queue", commonQueueOptions);
export const statusEventsQueue = new Queue<StatusEventJobData>("status-events-queue", commonQueueOptions);
export const billingQueue = new Queue<BillingJobData>("billing-queue", commonQueueOptions);

// Log queue errors
meterValuesQueue.on("error", (err) => {
  if (!isTestEnv) logger.error(`meterValuesQueue error: ${err.message}`);
});
statusEventsQueue.on("error", (err) => {
  if (!isTestEnv) logger.error(`statusEventsQueue error: ${err.message}`);
});
billingQueue.on("error", (err) => {
  if (!isTestEnv) logger.error(`billingQueue error: ${err.message}`);
});

/**
 * Enqueue one or more meter value payloads to BullMQ
 */
export async function enqueueMeterValue(
  data: MeterValueJobData | MeterValueJobData[],
  opts?: JobsOptions
): Promise<string | undefined> {
  try {
    if (Array.isArray(data)) {
      if (data.length === 0) return undefined;
      const jobs = data.map((item) => ({
        name: "meter-value-batch",
        data: item,
        opts: opts || defaultJobOptions,
      }));
      await meterValuesQueue.addBulk(jobs);
      return "batch";
    } else {
      const job = await meterValuesQueue.add("meter-value", data, opts || defaultJobOptions);
      return job.id;
    }
  } catch (error) {
    logger.error(`Failed to enqueue meter value to BullMQ: ${error}`);
    return undefined;
  }
}

/**
 * Enqueue a status notification or connector event to BullMQ
 */
export async function enqueueStatusEvent(
  data: StatusEventJobData,
  opts?: JobsOptions
): Promise<string | undefined> {
  try {
    const job = await statusEventsQueue.add("status-event", data, opts || defaultJobOptions);
    return job.id;
  } catch (error) {
    logger.error(`Failed to enqueue status event to BullMQ: ${error}`);
    return undefined;
  }
}

/**
 * Enqueue a transaction finalization and billing calculation job to BullMQ
 */
export async function enqueueBillingJob(
  data: BillingJobData,
  opts?: JobsOptions
): Promise<string | undefined> {
  try {
    const job = await billingQueue.add("billing-job", data, opts || defaultJobOptions);
    return job.id;
  } catch (error) {
    logger.error(`Failed to enqueue billing job to BullMQ: ${error}`);
    return undefined;
  }
}

export const enqueueBillingEvent = enqueueBillingJob;

/**
 * Gracefully close all BullMQ queue connections
 */
export async function closeQueues(): Promise<void> {
  try {
    await Promise.all([
      meterValuesQueue.close(),
      statusEventsQueue.close(),
      billingQueue.close(),
    ]);
    await queueConnection.quit().catch(() => {});
    logger.info("BullMQ queues closed successfully.");
  } catch (error) {
    logger.error(`Error closing BullMQ queues: ${error}`);
  }
}
