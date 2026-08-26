import { Worker } from "bullmq";
import { createMeterValuesWorker } from "./meterValuesWorker.js";
import { createStatusEventsWorker } from "./eventWorker.js";
import { createBillingWorker } from "./billingWorker.js";
import { closeQueues } from "../queues/queueManager.js";
import { logger } from "../utils/logger.js";

let meterValuesWorker: Worker | null = null;
let statusEventsWorker: Worker | null = null;
let billingWorker: Worker | null = null;
let isRunning = false;

/**
 * Starts all BullMQ background worker listeners
 */
export function startWorkers(): void {
  if (isRunning) {
    logger.warn("BullMQ workers are already running.");
    return;
  }

  try {
    meterValuesWorker = createMeterValuesWorker();
    statusEventsWorker = createStatusEventsWorker();
    billingWorker = createBillingWorker();
    isRunning = true;

    logger.info("BullMQ background workers (meterValues, statusEvents, billing) started successfully.");
  } catch (error) {
    logger.error(`Failed to start BullMQ workers: ${error}`);
  }
}

/**
 * Gracefully shuts down all BullMQ workers and underlying queue connections
 */
export async function stopWorkers(): Promise<void> {
  if (!isRunning) return;

  logger.info("Stopping BullMQ background workers...");

  const workersToClose: Promise<void>[] = [];
  if (meterValuesWorker) {
    workersToClose.push(meterValuesWorker.close());
    meterValuesWorker = null;
  }
  if (statusEventsWorker) {
    workersToClose.push(statusEventsWorker.close());
    statusEventsWorker = null;
  }
  if (billingWorker) {
    workersToClose.push(billingWorker.close());
    billingWorker = null;
  }

  try {
    await Promise.all(workersToClose);
    await closeQueues();
    isRunning = false;
    logger.info("BullMQ workers and queues stopped gracefully.");
  } catch (error) {
    logger.error(`Error while stopping BullMQ workers: ${error}`);
  }
}

export function areWorkersRunning(): boolean {
  return isRunning;
}
