import cron, { ScheduledTask } from "node-cron";
import { ScheduledChargingService } from "../services/ScheduledChargingService.js";
import { logger } from "../utils/logger.js";

let scheduledChargingCronTask: ScheduledTask | null = null;

export function startScheduledChargingCron(): void {
  if (scheduledChargingCronTask) {
    return;
  }

  // Run every minute: * * * * *
  scheduledChargingCronTask = cron.schedule("* * * * *", async () => {
    try {
      await ScheduledChargingService.processDueSchedules();
    } catch (error) {
      logger.error(`Error in scheduledChargingCron background job: ${error}`);
    }
  });

  logger.info("Scheduled Charging execution cron scheduled (every 1 minute).");
}

export function stopScheduledChargingCron(): void {
  if (scheduledChargingCronTask) {
    scheduledChargingCronTask.stop();
    scheduledChargingCronTask = null;
    logger.info("Scheduled Charging execution cron stopped.");
  }
}
