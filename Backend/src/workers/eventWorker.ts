import { Worker, Job } from "bullmq";
import { getBullMqRedisConnection, StatusEventJobData } from "../queues/queueManager.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { redisPublisher } from "../config/redis.js";

export const STATUS_EVENTS_QUEUE_NAME = "status-events-queue";

/**
 * Process a status notification / connector state event from BullMQ
 */
export async function processStatusEventJob(job: Job<StatusEventJobData>): Promise<void> {
  const { chargerId, connectorId, status, errorCode, info } = job.data;
  if (!chargerId) return;

  try {
    // 1. Handle Fault Diagnostics & Consecutive Errors
    if (status === "Faulted" || status === "SuspendedEVSE") {
      try {
        await prisma.diagnosticEvent.create({
          data: {
            chargerId,
            connectorId,
            type: "FaultedState",
            description: `Charger reported status: ${status} (ErrorCode: ${errorCode || "Unknown"}, Info: ${info || "None"})`,
          },
        });

        if (status === "Faulted") {
          await prisma.charger.update({
            where: { charger_id: chargerId },
            data: { consecutiveErrors: { increment: 1 } },
          });
        }

        // Trigger Vendor-Specific Auto-Healing Playbook
        import("../services/AutoHealPlaybookService.js")
          .then(({ AutoHealPlaybookService }) => {
            AutoHealPlaybookService.handleFaultTrigger(
              chargerId,
              connectorId,
              status,
              errorCode,
              job.data.vendorErrorCode,
              info
            ).catch((err) => logger.error(`[eventWorker] AutoHeal playbook trigger failed: ${err}`));
          })
          .catch(() => {});
      } catch (e) {
        logger.error(`Error recording diagnostic event in statusWorker: ${e}`);
      }
    } else if (status === "Available" || status === "Charging") {
      try {
        await prisma.charger.update({
          where: { charger_id: chargerId },
          data: { consecutiveErrors: 0 },
        });
      } catch (e) {
        logger.error(`Error resetting consecutive errors in statusWorker: ${e}`);
      }
    }

    // 2. Update / Create EVSE Connector status in Database
    if (connectorId > 0) {
      const connectorName = `Channel ${connectorId}`;
      let evse = await prisma.evse.findUnique({
        where: {
          charger_id_evse_id: {
            charger_id: chargerId,
            evse_id: 1, // Default EVSE for single-station representation
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
        logger.info(`Auto-created connector ${connectorName} for charger ${chargerId} in eventWorker`);
      }
    }

    // 3. Update Charger heartbeat & active status
    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: { status: "active", last_heartbeat: new Date() },
    });

    // 4. Broadcast realtime status update
    try {
      await redisPublisher.publish(
        "charger_status_updates",
        JSON.stringify({ chargerId, connectorId, status })
      );
    } catch (publishErr) {
      logger.debug(`Redis publish status update notice: ${publishErr}`);
    }

    // 5. Asynchronously synchronize dynamic EVSE status to Hubject OICP
    import("../services/HubjectOicpService.js")
      .then(({ HubjectOicpService }) => {
        HubjectOicpService.pushEvseStatus(chargerId, connectorId, status, errorCode).catch((err) =>
          logger.warn(`[eventWorker] Hubject status push failed: ${err}`)
        );
      })
      .catch(() => {});

    // 6. Dispatch outbound Webhook for status changes and hardware faults
    import("../services/WebhookService.js")
      .then(({ WebhookService }) => {
        WebhookService.dispatch("charger.status_changed", {
          chargerId,
          connectorId,
          status,
          errorCode: errorCode || "NoError",
          info: info || null,
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        if (status === "Faulted") {
          WebhookService.dispatch("connector.faulted", {
            chargerId,
            connectorId,
            errorCode: errorCode || "InternalError",
            vendorErrorCode: job.data.vendorErrorCode || null,
            info: info || "Connector reported Faulted state",
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
      })
      .catch(() => {});

    logger.debug(`Status event processed for charger ${chargerId}, connector ${connectorId} -> ${status}`);
  } catch (error) {
    logger.error(`Error processing status event for charger ${chargerId}: ${error}`);
    throw error;
  }
}

/**
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
}
