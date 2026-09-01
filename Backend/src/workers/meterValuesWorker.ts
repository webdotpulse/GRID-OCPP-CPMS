import { Worker, Job } from "bullmq";
import { getBullMqRedisConnection, MeterValueJobData } from "../queues/queueManager.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { TelemetryAnomalyService } from "../services/TelemetryAnomalyService.js";

export const METER_VALUES_QUEUE_NAME = "meter-values-queue";

/**
 * Process a single meter value job from BullMQ
 */
export async function processMeterValueJob(job: Job<MeterValueJobData>): Promise<void> {
  const p = job.data;
  if (!p || !p.transactionId) return;

  // Real-Time High-Frequency Anomaly Analysis & Closed-Loop Derating
  try {
    await TelemetryAnomalyService.analyzeTelemetry(p);
  } catch (err) {
    logger.error(`Error in TelemetryAnomalyService.analyzeTelemetry: ${err}`);
  }

  // Diagnostic event for high temperature
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
    } catch (e) {
      logger.error(`Error logging high temperature diagnostic event: ${e}`);
    }
  }

  // Insert telemetry record
  await prisma.meterValue.createMany({
    data: [
      {
        transactionId: String(p.transactionId),
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
    ],
    skipDuplicates: true,
  });

  // Calculate session energy consumed & update transaction
  let sessionEnergy: number | undefined = undefined;
  if (p.energyValue !== undefined && p.energyValue !== null) {
    const tx = await prisma.transaction.findFirst({
      where: { transactionId: String(p.transactionId) },
      select: { initialMeterValue: true },
    });
    sessionEnergy = Math.max(0, p.energyValue - (tx?.initialMeterValue || 0));
  }

  const txUpdateData: any = {
    ...(sessionEnergy !== undefined && { energyConsumed: sessionEnergy }),
    ...(p.powerValue !== undefined && p.powerValue !== null && { currentPower: p.powerValue }),
    ...(p.socValue !== null && p.socValue !== undefined && { soc: p.socValue }),
    ...(p.currentValue !== null && p.currentValue !== undefined && { current: p.currentValue }),
    ...(p.voltageValue !== null && p.voltageValue !== undefined && { voltage: p.voltageValue }),
    status: "charging",
  };

  await Promise.all([
    prisma.transaction.updateMany({
      where: { transactionId: String(p.transactionId), status: { not: "completed" } },
      data: txUpdateData,
    }),
    prisma.rfidSession.updateMany({
      where: { transactionId: String(p.transactionId), status: { not: "completed" } },
      data: txUpdateData,
    }),
  ]);
}

/**
 * Process a batch of meter values directly (for bulk efficiency / worker batching)
 */
export async function processMeterValuesBatch(payloads: MeterValueJobData[]): Promise<void> {
  if (!payloads || payloads.length === 0) return;

  // Real-Time High-Frequency Anomaly Analysis for batch
  for (const p of payloads) {
    try {
      await TelemetryAnomalyService.analyzeTelemetry(p);
    } catch (err) {
      logger.error(`Error in TelemetryAnomalyService.analyzeTelemetry batch: ${err}`);
    }
  }

  const diagnosticEvents = payloads
    .filter((p) => p.temperatureValue && p.temperatureValue > 80)
    .map((p) => ({
      chargerId: p.chargerId,
      connectorId: p.connectorId,
      type: "HighTemperature",
      description: `Temperature exceeded threshold: ${p.temperatureValue}°C`,
    }));

  if (diagnosticEvents.length > 0) {
    try {
      await prisma.diagnosticEvent.createMany({
        data: diagnosticEvents,
      });
    } catch (e) {
      logger.error(`Error logging high temperature diagnostic events: ${e}`);
    }
  }

  // Batch insert into MeterValue table
  const meterValueData = payloads.map((p) => ({
    transactionId: String(p.transactionId),
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
  }));

  await prisma.meterValue.createMany({
    data: meterValueData,
    skipDuplicates: true,
  });

  // Group by transactionId to merge values
  const latestValuesByTx = new Map<string, MeterValueJobData>();
  for (const p of payloads) {
    if (latestValuesByTx.has(p.transactionId)) {
      const existing = latestValuesByTx.get(p.transactionId)!;
      latestValuesByTx.set(p.transactionId, {
        ...existing,
        ...p,
        energyValue: p.energyValue !== undefined && p.energyValue !== null ? p.energyValue : existing.energyValue,
        powerValue: p.powerValue !== undefined && p.powerValue !== null ? p.powerValue : existing.powerValue,
        socValue: p.socValue !== null && p.socValue !== undefined ? p.socValue : existing.socValue,
        currentValue: p.currentValue !== null && p.currentValue !== undefined ? p.currentValue : existing.currentValue,
        voltageValue: p.voltageValue !== null && p.voltageValue !== undefined ? p.voltageValue : existing.voltageValue,
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

  for (const [transactionId, latest] of latestValuesByTx.entries()) {
    let sessionEnergy: number | undefined = undefined;
    if (latest.energyValue !== undefined && latest.energyValue !== null) {
      const tx = await prisma.transaction.findFirst({
        where: { transactionId },
        select: { initialMeterValue: true },
      });
      sessionEnergy = Math.max(0, latest.energyValue - (tx?.initialMeterValue || 0));
    }

    const txUpdateData: any = {
      ...(sessionEnergy !== undefined && { energyConsumed: sessionEnergy }),
      ...(latest.powerValue !== undefined && latest.powerValue !== null && { currentPower: latest.powerValue }),
      ...(latest.socValue !== null && latest.socValue !== undefined && { soc: latest.socValue }),
      ...(latest.currentValue !== null && latest.currentValue !== undefined && { current: latest.currentValue }),
      ...(latest.voltageValue !== null && latest.voltageValue !== undefined && { voltage: latest.voltageValue }),
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
}

/**
 * Creates and returns the BullMQ Worker for meter values
 */
export function createMeterValuesWorker(): Worker<MeterValueJobData> {
  const workerConnection = getBullMqRedisConnection();
  const worker = new Worker<MeterValueJobData>(
    METER_VALUES_QUEUE_NAME,
    async (job: Job<MeterValueJobData>) => {
      await processMeterValueJob(job);
    },
    {
      connection: workerConnection,
      concurrency: 50,
      limiter: {
        max: 500,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    logger.debug(`Meter value job ${job.id} completed for TX: ${job.data?.transactionId}`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`Meter value job ${job?.id} failed: ${err.message}`);
  });

  worker.on("error", (err) => {
    logger.error(`Meter values worker error: ${err.message}`);
  });

  return worker;
}
