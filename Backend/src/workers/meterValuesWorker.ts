import { Worker, Job } from "bullmq";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import {
  MeterValueJobData,
  QUEUE_NAMES,
  createRedisConnection,
} from "../queues/queueManager.js";

let workerInstance: Worker<MeterValueJobData> | null = null;

/**
 * Process a single meter value ingestion job.
 */
export async function processMeterValueJob(
  job: Job<MeterValueJobData>
): Promise<void> {
  const p = job.data;

  try {
    // 1. High temperature alert diagnostics
    if (p.temperatureValue && p.temperatureValue > 80) {
      try {
        await prisma.diagnosticEvent.create({
          data: {
            chargerId: p.chargerId,
            connectorId: p.connectorId,
            type: "HighTemperature",
            description: `Temperature exceeded threshold: ${p.temperatureValue}°C`,
          },
        });
      } catch (diagErr) {
        logger.error(`Error logging high temperature diagnostic event: ${diagErr}`);
      }
    }

    // 2. Insert telemetry record into MeterValue table
    await prisma.meterValue.create({
      data: {
        transactionId: p.transactionId,
        chargerId: p.chargerId,
        connectorId: p.connectorId,
        energy: p.energyValue ?? null,
        power: p.powerValue ?? null,
        soc: p.socValue ?? null,
        current: p.currentValue ?? null,
        voltage: p.voltageValue ?? null,
        current_L1: p.current_L1 ?? null,
        current_L2: p.current_L2 ?? null,
        current_L3: p.current_L3 ?? null,
        voltage_L1: p.voltage_L1 ?? null,
        voltage_L2: p.voltage_L2 ?? null,
        voltage_L3: p.voltage_L3 ?? null,
        timestamp: new Date(p.timestamp),
      },
    });

    // 3. Update active transaction and rfid session metrics
    let sessionEnergy: number | undefined = undefined;
    if (p.energyValue !== undefined && p.energyValue !== null) {
      const tx = await prisma.transaction.findFirst({
        where: { transactionId: p.transactionId },
        select: { initialMeterValue: true },
      });
      sessionEnergy = Math.max(0, p.energyValue - (tx?.initialMeterValue || 0));
    }

    const txUpdateData = {
      ...(sessionEnergy !== undefined && { energyConsumed: sessionEnergy }),
      ...(p.powerValue !== undefined && p.powerValue !== null && { currentPower: p.powerValue }),
      ...(p.socValue !== null && p.socValue !== undefined && { soc: p.socValue }),
      ...(p.currentValue !== null && p.currentValue !== undefined && { current: p.currentValue }),
      ...(p.voltageValue !== null && p.voltageValue !== undefined && { voltage: p.voltageValue }),
      status: "charging",
    };

    await prisma.transaction.updateMany({
      where: { transactionId: p.transactionId, status: { not: "completed" } },
      data: txUpdateData,
    });

    await prisma.rfidSession.updateMany({
      where: { transactionId: p.transactionId, status: { not: "completed" } },
      data: txUpdateData,
    });

    logger.debug(`[meterValuesWorker] Processed meter value for tx ${p.transactionId}`);
  } catch (error) {
    logger.error(`[meterValuesWorker] Job ${job.id} failed: ${error}`);
    throw error; // Re-throw to trigger BullMQ exponential backoff retry
  }
}

/**
 * Start the BullMQ meter values worker.
 */
export function startMeterValuesWorker(): Worker<MeterValueJobData> {
  if (workerInstance) return workerInstance;

  const connection = createRedisConnection();

  workerInstance = new Worker<MeterValueJobData>(
    QUEUE_NAMES.METER_VALUES,
    processMeterValueJob,
    {
      connection,
      concurrency: 50,
      limiter: {
        max: 500,
        duration: 1000,
      },
    }
  );

  workerInstance.on("completed", (job) => {
    logger.debug(`[meterValuesWorker] Job ${job.id} completed successfully`);
  });

  workerInstance.on("failed", (job, err) => {
    logger.warn(`[meterValuesWorker] Job ${job?.id} failed on attempt ${job?.attemptsMade}: ${err.message}`);
  });

  workerInstance.on("error", (err) => {
    logger.error(`[meterValuesWorker] Worker error: ${err}`);
  });

  logger.info("BullMQ meterValuesWorker started (concurrency: 50).");
  return workerInstance;
}

/**
 * Stop the BullMQ meter values worker.
 */
export async function stopMeterValuesWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    logger.info("BullMQ meterValuesWorker stopped.");
  }
}
