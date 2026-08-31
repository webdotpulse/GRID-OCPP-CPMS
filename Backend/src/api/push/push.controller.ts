import { Request, Response } from "express";
import { WebPushService } from "../../services/WebPushService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/push/vapid-public-key - Get VAPID public key for web push subscription
 */
export const getVapidPublicKey = async (req: Request, res: Response) => {
  try {
    const publicKey = await WebPushService.getVapidPublicKey();
    res.json({ success: true, data: { publicKey } });
  } catch (error) {
    logger.error(`Error getting VAPID key: ${error}`);
    res.status(500).json({ success: false, error: "Failed to get VAPID key" });
  }
};

/**
 * POST /api/push/subscribe - Register device push subscription
 */
export const subscribePush = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId attached by authenticateToken
    const userId = req.userId || (req.body.userId ? Number(req.body.userId) : 1);
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, error: "Invalid subscription object (endpoint and keys required)" });
    }

    const subscription = await WebPushService.subscribe(userId, { endpoint, keys });
    res.status(201).json({ success: true, data: subscription });
  } catch (error) {
    logger.error(`Error saving push subscription: ${error}`);
    res.status(500).json({ success: false, error: "Failed to save push subscription" });
  }
};

/**
 * POST /api/push/unsubscribe - Unsubscribe device endpoint
 */
export const unsubscribePush = async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: "Endpoint is required" });
    }

    await WebPushService.unsubscribe(endpoint);
    res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (error) {
    logger.error(`Error unsubscribing push: ${error}`);
    res.status(500).json({ success: false, error: "Failed to unsubscribe" });
  }
};

/**
 * POST /api/push/test - Dispatch test notification to logged in user
 */
export const sendTestPush = async (req: Request, res: Response) => {
  try {
    // @ts-expect-error userId attached by authenticateToken
    const userId = req.userId || (req.body.userId ? Number(req.body.userId) : 1);
    const { title, body } = req.body;

    const result = await WebPushService.sendNotificationToUser(userId, {
      title: title || "🔔 GRID CPMS Notification",
      body: body || "Web Push Notifications are active and connected to your charging account!",
      url: "/mobile/dashboard",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error sending test push: ${error}`);
    res.status(500).json({ success: false, error: "Failed to send test push" });
  }
};
