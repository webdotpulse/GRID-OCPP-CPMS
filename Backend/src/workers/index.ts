import {
  startMeterValuesWorker,
  stopMeterValuesWorker,
} from "./meterValuesWorker.js";
import {
  startEventWorkers,
  stopEventWorkers,
} from "./eventWorker.js";
import { logger } from "../utils/logger.js";

/**
 * Starts all BullMQ asynchronous workers (meter values, status events, billing).
 */
export function startWorkers(): void {
  try {
    startMeterValuesWorker();
    startEventWorkers();
    logger.info("All BullMQ background workers initialized successfully.");
  } catch (error) {
    logger.error(`Error starting BullMQ background workers: ${error}`);
  }
}

/**
 * Gracefully shuts down all BullMQ background workers.
 */
export async function stopWorkers(): Promise<void> {
  try {
    await Promise.all([
      stopMeterValuesWorker(),
      stopEventWorkers(),
    ]);
    logger.info("All BullMQ background workers stopped.");
  } catch (error) {
    logger.error(`Error stopping BullMQ background workers: ${error}`);
  }
}

export * from "./meterValuesWorker.js";
export * from "./eventWorker.js";
