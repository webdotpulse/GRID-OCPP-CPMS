import { Queue, JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const isTestEnv = process.env.NODE_ENV === "test";

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
  timestamp?: string | Date;
  vendorId?: string;
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
  }
}

/**
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
  }
}

/**
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
  }
}

/**
 * Gracefully close all BullMQ queues.
 */
export async function closeQueues(): Promise<void> {
  try {
    await Promise.all([
      meterValuesQueue.close(),
      statusEventsQueue.close(),
      billingQueue.close(),
    ]);
    await queueConnection.quit();
    logger.info("All BullMQ queues closed successfully.");
  } catch (error) {
    logger.error(`Error closing BullMQ queues: ${error}`);
  }
}
