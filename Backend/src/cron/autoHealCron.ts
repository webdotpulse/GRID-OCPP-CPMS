import cron from "node-cron";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { resetCharger, unlockConnector } from "../ocpp/remoteControl.js";

// Run every 5 minutes
export function startAutoHealCron() {
  cron.schedule("*/5 * * * *", async () => {
    logger.info("Running auto-heal background worker...");
    try {
      // 1. Playbook & Diagnostic Event Auto-Remediation
      const faultEvents = await prisma.diagnosticEvent.findMany({
        where: {
          resolved: false,
          type: "FaultedState",
        },
        take: 20,
      });

      if (faultEvents.length > 0) {
        const { AutoHealPlaybookService } = await import("../services/AutoHealPlaybookService.js");
        for (const event of faultEvents) {
          logger.info(`[autoHealCron] Evaluating recovery playbook for unresolved fault event on charger ${event.chargerId}`);
          try {
            await AutoHealPlaybookService.handleFaultTrigger(
              event.chargerId,
              event.connectorId || 1,
              "Faulted",
              undefined,
              undefined,
              event.description
            );
          } catch (pbErr) {
            logger.error(`[autoHealCron] Playbook auto-eval error: ${pbErr}`);
          }
        }
      }

      // 2. Hardware at Risk Logic
      const harSettings = await prisma.hardwareAtRiskSetting.findFirst();
      if (harSettings && harSettings.isEnabled) {
        logger.info("Running Hardware at Risk evaluation...");
        const thresholdDate = new Date();
        thresholdDate.setMinutes(thresholdDate.getMinutes() - harSettings.offlineThresholdMinutes);

        const chargers = await prisma.charger.findMany();

        for (const charger of chargers) {
          let atRisk = false;
          let reasons: string[] = [];

          if (charger.last_heartbeat < thresholdDate) {
            atRisk = true;
            reasons.push(`Offline for more than ${harSettings.offlineThresholdMinutes} minutes.`);
          }

          if (charger.consecutiveErrors >= harSettings.criticalErrorCodeLimit) {
            atRisk = true;
            reasons.push(`Exceeded ${harSettings.criticalErrorCodeLimit} consecutive errors.`);
          }

          if (atRisk && !charger.isHardwareAtRisk) {
            // Newly flagged
            await prisma.charger.update({
              where: { charger_id: charger.charger_id },
              data: { isHardwareAtRisk: true }
            });
            logger.warn(`Hardware at Risk flagged for charger ${charger.charger_id}: ${reasons.join(" ")}`);

            // Dispatch outbound webhook for hardware risk alert
            import("../services/WebhookService.js")
              .then(({ WebhookService }) => {
                WebhookService.dispatch("alert.hardware_at_risk", {
                  chargerId: charger.charger_id,
                  chargerName: charger.name,
                  consecutiveErrors: charger.consecutiveErrors,
                  reason: reasons.join(" "),
                  timestamp: new Date().toISOString(),
                }, charger.owner_id || null).catch(() => {});
              })
              .catch(() => {});

            // Optionally, send an email to the admin if configured
            // In a real scenario, integrate with the mail service here
            if (harSettings.notifyAdminEmail && harSettings.adminEmailAddress) {
              logger.info(`Would send Hardware at Risk email notification to ${harSettings.adminEmailAddress}`);
            }
          } else if (!atRisk && charger.isHardwareAtRisk) {
            // Recovered
            await prisma.charger.update({
              where: { charger_id: charger.charger_id },
              data: { isHardwareAtRisk: false }
            });
            logger.info(`Hardware at Risk resolved for charger ${charger.charger_id}`);
          }
        }
      }

    } catch (error) {
      logger.error(`Error in auto-heal cron: ${error}`);
    }
  });
}
