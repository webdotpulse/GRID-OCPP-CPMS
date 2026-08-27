import Stripe from "stripe";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export class StripeService {
  /**
   * Retrieves the initialized Stripe client for a specific company or the default/env config.
   */
  static async getClient(companyId?: number | null): Promise<Stripe> {
    let secretKey: string | undefined = process.env.STRIPE_SECRET_KEY;

    try {
      const config = await prisma.stripeConfig.findFirst({
        where: { companyId: companyId || null },
      });
      if (config?.secretKey) {
        secretKey = config.secretKey;
      }
    } catch (err: any) {
      logger.debug("Database lookup for StripeConfig skipped or failed, using env fallback", err);
    }

    if (!secretKey) {
      throw new Error("Stripe configuration is not set up. Missing Secret Key.");
    }

    return new Stripe(secretKey);
  }

  /**
   * Retrieves the Stripe configuration for a specific company or the default config.
   */
  static async getConfig(companyId?: number | null) {
    try {
      return await prisma.stripeConfig.findFirst({
        where: { companyId: companyId || null },
      });
    } catch {
      return null;
    }
  }

  /**
   * Checks if a Stripe configuration exists for a specific company or globally.
   */
  static async isConfigured(companyId?: number | null): Promise<boolean> {
    if (!companyId && !!process.env.STRIPE_SECRET_KEY) {
      return true;
    }

    try {
      const count = await prisma.stripeConfig.count({
        where: { companyId: companyId || null },
      });
      return count > 0 || !!process.env.STRIPE_SECRET_KEY;
    } catch {
      return !!process.env.STRIPE_SECRET_KEY;
    }
  }

  /**
   * Creates a hosted Stripe Checkout Session for ad-hoc charging payments.
   */
  static async createCheckoutSession(params: {
    amount: number; // in standard unit, e.g. 10.50 EUR
    currency?: string;
    transactionId: string;
    returnUrl?: string;
    cancelUrl?: string;
    companyId?: number | null;
  }): Promise<{ id: string; url: string | null; paymentIntentId?: string | null }> {
    const client = await this.getClient(params.companyId);
    const currency = (params.currency || "EUR").toLowerCase();
    const amountInCents = Math.round(params.amount * 100);

    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3002";
    const successUrl =
      params.returnUrl ||
      `${frontendBaseUrl}/payments?success=true&session_id={CHECKOUT_SESSION_ID}&transactionId=${params.transactionId}`;
    const cancelUrl =
      params.cancelUrl || `${frontendBaseUrl}/payments?canceled=true&transactionId=${params.transactionId}`;

    const session = await client.checkout.sessions.create({
      payment_method_types: ["card", "ideal", "bancontact", "eps", "sepa_debit"],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `EV Charging Session ${params.transactionId}`,
              description: `Direct ad-hoc charging session settlement`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: params.transactionId,
      metadata: {
        transactionId: params.transactionId,
        companyId: params.companyId ? String(params.companyId) : "",
      },
    });

    return {
      id: session.id,
      url: session.url,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    };
  }

  /**
   * Creates a raw Stripe PaymentIntent (for direct client-side Elements or terminal SDK integration).
   */
  static async createPaymentIntent(params: {
    amount: number; // in standard currency units (e.g. 15.00)
    currency?: string;
    transactionId: string;
    companyId?: number | null;
  }): Promise<Stripe.PaymentIntent> {
    const client = await this.getClient(params.companyId);
    const currency = (params.currency || "EUR").toLowerCase();
    const amountInCents = Math.round(params.amount * 100);

    return await client.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        transactionId: params.transactionId,
        companyId: params.companyId ? String(params.companyId) : "",
      },
    });
  }

  /**
   * Generates a refund for a Stripe PaymentIntent or Charge.
   */
  static async generateRefund(
    paymentIntentId: string,
    amountInStandardUnit?: number,
    companyId?: number | null
  ): Promise<Stripe.Refund> {
    const client = await this.getClient(companyId);

    try {
      let resolvedPaymentIntentId = paymentIntentId;

      // If a Checkout Session ID was provided, resolve its underlying PaymentIntent
      if (paymentIntentId.startsWith("cs_")) {
        const session = await client.checkout.sessions.retrieve(paymentIntentId);
        if (typeof session.payment_intent === "string") {
          resolvedPaymentIntentId = session.payment_intent;
        }
      }

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: resolvedPaymentIntentId,
      };

      if (amountInStandardUnit && amountInStandardUnit > 0) {
        refundParams.amount = Math.round(amountInStandardUnit * 100);
      }

      const refund = await client.refunds.create(refundParams);
      logger.info(`Stripe refund generated for ${resolvedPaymentIntentId}: ${refund.id}`);
      return refund;
    } catch (error: any) {
      logger.error(`Failed to generate Stripe refund for payment ${paymentIntentId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates and constructs a Stripe webhook event from raw body and signature header.
   */
  static async constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    companyId?: number | null
  ): Promise<Stripe.Event> {
    const config = await this.getConfig(companyId);
    const webhookSecret = config?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("Stripe webhook secret is not configured.");
    }

    const client = await this.getClient(companyId);
    return client.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
