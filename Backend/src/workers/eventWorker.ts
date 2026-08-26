import { Worker, Job } from "bullmq";
<<<<<<< HEAD
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { redisPublisher } from "../config/redis.js";
import { loadManagementService } from "../services/LoadManagementService.js";
import { getTariffForTransaction } from "../utils/tariffHelpers.js";
import { DynamicTariffService } from "../services/DynamicTariffService.js";
import {
  StatusEventJobData,
  BillingJobData,
  QUEUE_NAMES,
  createRedisConnection,
} from "../queues/queueManager.js";

let statusEventsWorkerInstance: Worker<StatusEventJobData> | null = null;
let billingWorkerInstance: Worker<BillingJobData> | null = null;

/**
 * Process a status notification event asynchronously.
 */
export async function processStatusEventJob(
  job: Job<StatusEventJobData>
): Promise<void> {
  const { chargerId, connectorId, status, errorCode } = job.data;

  try {
    // 1. Diagnostic event logging for faults
=======
import { getBullMqRedisConnection, StatusEventJobData } from "../queues/queueManager.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export const STATUS_EVENTS_QUEUE_NAME = "status-events-queue";

/**
 * Process a status notification / connector state event from BullMQ
 */
export async function processStatusEventJob(job: Job<StatusEventJobData>): Promise<void> {
  const { chargerId, connectorId, status, errorCode, info } = job.data;
  if (!chargerId) return;

  try {
    // 1. Handle Fault Diagnostics & Consecutive Errors
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
    if (status === "Faulted" || status === "SuspendedEVSE") {
      try {
        await prisma.diagnosticEvent.create({
          data: {
            chargerId,
            connectorId,
            type: "FaultedState",
<<<<<<< HEAD
            description: `Charger reported status: ${status} (ErrorCode: ${errorCode || "Unknown"})`,
=======
            description: `Charger reported status: ${status} (ErrorCode: ${errorCode || "Unknown"}, Info: ${info || "None"})`,
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
          },
        });

        if (status === "Faulted") {
          await prisma.charger.update({
            where: { charger_id: chargerId },
            data: { consecutiveErrors: { increment: 1 } },
          });
        }
<<<<<<< HEAD
      } catch (err) {
        logger.error(`[eventWorker] Error creating fault diagnostic event: ${err}`);
=======
      } catch (e) {
        logger.error(`Error recording diagnostic event in statusWorker: ${e}`);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
      }
    } else if (status === "Available" || status === "Charging") {
      try {
        await prisma.charger.update({
          where: { charger_id: chargerId },
          data: { consecutiveErrors: 0 },
        });
<<<<<<< HEAD
      } catch (err) {
        logger.error(`[eventWorker] Error resetting consecutive errors: ${err}`);
      }
    }

    // 2. Channel & EVSE update in DB
    const connectorName = `Channel ${connectorId}`;
    if (connectorId > 0) {
=======
      } catch (e) {
        logger.error(`Error resetting consecutive errors in statusWorker: ${e}`);
      }
    }

    // 2. Update / Create EVSE Connector status in Database
    if (connectorId > 0) {
      const connectorName = `Channel ${connectorId}`;
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
      let evse = await prisma.evse.findUnique({
        where: {
          charger_id_evse_id: {
            charger_id: chargerId,
<<<<<<< HEAD
            evse_id: 1,
=======
            evse_id: 1, // Default EVSE for single-station representation
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
          },
        },
      });

      if (!evse) {
        evse = await prisma.evse.create({
          data: {
            charger_id: chargerId,
            evse_id: 1,
          },
        });
      }

      const existingConnector = await prisma.connector.findFirst({
        where: {
          evse_id: evse.id,
          connector_name: connectorName,
        },
      });

      if (existingConnector) {
        await prisma.connector.update({
          where: { connector_id: existingConnector.connector_id },
          data: { status, updatedAt: new Date() },
        });
      } else {
        await prisma.connector.create({
          data: {
            evse_id: evse.id,
            connector_name: connectorName,
            status,
            current_type: "AC",
            updatedAt: new Date(),
          },
        });
<<<<<<< HEAD
        logger.info(`[eventWorker] Auto-created channel ${connectorName} for charger ${chargerId}`);
      }
    }

    // 3. Mark charger active with timestamp
=======
        logger.info(`Auto-created connector ${connectorName} for charger ${chargerId} in eventWorker`);
      }
    }

    // 3. Update Charger heartbeat & active status
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: { status: "active", last_heartbeat: new Date() },
    });

<<<<<<< HEAD
    // 4. Broadcast realtime status update
    await redisPublisher.publish(
      "charger_status_updates",
      JSON.stringify({ chargerId, connectorId, status })
    );

    // 5. Asynchronously synchronize dynamic EVSE status to Hubject OICP
    import("../services/HubjectOicpService.js")
      .then(({ HubjectOicpService }) => {
        HubjectOicpService.pushEvseStatus(chargerId, connectorId, status, errorCode).catch((err) =>
          logger.warn(`[eventWorker] Hubject status push failed: ${err}`)
        );
      })
      .catch(() => {});

    logger.debug(`[eventWorker] StatusNotification processed for charger ${chargerId}, channel ${connectorId}: ${status}`);
  } catch (error) {
    logger.error(`[eventWorker] Failed to process status event job ${job.id}: ${error}`);
=======
    logger.debug(`Status event processed for charger ${chargerId}, connector ${connectorId} -> ${status}`);
  } catch (error) {
    logger.error(`Error processing status event for charger ${chargerId}: ${error}`);
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
    throw error;
  }
}

/**
<<<<<<< HEAD
 * Process a transaction completion and billing event asynchronously.
 */
export async function processBillingJob(
  job: Job<BillingJobData>
): Promise<void> {
  const { chargerId, transactionId, meterStop, timestamp, idTag, reason, isV2GDischarging } = job.data;

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { transactionId: String(transactionId) },
    });

    const tariff = await getTariffForTransaction(chargerId, idTag || transaction?.idTag);
    const tariffRate = tariff?.electricity_rate || tariff?.charge || 0;

    let totalCost = 0;
    if (transaction) {
      let energyConsumedTx = meterStop - (transaction.initialMeterValue || 0);
      if (isV2GDischarging && energyConsumedTx > 0) {
        energyConsumedTx = -energyConsumedTx;
      }

      const stopTime = new Date(timestamp || new Date());

      const costResult = await DynamicTariffService.calculateSessionCost({
        transactionId: String(transactionId),
        initialMeterValue: transaction.initialMeterValue || 0,
        meterStop,
        startTime: transaction.startTime,
        endTime: stopTime,
        tariff,
      });

      totalCost = costResult.totalCost;

      const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          finalMeterValue: meterStop,
          endTime: stopTime,
          status: "completed",
          stopReason: reason || null,
          energyConsumed: energyConsumedTx,
          totalCost,
        },
        include: { charger: true },
      });

      // Update connector status to Finishing
      if (transaction.connectorName) {
        const existingConnector = await prisma.connector.findFirst({
          where: {
            evse: { charger_id: chargerId },
            connector_name: transaction.connectorName,
          },
        });

        if (existingConnector) {
          await prisma.connector.update({
            where: { connector_id: existingConnector.connector_id },
            data: { status: "Finishing", updatedAt: new Date() },
          });
        }
      }

      // Trigger Load Balancing to recalculate capacity
      if (updatedTransaction.charger.charging_station_id) {
        loadManagementService
          .balanceSiteLoad(updatedTransaction.charger.charging_station_id)
          .catch((err) => logger.error(`[eventWorker] Error balancing site load: ${err}`));
      }
      if (updatedTransaction.charger.chargeGroupId) {
        loadManagementService
          .balanceChargeGroupLoad(updatedTransaction.charger.chargeGroupId)
          .catch((err) => logger.error(`[eventWorker] Error balancing charge group load: ${err}`));
      }
    }

    // Process RFID session if exists
    const rfidSession = await prisma.rfidSession.findFirst({
      where: { transactionId: String(transactionId) },
      include: { rfidUser: true },
    });

    if (rfidSession) {
      let energyConsumed = meterStop - (rfidSession.initialMeterValue || 0);
      if (isV2GDischarging && energyConsumed > 0) {
        energyConsumed = -energyConsumed;
      }

      const stopTime = new Date(timestamp || new Date());

      const rfidCostResult = await DynamicTariffService.calculateSessionCost({
        transactionId: String(transactionId),
        initialMeterValue: rfidSession.initialMeterValue || 0,
        meterStop,
        startTime: rfidSession.startTime,
        endTime: stopTime,
        tariff,
      });

      const amountDue = rfidCostResult.totalCost;

      await prisma.rfidSession.update({
        where: { id: rfidSession.id },
        data: {
          finalMeterValue: meterStop,
          endTime: stopTime,
          energyConsumed,
          tariffRate,
          amountDue,
          status: "completed",
          stopReason: reason || null,
        },
      });

      logger.info(`[eventWorker] RfidSession ${rfidSession.id} finalized. Amount due: ${(amountDue / 100).toFixed(2)}`);
    }

    // Process OCPI roaming session & compile CDR if applicable
    const roamingSession = prisma.roamingSession
      ? await prisma.roamingSession.findFirst({
          where: { transactionId: String(transactionId) },
        })
      : null;

    if (roamingSession) {
      const initialMeter = transaction?.initialMeterValue || 0;
      await prisma.roamingSession.update({
        where: { id: roamingSession.id },
        data: {
          endTime: new Date(timestamp || new Date()),
          energyConsumed: meterStop - initialMeter,
          wholesaleCost: (totalCost || 0) / 100,
          status: "completed",
        },
      });

      // Compile and dispatch OCPI CDR asynchronously
      import("../services/OcpiService.js")
        .then(({ OcpiService }) => {
          OcpiService.compileCdrForTransaction(transactionId, roamingSession.partnerId)
            .then((cdr) => {
              if (cdr) {
                OcpiService.dispatchCdrToPartner(cdr.cdrId, roamingSession.partnerId).catch((err) =>
                  logger.error(`[eventWorker] Error dispatching roaming CDR: ${err}`)
                );
              }
            })
            .catch((err) => logger.error(`[eventWorker] Error compiling roaming CDR: ${err}`));
        })
        .catch(() => {});
    }

    // Also submit OICP CDR to Hubject if applicable
    import("../services/HubjectOicpService.js")
      .then(({ HubjectOicpService }) => {
        HubjectOicpService.sendChargeDetailRecord(transactionId).catch((err) =>
          logger.warn(`[eventWorker] Hubject CDR submit failed: ${err}`)
        );
      })
      .catch(() => {});

    logger.info(`[eventWorker] Billing and session completion processed for tx ${transactionId}`);
  } catch (error) {
    logger.error(`[eventWorker] Failed to process billing job ${job.id}: ${error}`);
    throw error;
  }
}

/**
 * Start the status events and billing workers.
 */
export function startEventWorkers(): {
  statusWorker: Worker<StatusEventJobData>;
  billingWorker: Worker<BillingJobData>;
} {
  if (!statusEventsWorkerInstance) {
    const conn1 = createRedisConnection();
    statusEventsWorkerInstance = new Worker<StatusEventJobData>(
      QUEUE_NAMES.STATUS_EVENTS,
      processStatusEventJob,
      {
        connection: conn1,
        concurrency: 20,
      }
    );

    statusEventsWorkerInstance.on("failed", (job, err) => {
      logger.warn(`[statusEventsWorker] Job ${job?.id} failed: ${err.message}`);
    });
  }

  if (!billingWorkerInstance) {
    const conn2 = createRedisConnection();
    billingWorkerInstance = new Worker<BillingJobData>(
      QUEUE_NAMES.BILLING,
      processBillingJob,
      {
        connection: conn2,
        concurrency: 20,
      }
    );

    billingWorkerInstance.on("failed", (job, err) => {
      logger.warn(`[billingWorker] Job ${job?.id} failed: ${err.message}`);
    });
  }

  logger.info("BullMQ statusEventsWorker and billingWorker started (concurrency: 20 each).");
  return {
    statusWorker: statusEventsWorkerInstance,
    billingWorker: billingWorkerInstance,
  };
}

/**
 * Stop the status events and billing workers.
 */
export async function stopEventWorkers(): Promise<void> {
  const promises: Promise<void>[] = [];
  if (statusEventsWorkerInstance) {
    promises.push(statusEventsWorkerInstance.close());
    statusEventsWorkerInstance = null;
  }
  if (billingWorkerInstance) {
    promises.push(billingWorkerInstance.close());
    billingWorkerInstance = null;
  }
  await Promise.all(promises);
  logger.info("BullMQ statusEventsWorker and billingWorker stopped.");
=======
 * Creates and returns the BullMQ Worker for status events
 */
export function createStatusEventsWorker(): Worker<StatusEventJobData> {
  const workerConnection = getBullMqRedisConnection();
  const worker = new Worker<StatusEventJobData>(
    STATUS_EVENTS_QUEUE_NAME,
    async (job: Job<StatusEventJobData>) => {
      await processStatusEventJob(job);
    },
    {
      connection: workerConnection,
      concurrency: 20,
    }
  );

  worker.on("completed", (job) => {
    logger.debug(`Status event job ${job.id} completed for charger: ${job.data?.chargerId}`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`Status event job ${job?.id} failed: ${err.message}`);
  });

  worker.on("error", (err) => {
    logger.error(`Status events worker error: ${err.message}`);
  });

  return worker;
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
}
