import { Router } from "express";
import {
  getWebhooks,
  getWebhookEvents,
  getWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testPingWebhook,
  rotateWebhookSecret,
  getWebhookDeliveries,
  retryWebhookDelivery,
} from "./webhooks.controller.js";
import { authenticateToken, requireAdmin, requirePermission } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/events", getWebhookEvents as any);
router.get("/", requirePermission("webhooks.manage") as any, getWebhooks as any);
router.get("/:id", requirePermission("webhooks.manage") as any, getWebhookById as any);
router.post("/", requirePermission("webhooks.manage") as any, createWebhook as any);
router.put("/:id", requirePermission("webhooks.manage") as any, updateWebhook as any);
router.delete("/:id", requirePermission("webhooks.manage") as any, deleteWebhook as any);
router.post("/:id/test", requirePermission("webhooks.manage") as any, testPingWebhook as any);
router.post("/:id/rotate-secret", requirePermission("webhooks.manage") as any, rotateWebhookSecret as any);
router.get("/:id/deliveries", requirePermission("webhooks.manage") as any, getWebhookDeliveries as any);
router.post("/deliveries/:deliveryId/retry", requirePermission("webhooks.manage") as any, retryWebhookDelivery as any);

export default router;
