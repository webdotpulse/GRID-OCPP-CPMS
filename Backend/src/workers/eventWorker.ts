import { Worker, Job } from "bullmq";
import { getBullMqRedisConnection, StatusEventJobData } from "../queues/queueManager.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { redisPublisher } from "../config/redis.js";
import { getUnifiedVendorErrorInfo, formatUnifiedVendorDiagnostic } from "../utils/vendorErrorCodes/index.js";

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
        const unifiedDiag = formatUnifiedVendorDiagnostic(job.data.vendorId, job.data.vendorErrorCode || errorCode, info);
        const description = unifiedDiag
          ? `Charger reported status: ${status} | ${unifiedDiag}`
          : `Charger reported status: ${status} (ErrorCode: ${errorCode || "Unknown"}, Info: ${info || "None"}${job.data.vendorErrorCode ? `, VendorCode: ${job.data.vendorErrorCode}` : ""})`;

        await prisma.diagnosticEvent.create({
          data: {
            chargerId,
            connectorId,
            type: "FaultedState",
            description,
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
              info,
              job.data.vendorId
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

    // Auto-detect and populate manufacturer if vendorId indicates supported brands
    const vIdUpper = job.data.vendorId?.toUpperCase();
    let detectedMfr: string | null = null;
    if (vIdUpper === "RAEDIAN" || vIdUpper?.includes("RAEDIAN")) detectedMfr = "Raedian";
    else if (vIdUpper?.includes("ALFEN")) detectedMfr = "Alfen";
    else if (vIdUpper?.includes("EASEE")) detectedMfr = "Easee";
    else if (vIdUpper?.includes("ZAPTEC")) detectedMfr = "Zaptec";
    else if (vIdUpper?.includes("PEBLAR")) detectedMfr = "Peblar";

    if (detectedMfr) {
      try {
        const ch = await prisma.charger.findUnique({
          where: { charger_id: chargerId },
          select: { manufacturer: true },
        });
        if (ch && (!ch.manufacturer || ch.manufacturer === "Generic" || ch.manufacturer === "Unknown")) {
          await prisma.charger.update({
            where: { charger_id: chargerId },
            data: { manufacturer: detectedMfr },
          });
        }
      } catch {
        // ignore
      }
    }

    // 2. Update / Create EVSE Connector status in Database
    if (connectorId > 0) {
      const connectorName = `Channel ${connectorId}`;
      let evse = await prisma.evse.findUnique({
        where: {
          charger_id_evse_id: {
            charger_id: chargerId,
            evse_id: connectorId,
          },
        },
      });

      // Fallback: single-EVSE chargers may map connectors to EVSE 1
      if (!evse) {
        evse = await prisma.evse.findUnique({
          where: {
            charger_id_evse_id: {
              charger_id: chargerId,
              evse_id: 1,
            },
          },
        });
      }

      if (!evse) {
        evse = await prisma.evse.create({
          data: {
            charger_id: chargerId,
            evse_id: connectorId,
          },
        });
      }

      let existingConnector = await prisma.connector.findFirst({
        where: {
          evse_id: evse.id,
          OR: [
            { connector_name: connectorName },
            { connector_name: { startsWith: `Channel ${connectorId}` } },
            { connector_name: { startsWith: `CH ${connectorId}` } },
            { connector_name: { startsWith: `Connector ${connectorId}` } },
          ],
        },
      });

      // If no name match, check if ANY connector already exists under this EVSE to avoid creating duplicate records
      if (!existingConnector) {
        existingConnector = await prisma.connector.findFirst({
          where: {
            evse_id: evse.id,
          },
        });
      }

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
