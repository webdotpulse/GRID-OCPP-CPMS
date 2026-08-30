import crypto from "crypto";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface WebhookEventDefinition {
  topic: string;
  name: string;
  category: "Transactions" | "Chargers & Hardware" | "Tariffs & Energy" | "Invoices & Billing" | "Alerts & Security";
  description: string;
  samplePayload: Record<string, any>;
}

export const SUPPORTED_WEBHOOK_EVENTS: WebhookEventDefinition[] = [
  {
    topic: "transaction.started",
    name: "Charging Session Started",
    category: "Transactions",
    description: "Fired when an EV plugs in and authorization succeeds, creating an active charging transaction.",
    samplePayload: {
      transactionId: 10482,
      chargerId: 101,
      chargerName: "ALFEN-EVE-01",
      connectorId: 1,
      idTag: "04A1B2C3D4E5F6",
      meterStart: 142500,
      timestamp: "2026-08-30T23:15:00.000Z",
    },
  },
  {
    topic: "transaction.stopped",
    name: "Charging Session Completed",
    category: "Transactions",
    description: "Fired when an EV charging session finishes, with final meter reading, energy consumed (kWh), and calculated cost.",
    samplePayload: {
      transactionId: 10482,
      chargerId: 101,
      chargerName: "ALFEN-EVE-01",
      connectorId: 1,
      idTag: "04A1B2C3D4E5F6",
      meterStart: 142500,
      meterStop: 165300,
      totalEnergyKwh: 22.8,
      totalCost: 8.44,
      stopReason: "EVDisconnected",
      durationMinutes: 45,
      timestamp: "2026-08-30T23:45:00.000Z",
    },
  },
  {
    topic: "charger.booted",
    name: "Charger Boot Notification",
    category: "Chargers & Hardware",
    description: "Fired when a charge point connects and completes its OCPP BootNotification handshake.",
    samplePayload: {
      chargerId: 101,
      chargerName: "ALFEN-EVE-01",
      model: "Eve Single Pro-line",
      vendor: "Alfen",
      firmwareVersion: "6.2.0-4122",
      stationId: 5,
      timestamp: "2026-08-30T23:00:00.000Z",
    },
  },
  {
    topic: "charger.status_changed",
    name: "EVSE Connector Status Changed",
    category: "Chargers & Hardware",
    description: "Fired on connector status transitions (e.g. Available, Preparing, Charging, SuspendedEV, Finishing).",
    samplePayload: {
      chargerId: 101,
      connectorId: 1,
      previousStatus: "Available",
      currentStatus: "Charging",
      errorCode: "NoError",
      timestamp: "2026-08-30T23:15:02.000Z",
    },
  },
  {
    topic: "connector.faulted",
    name: "Connector Hardware Fault",
    category: "Alerts & Security",
    description: "Critical alert fired when an EVSE connector reports a hardware fault or error code.",
    samplePayload: {
      chargerId: 101,
      connectorId: 1,
      errorCode: "GroundFailure",
      vendorErrorCode: "ERR_GROUND_ISOLATION_LOST",
      info: "Ground isolation drop detected on phase L1",
      timestamp: "2026-08-30T23:16:30.000Z",
    },
  },
  {
    topic: "tariff.updated",
    name: "Tariff Rates Updated",
    category: "Tariffs & Energy",
    description: "Fired when charging pricing schemes or EPEX dynamic multiplier formulas are modified.",
    samplePayload: {
      tariffId: 3,
      tariffName: "Public Fast Charging Standard",
      pricingType: "dynamic_epex",
      energyFee: 0.38,
      connectionFee: 1.5,
      idleFee: 0.05,
      updatedAt: "2026-08-30T23:10:00.000Z",
    },
  },
  {
    topic: "invoice.issued",
    name: "Monthly Billing Invoice Issued",
    category: "Invoices & Billing",
    description: "Fired when an automated monthly B2B invoice or consumer settlement is finalized.",
    samplePayload: {
      invoiceId: 54,
      invoiceNumber: "INV-2026-08-0054",
      companyId: 2,
      recipientName: "Acme Logistics BV",
      totalAmount: 1482.5,
      vatAmount: 257.25,
      currency: "EUR",
      dueDate: "2026-09-14T00:00:00.000Z",
      timestamp: "2026-08-30T23:00:00.000Z",
    },
  },
  {
    topic: "alert.hardware_at_risk",
    name: "Hardware at Risk Alert",
    category: "Alerts & Security",
    description: "Fired when automated diagnostics detect consecutive failures or prolonged offline status on hardware.",
    samplePayload: {
      chargerId: 101,
      chargerName: "ALFEN-EVE-01",
      consecutiveErrors: 6,
      reason: "Consecutive critical errors exceeded threshold",
      autoHealAttempted: true,
      timestamp: "2026-08-30T23:20:00.000Z",
    },
  },
  {
    topic: "webhook.test_ping",
    name: "Webhook Test Ping",
    category: "Alerts & Security",
    description: "Diagnostic test event dispatched to verify endpoint reachability and cryptographic signature verification.",
    samplePayload: {
      pingId: "ping_99a8182747",
      message: "GRID-OCPP-CPMS Webhook connection operational.",
      timestamp: "2026-08-30T23:15:00.000Z",
    },
  },
];

export class WebhookService {
  /**
   * Return catalog of supported webhook events
   */
  public static getEventCatalog(): WebhookEventDefinition[] {
    return SUPPORTED_WEBHOOK_EVENTS;
  }

  /**
   * Generate secure cryptographically random HMAC secret
   */
  public static generateSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString("hex")}`;
  }

  /**
   * Compute HMAC-SHA256 signature for payload
   */
  public static computeSignature(payloadString: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
  }

  /**
   * Dispatch an event to all active matching webhook subscriptions
   */
  public static async dispatch(event: string, payload: any, companyId?: number | null): Promise<void> {
    try {
      // Find matching active subscriptions
      const whereClause: any = {
        isActive: true,
      };

      if (companyId) {
        whereClause.OR = [{ companyId }, { companyId: null }];
      }

      const subscriptions = await prisma.webhookSubscription.findMany({
        where: whereClause,
      });

      if (!subscriptions || subscriptions.length === 0) {
        return;
      }

      const matchingSubs = subscriptions.filter((sub) => {
        const events = Array.isArray(sub.events) ? (sub.events as string[]) : [];
        return events.includes("*") || events.includes(event) || events.some((e) => e.endsWith(".*") && event.startsWith(e.slice(0, -2)));
      });

      if (matchingSubs.length === 0) {
        return;
      }

      logger.info(`[WebhookService] Dispatching event "${event}" to ${matchingSubs.length} active subscription(s)`);

      // Dispatch to each subscription asynchronously without blocking caller
      for (const sub of matchingSubs) {
        this.sendWebhookPayload(sub, event, payload).catch((err) => {
          logger.error(`[WebhookService] Error sending to subscription #${sub.id} (${sub.targetUrl}): ${err.message}`);
        });
      }
    } catch (error: any) {
      logger.error(`[WebhookService] Dispatch error for event "${event}": ${error.message}`);
    }
  }

  /**
   * Execute single outbound HTTP POST request to target endpoint
   */
  public static async sendWebhookPayload(subscription: any, event: string, payloadData: any): Promise<any> {
    const eventId = `evt_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const formattedPayload = {
      id: eventId,
      event,
      createdAt: timestamp,
      data: payloadData,
    };

    const payloadString = JSON.stringify(formattedPayload);
    const signatureHex = this.computeSignature(payloadString, subscription.secret);

    // Build headers
    const customHeaders = subscription.customHeaders && typeof subscription.customHeaders === "object" ? subscription.customHeaders : {};
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GRID-OCPP-CPMS-Webhooks/1.0",
      "X-CPMS-Event": event,
      "X-CPMS-Delivery": eventId,
      "X-CPMS-Timestamp": timestamp,
      "X-CPMS-Signature-256": `sha256=${signatureHex}`,
      ...customHeaders,
    };

    // Create delivery record in database
    const delivery = await prisma.webhookDelivery.create({
      data: {
        subscriptionId: subscription.id,
        event,
        payload: formattedPayload as any,
        requestHeaders: requestHeaders as any,
        status: "Pending",
        attempts: 1,
      },
    });

    const startTime = Date.now();
    let responseCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let isSuccess = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(subscription.targetUrl, {
        method: "POST",
        headers: requestHeaders,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseCode = response.status;
      const text = await response.text();
      responseBody = text.slice(0, 4000); // Cap response body to 4KB

      if (response.ok) {
        isSuccess = true;
      } else {
        errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        errorMessage = "Request timed out after 8000ms";
        responseCode = 408;
      } else {
        errorMessage = err.message || "Failed to reach target URL";
        responseCode = 502;
      }
    }

    const durationMs = Date.now() - startTime;
    const finalStatus = isSuccess ? "Success" : "Failed";

    // Update delivery record
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: finalStatus,
        responseCode,
        responseBody,
        responseDurationMs: durationMs,
        error: errorMessage,
        deliveredAt: new Date(),
      },
    });

    // Update subscription statistics
    await prisma.webhookSubscription.update({
      where: { id: subscription.id },
      data: {
        lastTriggeredAt: new Date(),
        lastStatusCode: responseCode,
        failureCount: isSuccess ? 0 : { increment: 1 },
      },
    });

    return {
      deliveryId: delivery.id,
      status: finalStatus,
      responseCode,
      responseDurationMs: durationMs,
      error: errorMessage,
      responseBody,
    };
  }

  /**
   * Send a test ping event to verify subscription reachability
   */
  public static async testPing(subscriptionId: number): Promise<any> {
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error(`Webhook subscription #${subscriptionId} not found`);
    }

    const testPayload = {
      pingId: `ping_${crypto.randomBytes(8).toString("hex")}`,
      subscriptionId: subscription.id,
      subscriptionName: subscription.name,
      message: "GRID-OCPP-CPMS webhook test ping verified successfully.",
      timestamp: new Date().toISOString(),
    };

    return await this.sendWebhookPayload(subscription, "webhook.test_ping", testPayload);
  }

  /**
   * Re-attempt delivery of a past failed event
   */
  public static async retryDelivery(deliveryId: number): Promise<any> {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscription: true },
    });

    if (!delivery) {
      throw new Error(`Webhook delivery #${deliveryId} not found`);
    }

    const subscription = delivery.subscription;
    if (!subscription) {
      throw new Error(`Associated subscription for delivery #${deliveryId} no longer exists`);
    }

    const payloadData = (delivery.payload as any)?.data || delivery.payload;
    return await this.sendWebhookPayload(subscription, delivery.event, payloadData);
  }
}
