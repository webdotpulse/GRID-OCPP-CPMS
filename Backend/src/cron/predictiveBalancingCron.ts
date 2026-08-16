import cron from "node-cron";
import { logger } from "../utils/logger.js";
import { PredictiveBalancingService } from "../services/PredictiveBalancingService.js";
import { V2GOrchestrationService } from "../services/V2GOrchestrationService.js";

// Run every hour on the hour (0 * * * *) for predictive balancing plans
cron.schedule("0 * * * *", async () => {
  try {
    logger.info("Starting scheduled predictive balancing schedule generation...");
    await PredictiveBalancingService.generateSchedulesForAll();
    logger.info("Completed predictive balancing schedule generation.");
  } catch (error) {
    logger.error(`Error in predictive balancing cron job: ${error}`);
  }
});

// Run every minute (* * * * *) for real-time V2G load balancing & EMS grid peak shaving
cron.schedule("* * * * *", async () => {
  try {
    await V2GOrchestrationService.evaluateAndDispatchV2G();
  } catch (error) {
    logger.error(`Error in V2G orchestration cron job: ${error}`);
  }
});

