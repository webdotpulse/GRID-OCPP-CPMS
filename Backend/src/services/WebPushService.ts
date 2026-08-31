import webpush from "web-push";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export class WebPushService {
  private static vapidKeysInitialized = false;
  private static vapidPublicKey: string = "";
  private static vapidPrivateKey: string = "";

  /**
   * Initialize VAPID Keys from system setting or environment or generate
   */
  public static async initVapidKeys(): Promise<{ publicKey: string }> {
    if (this.vapidKeysInitialized) {
      return { publicKey: this.vapidPublicKey };
    }

    try {
      const pubSetting = await prisma.systemSetting.findUnique({ where: { key: "VAPID_PUBLIC_KEY" } });
      const privSetting = await prisma.systemSetting.findUnique({ where: { key: "VAPID_PRIVATE_KEY" } });

      if (pubSetting?.value && privSetting?.value) {
        this.vapidPublicKey = pubSetting.value;
        this.vapidPrivateKey = privSetting.value;
      } else {
        const generated = webpush.generateVAPIDKeys();
        this.vapidPublicKey = generated.publicKey;
        this.vapidPrivateKey = generated.privateKey;

        await prisma.systemSetting.upsert({
          where: { key: "VAPID_PUBLIC_KEY" },
          update: { value: this.vapidPublicKey },
          create: { key: "VAPID_PUBLIC_KEY", value: this.vapidPublicKey },
        });

        await prisma.systemSetting.upsert({
          where: { key: "VAPID_PRIVATE_KEY" },
          update: { value: this.vapidPrivateKey },
          create: { key: "VAPID_PRIVATE_KEY", value: this.vapidPrivateKey },
        });
      }

      webpush.setVapidDetails(
        "mailto:admin@grid-cpms.internal",
        this.vapidPublicKey,
        this.vapidPrivateKey
      );

      this.vapidKeysInitialized = true;
      logger.info("[WebPush] VAPID details configured successfully");
      return { publicKey: this.vapidPublicKey };
    } catch (err) {
      logger.error(`[WebPush] Error initializing VAPID keys: ${err}`);
      // Fallback in-memory generated key for tests/offline
      const fallback = webpush.generateVAPIDKeys();
      this.vapidPublicKey = fallback.publicKey;
      this.vapidPrivateKey = fallback.privateKey;
      webpush.setVapidDetails("mailto:admin@grid-cpms.internal", this.vapidPublicKey, this.vapidPrivateKey);
      this.vapidKeysInitialized = true;
      return { publicKey: this.vapidPublicKey };
    }
  }

  public static async getVapidPublicKey(): Promise<string> {
    const { publicKey } = await this.initVapidKeys();
    return publicKey;
  }

  /**
   * Subscribe user device for Push notifications
   */
  public static async subscribe(userId: number, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    await this.initVapidKeys();

    return await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  /**
   * Unsubscribe endpoint
   */
  public static async unsubscribe(endpoint: string) {
    return await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }

  /**
   * Send push notification to a specific user across all their devices
   */
  public static async sendNotificationToUser(userId: number, payload: PushNotificationPayload): Promise<{ successCount: number; failureCount: number }> {
    await this.initVapidKeys();

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      logger.debug(`[WebPush] No push subscriptions found for user ${userId}`);
      return { successCount: 0, failureCount: 0 };
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/badge-72x72.png",
      data: {
        url: payload.url || "/mobile/dashboard",
        ...(payload.data || {}),
      },
      tag: payload.tag || "cpms-driver-alert",
    });

    let successCount = 0;
    let failureCount = 0;

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription as any, payloadString);
        successCount++;
      } catch (err: any) {
        failureCount++;
        logger.warn(`[WebPush] Error dispatching push to ${sub.endpoint}: ${err.statusCode || err.message}`);
        // 410 Gone or 404 Not Found indicates expired subscription -> cleanup
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    logger.info(`[WebPush] Dispatched push to user ${userId} (Success: ${successCount}, Failures: ${failureCount})`);
    return { successCount, failureCount };
  }

  // --- Push Trigger Milestones ---

  /**
   * 80% SoC Reached Milestone
   */
  public static async sendSoc80Notification(userId: number, chargerName: string, soc: number = 80) {
    return await this.sendNotificationToUser(userId, {
      title: "🔋 Battery Reached 80% SoC",
      body: `Your vehicle at ${chargerName} reached ${soc}% SoC. Fast DC charging speeds may now taper off.`,
      url: "/mobile/dashboard",
      tag: "soc-milestone-80",
    });
  }

  /**
   * Charging Session Complete
   */
  public static async sendChargingCompleteNotification(userId: number, chargerName: string, totalKwh: number, totalCostEuro?: number) {
    const costText = totalCostEuro !== undefined ? ` • Total: €${totalCostEuro.toFixed(2)}` : "";
    return await this.sendNotificationToUser(userId, {
      title: "⚡ Charging Completed",
      body: `Charging at ${chargerName} finished (${totalKwh.toFixed(1)} kWh delivered${costText}). Ready for departure!`,
      url: "/mobile/dashboard",
      tag: "charging-complete",
    });
  }

  /**
   * Idle Fee Alert (15 minutes warning before idle fee applies)
   */
  public static async sendIdleFeeAlertNotification(userId: number, chargerName: string, idleFeeRatePerMin?: number) {
    const rateText = idleFeeRatePerMin ? ` (€${idleFeeRatePerMin.toFixed(2)}/min)` : "";
    return await this.sendNotificationToUser(userId, {
      title: "⚠️ Idle Fee Alert in 15 Minutes",
      body: `Your charging session at ${chargerName} is completed. Please unplug and move your vehicle to avoid idle fees${rateText}.`,
      url: "/mobile/dashboard",
      tag: "idle-fee-warning",
    });
  }

  /**
   * Solar Green Energy Boost Active
   */
  public static async sendSolarBoostNotification(userId: number, chargerName: string, solarKw: number) {
    return await this.sendNotificationToUser(userId, {
      title: "☀️ Solar Energy Boost Active",
      body: `Surplus solar power (${solarKw.toFixed(1)} kW) detected at ${chargerName}. Charging boosted at zero marginal cost!`,
      url: "/mobile/dashboard",
      tag: "solar-boost",
    });
  }
}
