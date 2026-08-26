import cron from "node-cron";
import { InvoiceService, MonthlyInvoiceResult } from "../services/InvoiceService.js";
import { logger } from "../utils/logger.js";

/**
 * Calculates and issues monthly PDF invoices for all non-invoiced completed transactions.
 * Defaults to previous calendar month if targetDate is not specified.
 */
export async function calculateMonthlyInvoices(targetDate?: Date): Promise<MonthlyInvoiceResult> {
  const now = targetDate || new Date();

  let targetMonth = now.getMonth() + 1; // 1-12
  let targetYear = now.getFullYear();

  if (!targetDate) {
    targetMonth -= 1;
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }
  }

  logger.info(`[InvoiceCron] Starting monthly billing calculation for ${targetMonth}/${targetYear}...`);

  try {
    const result = await InvoiceService.generateMonthlyInvoices(targetDate);
    logger.info(
      `[InvoiceCron] Monthly invoice generation completed: ${result.invoicesGenerated} invoice(s) created (Total: €${result.totalAmount}) for ${result.month}/${result.year}.`
    );
    return result;
  } catch (error) {
    logger.error("[InvoiceCron] Error during monthly invoice generation:", error);
    throw error;
  }
}

/**
 * Initializes the automated node-cron schedule for monthly invoice generation.
 * Runs on the 1st of every month at 02:00 AM.
 */
export function startInvoiceCron(): void {
  // Cron schedule: 0 2 1 * * (At 02:00 on day 1 of the month)
  cron.schedule("0 2 1 * *", async () => {
    logger.info("[InvoiceCron] Executing scheduled monthly billing & invoicing cron job...");
    try {
      const result = await calculateMonthlyInvoices();
      logger.info(
        `[InvoiceCron] Scheduled billing run successful: ${result.invoicesGenerated} invoices generated (Total: €${result.totalAmount.toFixed(2)}).`
      );
    } catch (error) {
      logger.error("[InvoiceCron] Scheduled billing run failed:", error);
    }
  });

  logger.info("Invoice cron job initialized with schedule: 0 2 1 * * (1st of month at 02:00 AM)");
}
