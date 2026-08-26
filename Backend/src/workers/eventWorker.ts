import { Worker, Job } from "bullmq";
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
    if (status === "Faulted" || status === "SuspendedEVSE") {
      try {
        await prisma.diagnosticEvent.create({
          data: {
            chargerId,
            connectorId,
            type: "FaultedState",
            description: `Charger reported status: ${status} (ErrorCode: ${errorCode || "Unknown"})`,
          },
        });

        if (status === "Faulted") {
          await prisma.charger.update({
            where: { charger_id: chargerId },
            data: { consecutiveErrors: { increment: 1 } },
          });
        }
      } catch (err) {
        logger.error(`[eventWorker] Error creating fault diagnostic event: ${err}`);
      }
    } else if (status === "Available" || status === "Charging") {
      try {
        await prisma.charger.update({
          where: { charger_id: chargerId },
          data: { consecutiveErrors: 0 },
        });
      } catch (err) {
        logger.error(`[eventWorker] Error resetting consecutive errors: ${err}`);
      }
    }

    // 2. Channel & EVSE update in DB
    const connectorName = `Channel ${connectorId}`;
    if (connectorId > 0) {
      let evse = await prisma.evse.findUnique({
        where: {
          charger_id_evse_id: {
            charger_id: chargerId,
            evse_id: 1,
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
        logger.info(`[eventWorker] Auto-created channel ${connectorName} for charger ${chargerId}`);
      }
    }

    // 3. Mark charger active with timestamp
    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: { status: "active", last_heartbeat: new Date() },
    });

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
    throw error;
  }
}

/**
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
}
