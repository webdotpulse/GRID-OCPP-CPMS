import cron from "node-cron";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface CalculationResult {
  month: number;
  year: number;
  contractsProcessed: number;
  ledgers: Array<{
    contractId: number;
    userName: string;
    totalKwh: number;
    totalAmount: number;
  }>;
}

/**
 * Calculates monthly reimbursement ledgers for all active contracts for a given target month/year.
 * Defaults to previous calendar month if targetDate is not specified.
 */
export async function calculateMonthlyReimbursements(targetDate?: Date): Promise<CalculationResult> {
  const now = targetDate || new Date();
  
  // If no specific date was given and running in cron mode, target previous month
  let targetMonth = now.getMonth() + 1; // 1-12
  let targetYear = now.getFullYear();

  if (!targetDate) {
    targetMonth -= 1;
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }
  }

  logger.info(`Starting reimbursement ledger calculation for ${targetMonth}/${targetYear}...`);

  const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));

  const contracts = await prisma.reimbursementContract.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      rfidUser: { select: { rfid_user_id: true, rfid_tag: true } },
      station: { select: { id: true, station_name: true } },
      tariff: true,
    },
  });

  logger.info(`Found ${contracts.length} reimbursement contract(s) to process.`);

  const results: CalculationResult = {
    month: targetMonth,
    year: targetYear,
    contractsProcessed: contracts.length,
    ledgers: [],
  };

  for (const contract of contracts) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          status: "completed",
          startTime: {
            gte: startDate,
            lt: endDate,
          },
          charger: {
            charging_station_id: contract.stationId,
          },
          OR: [
            { rfidUserId: contract.rfidUserId },
            { idTag: contract.rfidUser.rfid_tag },
          ],
        },
      });

      const totalEnergyWh = transactions.reduce((sum, tx) => sum + (tx.energyConsumed || 0), 0);
      const totalKwh = Math.round((totalEnergyWh / 1000) * 100) / 100;

      let totalAmount = 0;
      if (contract.tariff?.tariffType === "DYNAMIC_EPEX") {
        let dynamicSum = 0;
        for (const tx of transactions) {
          if (tx.totalCost !== null && tx.totalCost !== undefined && tx.totalCost > 0) {
            dynamicSum += tx.totalCost / 100; // totalCost stored in cents
          } else {
            const electricityRate = contract.tariff.electricity_rate || 0.30;
            dynamicSum += (tx.energyConsumed / 1000) * electricityRate;
          }
        }
        totalAmount = Math.round(dynamicSum * 100) / 100;
      } else {
        const rate = contract.tariff?.electricity_rate || 0;
        totalAmount = Math.round(totalKwh * rate * 100) / 100;
      }

      await prisma.reimbursementLedger.upsert({
        where: {
          contractId_month_year: {
            contractId: contract.id,
            month: targetMonth,
            year: targetYear,
          },
        },
        update: {
          totalKwh,
          totalAmount,
        },
        create: {
          contractId: contract.id,
          month: targetMonth,
          year: targetYear,
          totalKwh,
          totalAmount,
          status: "pending",
        },
      });

      results.ledgers.push({
        contractId: contract.id,
        userName: contract.user?.name || contract.user?.email || "Unknown",
        totalKwh,
        totalAmount,
      });

      logger.info(
        `Calculated ledger for Contract ${contract.id} (${contract.user?.name || contract.user?.email}): ${totalKwh} kWh, €${totalAmount}`
      );
    } catch (contractError) {
      logger.error(`Error processing contract ${contract.id}:`, contractError);
    }
  }

  return results;
}

/**
 * Initializes the automated node-cron schedule for monthly reimbursement calculation.
 * Runs on the 1st of every month at 01:00 AM.
 */
export function startReimbursementCron(): void {
  // Cron schedule: 0 1 1 * * (At 01:00 on day 1 of the month)
  cron.schedule("0 1 1 * *", async () => {
    logger.info("Executing scheduled monthly reimbursement calculation cron job...");
    try {
      const result = await calculateMonthlyReimbursements();
      logger.info(
        `Scheduled monthly reimbursement calculation completed: ${result.contractsProcessed} contracts processed for ${result.month}/${result.year}.`
      );
    } catch (error) {
      logger.error("Failed scheduled reimbursement calculation:", error);
    }
  });

  logger.info("Reimbursement cron job initialized with schedule: 0 1 1 * *");
}
