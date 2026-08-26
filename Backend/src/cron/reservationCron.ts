import cron, { ScheduledTask } from "node-cron";
import { ReservationService } from "../services/ReservationService.js";
import { logger } from "../utils/logger.js";

let reservationCronTask: ScheduledTask | null = null;

export function startReservationCron(): void {
  if (reservationCronTask) {
    return;
  }

  // Run every minute: * * * * *
  reservationCronTask = cron.schedule("* * * * *", async () => {
    try {
      await ReservationService.expireOverdueReservations();
    } catch (error) {
      logger.error(`Error in reservationCron background job: ${error}`);
    }
  });

  logger.info("Reservation expiration cron scheduled (every 1 minute).");
}

export function stopReservationCron(): void {
  if (reservationCronTask) {
    reservationCronTask.stop();
    reservationCronTask = null;
    logger.info("Reservation expiration cron stopped.");
  }
}
