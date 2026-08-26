<<<<<<< HEAD
import { Queue, JobsOptions } from "bullmq";
=======
import { Queue, QueueOptions, JobsOptions } from "bullmq";
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const isTestEnv = process.env.NODE_ENV === "test";

<<<<<<< HEAD
=======
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

const defaultJobOptions: JobsOptions = {
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

>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
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
<<<<<<< HEAD
  timestamp?: string | Date;
  vendorId?: string;
=======
  vendorId?: string;
  vendorErrorCode?: string;
  timestamp: string | Date;
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
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

<<<<<<< HEAD
export const QUEUE_NAMES = {
  METER_VALUES: "meter-values-queue",
  STATUS_EVENTS: "status-events-queue",
  BILLING: "billing-queue",
} as const;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,
  },
};

export function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: isTestEnv,
    enableOfflineQueue: !isTestEnv,
    retryStrategy(times) {
      if (isTestEnv) return null;
      return Math.min(times * 50, 2000);
    },
  });
}

// Instantiate queues
const queueConnection = createRedisConnection();

export const meterValuesQueue = new Queue<MeterValueJobData>(
  QUEUE_NAMES.METER_VALUES,
  {
    connection: queueConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

export const statusEventsQueue = new Queue<StatusEventJobData>(
  QUEUE_NAMES.STATUS_EVENTS,
  {
    connection: queueConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

export const billingQueue = new Queue<BillingJobData>(
  QUEUE_NAMES.BILLING,
  {
    connection: queueConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

meterValuesQueue.on("error", (err) => {
  logger.error(`meterValuesQueue error: ${err}`);
});

statusEventsQueue.on("error", (err) => {
  logger.error(`statusEventsQueue error: ${err}`);
});

billingQueue.on("error", (err) => {
  logger.error(`billingQueue error: ${err}`);
});

/**
 * Enqueue a meter value telemetry payload for asynchronous database ingestion.
 */
export async function enqueueMeterValue(
  data: MeterValueJobData,
  opts?: JobsOptions
): Promise<string | undefined> {
  try {
    const job = await meterValuesQueue.add("ingest-meter-value", data, {
      ...DEFAULT_JOB_OPTIONS,
      ...opts,
    });
    return job.id;
  } catch (error) {
    logger.error(`Failed to enqueue meter value: ${error}`);
    return undefined;
=======
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
  data: MeterValueJobData | MeterValueJobData[]
): Promise<void> {
  try {
    if (Array.isArray(data)) {
      if (data.length === 0) return;
      const jobs = data.map((item) => ({
        name: "meter-value-batch",
        data: item,
        opts: defaultJobOptions,
      }));
      await meterValuesQueue.addBulk(jobs);
    } else {
      await meterValuesQueue.add("meter-value", data, defaultJobOptions);
    }
  } catch (error) {
    logger.error(`Failed to enqueue meter value to BullMQ: ${error}`);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  }
}

/**
<<<<<<< HEAD
 * Enqueue a charger status notification event.
 */
export async function enqueueStatusEvent(
  data: StatusEventJobData,
  opts?: JobsOptions
): Promise<string | undefined> {
  try {
    const job = await statusEventsQueue.add("process-status-event", data, {
      ...DEFAULT_JOB_OPTIONS,
      ...opts,
    });
    return job.id;
  } catch (error) {
    logger.error(`Failed to enqueue status event: ${error}`);
    return undefined;
=======
 * Enqueue a status notification or connector event to BullMQ
 */
export async function enqueueStatusEvent(data: StatusEventJobData): Promise<void> {
  try {
    await statusEventsQueue.add("status-event", data, defaultJobOptions);
  } catch (error) {
    logger.error(`Failed to enqueue status event to BullMQ: ${error}`);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  }
}

/**
<<<<<<< HEAD
 * Enqueue a transaction completion & billing event.
 */
export async function enqueueBillingEvent(
  data: BillingJobData,
  opts?: JobsOptions
): Promise<string | undefined> {
  try {
    const job = await billingQueue.add("process-billing-event", data, {
      ...DEFAULT_JOB_OPTIONS,
      ...opts,
    });
    return job.id;
  } catch (error) {
    logger.error(`Failed to enqueue billing event: ${error}`);
    return undefined;
=======
 * Enqueue a transaction finalization and billing calculation job to BullMQ
 */
export async function enqueueBillingJob(data: BillingJobData): Promise<void> {
  try {
    await billingQueue.add("billing-job", data, defaultJobOptions);
  } catch (error) {
    logger.error(`Failed to enqueue billing job to BullMQ: ${error}`);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  }
}

/**
<<<<<<< HEAD
 * Gracefully close all BullMQ queues.
=======
 * Gracefully close all BullMQ queue connections
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
 */
export async function closeQueues(): Promise<void> {
  try {
    await Promise.all([
      meterValuesQueue.close(),
      statusEventsQueue.close(),
      billingQueue.close(),
    ]);
<<<<<<< HEAD
    await queueConnection.quit();
    logger.info("All BullMQ queues closed successfully.");
=======
    await queueConnection.quit().catch(() => {});
    logger.info("BullMQ queues closed successfully.");
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  } catch (error) {
    logger.error(`Error closing BullMQ queues: ${error}`);
  }
}
