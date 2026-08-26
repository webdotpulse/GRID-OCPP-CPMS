import { Worker, Job } from "bullmq";
import { getBullMqRedisConnection, BillingJobData } from "../queues/queueManager.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { getTariffForTransaction } from "../utils/tariffHelpers.js";
import { DynamicTariffService } from "../services/DynamicTariffService.js";
import { loadManagementService } from "../services/LoadManagementService.js";

export const BILLING_QUEUE_NAME = "billing-queue";

/**
 * Process a transaction finalization, cost calculation, and billing job from BullMQ
 */
export async function processBillingJob(job: Job<BillingJobData>): Promise<void> {
  const { chargerId, transactionId, meterStop, timestamp, idTag, reason, isV2GDischarging } = job.data;
  if (!transactionId) return;

  try {
    const transaction = await prisma.transaction.findFirst({
      where: { transactionId: String(transactionId) },
    });

    const tariff = await getTariffForTransaction(chargerId, idTag || transaction?.idTag);
    const tariffRate = tariff?.electricity_rate || tariff?.charge || 0;

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

      const totalCost = costResult.totalCost;

      const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          finalMeterValue: meterStop,
          endTime: stopTime,
          status: "completed",
          stopReason: reason || null,
          energyConsumed: energyConsumedTx,
          totalCost: totalCost,
        },
        include: { charger: true },
      });

      // Update Connector status to Finishing
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

      // Trigger Load Balancing to free up capacity
      if (updatedTransaction.charger?.charging_station_id) {
        loadManagementService
          .balanceSiteLoad(updatedTransaction.charger.charging_station_id)
          .catch((err) => logger.error(`Error balancing site load: ${err}`));
      }
      if (updatedTransaction.charger?.chargeGroupId) {
        loadManagementService
          .balanceChargeGroupLoad(updatedTransaction.charger.chargeGroupId)
          .catch((err) => logger.error(`Error balancing charge group load: ${err}`));
      }
    }

    // Update RfidSession if exists
    const rfidSession = await prisma.rfidSession.findFirst({
      where: { transactionId: String(transactionId) },
      include: { rfidUser: true },
    });

    if (rfidSession) {
      const energyConsumed = meterStop - (rfidSession.initialMeterValue || 0);
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

      logger.info(`RfidSession ${rfidSession.id} completed. Amount due: ${(amountDue / 100).toFixed(2)}`);
    }

    logger.debug(`Billing job processed for TX: ${transactionId}`);
  } catch (error) {
    logger.error(`Error processing billing job for TX ${transactionId}: ${error}`);
    throw error;
  }
}

/**
 * Creates and returns the BullMQ Worker for billing jobs
 */
export function createBillingWorker(): Worker<BillingJobData> {
  const workerConnection = getBullMqRedisConnection();
  const worker = new Worker<BillingJobData>(
    BILLING_QUEUE_NAME,
    async (job: Job<BillingJobData>) => {
      await processBillingJob(job);
    },
    {
      connection: workerConnection,
      concurrency: 10,
    }
  );

  worker.on("completed", (job) => {
    logger.debug(`Billing job ${job.id} completed for TX: ${job.data?.transactionId}`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`Billing job ${job?.id} failed: ${err.message}`);
  });

  worker.on("error", (err) => {
    logger.error(`Billing worker error: ${err.message}`);
  });

  return worker;
}
