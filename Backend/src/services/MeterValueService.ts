import { enqueueMeterValue, MeterValueJobData } from "../queues/queueManager.js";
import { processMeterValuesBatch } from "../workers/meterValuesWorker.js";
import { logger } from "../utils/logger.js";

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
   * Pushes a new meter value payload to the BullMQ meter-values queue.
   */
  public static async addMeterValue(payload: MeterValuePayload): Promise<void> {
    try {
      await enqueueMeterValue({
        ...payload,
        timestamp: payload.timestamp instanceof Date ? payload.timestamp.toISOString() : payload.timestamp,
      });
    } catch (error) {
      logger.error(`Error adding meter value to BullMQ queue: ${error}`);
    }
  }

  /**
   * Starts the worker (lifecycle managed via workerManager).
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
      await processMeterValuesBatch(payloads.map(p => ({
        ...p,
        timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp,
      })));
    }
  }
}
