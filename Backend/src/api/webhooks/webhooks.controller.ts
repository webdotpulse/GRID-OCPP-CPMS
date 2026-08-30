import { Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { AuthRequest } from "../../middleware/auth.js";
import { WebhookService, SUPPORTED_WEBHOOK_EVENTS } from "../../services/WebhookService.js";
import { AuditLogService } from "../../services/AuditLogService.js";

/**
 * GET /api/webhooks - List webhook subscriptions with delivery metrics
 */
export const getWebhooks = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.userRole;
    const userId = req.userId;

    const where: any = {};

    // Non-superadmin is scoped by company if available
    if (userRole !== "superadmin" && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.companyId) {
        where.companyId = user.companyId;
      } else {
        where.userId = userId;
      }
    }

    const subscriptions = await prisma.webhookSubscription.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        _count: {
          select: {
            deliveries: true,
          },
        },
        deliveries: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            event: true,
            status: true,
            responseCode: true,
            responseDurationMs: true,
            createdAt: true,
            error: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error: any) {
    logger.error(`Error in getWebhooks: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to fetch webhooks" });
  }
};

/**
 * GET /api/webhooks/events - Get catalog of supported event topics
 */
export const getWebhookEvents = async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    data: SUPPORTED_WEBHOOK_EVENTS,
  });
};

/**
 * GET /api/webhooks/:id - Get single webhook details
 */
export const getWebhookById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid webhook ID" });
    }

    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        deliveries: {
          take: 50,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: "Webhook subscription not found" });
    }

    return res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    logger.error(`Error in getWebhookById: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to fetch webhook" });
  }
};

/**
 * POST /api/webhooks - Create a new webhook subscription
 */
export const createWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const { name, targetUrl, events, secret, isActive, customHeaders, companyId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Webhook name is required" });
    }

    if (!targetUrl || !targetUrl.trim()) {
      return res.status(400).json({ success: false, error: "Target URL is required" });
    }

    try {
      const parsedUrl = new URL(targetUrl.trim());
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res.status(400).json({ success: false, error: "Target URL must start with http:// or https://" });
      }
    } catch {
      return res.status(400).json({ success: false, error: "Invalid Target URL format" });
    }

    const selectedEvents = Array.isArray(events) && events.length > 0 ? events : ["*"];
    const generatedSecret = secret && secret.trim() ? secret.trim() : WebhookService.generateSecret();

    let targetCompanyId: number | null = null;
    if (companyId) {
      targetCompanyId = parseInt(String(companyId), 10);
    } else if (req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.companyId) targetCompanyId = user.companyId;
    }

    const subscription = await prisma.webhookSubscription.create({
      data: {
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        secret: generatedSecret,
        events: selectedEvents,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        customHeaders: customHeaders && typeof customHeaders === "object" ? customHeaders : undefined,
        companyId: targetCompanyId,
        userId: req.userId || null,
      },
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "WEBHOOK_SUBSCRIPTION_CREATE",
      target: "WebhookSubscription",
      targetId: subscription.id,
      payload: { name: subscription.name, targetUrl: subscription.targetUrl, events: selectedEvents },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.status(201).json({
      success: true,
      data: subscription,
      message: `Webhook "${subscription.name}" configured successfully`,
    });
  } catch (error: any) {
    logger.error(`Error in createWebhook: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to create webhook" });
  }
};

/**
 * PUT /api/webhooks/:id - Update webhook subscription
 */
export const updateWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid webhook ID" });
    }

    const existing = await prisma.webhookSubscription.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Webhook subscription not found" });
    }

    const { name, targetUrl, events, isActive, customHeaders, companyId } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (targetUrl) {
      try {
        const parsedUrl = new URL(targetUrl.trim());
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return res.status(400).json({ success: false, error: "Target URL must start with http:// or https://" });
        }
        updateData.targetUrl = targetUrl.trim();
      } catch {
        return res.status(400).json({ success: false, error: "Invalid Target URL format" });
      }
    }
    if (Array.isArray(events)) updateData.events = events;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (customHeaders !== undefined) updateData.customHeaders = customHeaders;
    if (companyId !== undefined) updateData.companyId = companyId ? parseInt(String(companyId), 10) : null;

    const updated = await prisma.webhookSubscription.update({
      where: { id },
      data: updateData,
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "WEBHOOK_SUBSCRIPTION_UPDATE",
      target: "WebhookSubscription",
      targetId: id,
      payload: updateData,
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      data: updated,
      message: `Webhook "${updated.name}" updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Error in updateWebhook: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to update webhook" });
  }
};

/**
 * DELETE /api/webhooks/:id - Delete webhook subscription
 */
export const deleteWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid webhook ID" });
    }

    const existing = await prisma.webhookSubscription.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Webhook subscription not found" });
    }

    await prisma.webhookSubscription.delete({ where: { id } });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "WEBHOOK_SUBSCRIPTION_DELETE",
      target: "WebhookSubscription",
      targetId: id,
      payload: { name: existing.name, targetUrl: existing.targetUrl },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      message: `Webhook "${existing.name}" deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Error in deleteWebhook: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to delete webhook" });
  }
};

/**
 * POST /api/webhooks/:id/test - Send diagnostic test ping
 */
export const testPingWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid webhook ID" });
    }

    const result = await WebhookService.testPing(id);

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "WEBHOOK_TEST_PING",
      target: "WebhookSubscription",
      targetId: id,
      payload: { resultStatus: result.status, responseCode: result.responseCode, durationMs: result.responseDurationMs },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      data: result,
      message: result.status === "Success"
        ? `Test ping delivered successfully (HTTP ${result.responseCode} in ${result.responseDurationMs}ms)`
        : `Test ping failed: ${result.error || `HTTP ${result.responseCode}`}`,
    });
  } catch (error: any) {
    logger.error(`Error in testPingWebhook: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to trigger test ping" });
  }
};

/**
 * POST /api/webhooks/:id/rotate-secret - Rotate HMAC secret
 */
export const rotateWebhookSecret = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid webhook ID" });
    }

    const newSecret = WebhookService.generateSecret();

    const updated = await prisma.webhookSubscription.update({
      where: { id },
      data: { secret: newSecret },
    });

    await AuditLogService.recordLog({
      userId: req.userId || null,
      action: "WEBHOOK_SECRET_ROTATE",
      target: "WebhookSubscription",
      targetId: id,
      payload: { rotated: true },
      ip: (req.headers["x-forwarded-for"] as string) || req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({
      success: true,
      data: { secret: updated.secret },
      message: "Webhook HMAC signing secret rotated successfully",
    });
  } catch (error: any) {
    logger.error(`Error in rotateWebhookSecret: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to rotate secret" });
  }
};

/**
 * GET /api/webhooks/:id/deliveries - Query delivery log history
 */
export const getWebhookDeliveries = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid webhook ID" });
    }

    const { status, limit, offset } = req.query;
    const where: any = { subscriptionId: id };

    if (status && status !== "all") {
      where.status = String(status);
    }

    const take = limit ? parseInt(String(limit), 10) : 50;
    const skip = offset ? parseInt(String(offset), 10) : 0;

    const [total, deliveries] = await Promise.all([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
    ]);

    return res.json({
      success: true,
      data: deliveries,
      total,
      limit: take,
      offset: skip,
    });
  } catch (error: any) {
    logger.error(`Error in getWebhookDeliveries: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to fetch webhook deliveries" });
  }
};

/**
 * POST /api/webhooks/deliveries/:deliveryId/retry - Retry past failed delivery
 */
export const retryWebhookDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const deliveryId = parseInt(String(req.params.deliveryId), 10);
    if (isNaN(deliveryId)) {
      return res.status(400).json({ success: false, error: "Invalid delivery ID" });
    }

    const result = await WebhookService.retryDelivery(deliveryId);

    return res.json({
      success: true,
      data: result,
      message: result.status === "Success"
        ? `Delivery re-dispatched successfully (HTTP ${result.responseCode})`
        : `Retry attempt failed: ${result.error || `HTTP ${result.responseCode}`}`,
    });
  } catch (error: any) {
    logger.error(`Error in retryWebhookDelivery: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to retry delivery" });
  }
};
