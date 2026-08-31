import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { MollieService } from "../../services/MollieService.js";
import { StripeService } from "../../services/StripeService.js";
import { PaymentStatus } from "@mollie/api-client";
import { AuthRequest } from "../../middleware/auth.js";

/**
 * Creates a payment checkout session (via Stripe or Mollie) and initiates a PaymentTransaction record.
 */
export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  const companyId = req.body.companyId
    ? parseInt(req.body.companyId, 10)
    : req.userRole !== "superadmin"
    ? (await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } }))?.companyId || null
    : null;

  try {
    const { amount, currency = "EUR", transactionId, provider = "stripe" } = req.body;

    if (!amount || !transactionId) {
      return res.status(400).json({
        success: false,
        message: "amount and transactionId are required",
      });
    }

    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

    const selectedProvider = provider?.toLowerCase() === "mollie" ? "mollie" : "stripe";

    if (selectedProvider === "stripe") {
      const isStripeConfigured = await StripeService.isConfigured(companyId);
      if (!isStripeConfigured) {
        // Fallback to Mollie if Stripe is not configured but Mollie is
        const isMollieConfigured = await MollieService.isConfigured(companyId);
        if (isMollieConfigured) {
          return createMolliePayment(req, res, parsedAmount, currency, transactionId, companyId);
        }
        return res.status(501).json({
          success: false,
          message: "Payment integration is not configured. Missing Stripe or Mollie API keys.",
        });
      }

      const session = await StripeService.createCheckoutSession({
        amount: parsedAmount,
        currency: currency.toUpperCase(),
        transactionId: transactionId,
        companyId: companyId,
      });

      // Save initial transaction in database
      await prisma.paymentTransaction.create({
        data: {
          transactionId: transactionId,
          provider: "stripe",
          paymentIntentId: session.id,
          amount: parsedAmount,
          currency: currency.toUpperCase(),
          status: "pending",
        },
      });

      return res.json({
        success: true,
        data: {
          checkoutUrl: session.url,
          sessionId: session.id,
          provider: "stripe",
        },
      });
    } else {
      return createMolliePayment(req, res, parsedAmount, currency, transactionId, companyId);
    }
  } catch (error: any) {
    logger.error("Error creating payment intent", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment intent",
      error: error.message,
    });
  }
};

/**
 * Internal helper for Mollie payment initialization.
 */
async function createMolliePayment(
  req: Request,
  res: Response,
  parsedAmount: number,
  currency: string,
  transactionId: string,
  companyId: number | null
) {
  const isConfigured = await MollieService.isConfigured(companyId);
  if (!isConfigured) {
    return res.status(501).json({
      success: false,
      message: "Payment integration is not configured. Missing Mollie API Key.",
    });
  }

  const amountStr = parsedAmount.toFixed(2);
  const client = await MollieService.getClient(companyId);

  const payment = await client.payments.create({
    amount: {
      value: amountStr,
      currency: currency.toUpperCase(),
    },
    description: `EV Charging Session ${transactionId}`,
    redirectUrl: `${req.headers.origin || process.env.FRONTEND_URL || "http://localhost:3002"}/payments?success=true&transactionId=${transactionId}`,
    webhookUrl: `${process.env.BACKEND_URL || "http://localhost:3000"}/api/payments/webhook${companyId ? `?companyId=${companyId}` : ""}`,
    metadata: {
      transactionId: transactionId,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      transactionId: transactionId,
      provider: "mollie",
      paymentIntentId: payment.id,
      amount: parsedAmount,
      currency: currency.toUpperCase(),
      status: "pending",
    },
  });

  return res.json({
    success: true,
    data: {
      checkoutUrl: payment._links.checkout?.href,
      paymentId: payment.id,
      provider: "mollie",
    },
  });
}

/**
 * Handles incoming payment webhooks from Mollie.
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const paymentId = req.body.id;
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : null;

  if (!paymentId) {
    return res.status(400).send("Missing payment ID");
  }

  try {
    const isConfigured = await MollieService.isConfigured(companyId);
    if (!isConfigured) {
      return res.status(501).json({
        success: false,
        message: "Payment integration is not configured.",
      });
    }

    const client = await MollieService.getClient(companyId);
    const payment = await client.payments.get(paymentId);

    let status = "pending";
    if (payment.status === PaymentStatus.paid) {
      status = "succeeded";
    } else if (
      payment.status === PaymentStatus.failed ||
      payment.status === PaymentStatus.canceled ||
      payment.status === PaymentStatus.expired
    ) {
      status = "failed";
    }

    await prisma.paymentTransaction.updateMany({
      where: { paymentIntentId: payment.id },
      data: { status },
    });

    logger.info(`Mollie payment intent ${payment.id} updated to ${status}`);
    res.send();
  } catch (err: any) {
    logger.error(`Mollie webhook handling failed: ${err.message}`);
    return res.status(500).send(`Webhook Error: ${err.message}`);
  }
};

/**
 * Handles incoming payment webhooks from Stripe.
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : null;
  const payload = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

  let event: any;

  try {
    if (!sig) {
      if (process.env.NODE_ENV === "production") {
        logger.error("Stripe webhook rejected: Missing stripe-signature header in production");
        return res.status(400).send("Webhook Error: Missing stripe-signature header");
      }
      event = req.body;
    } else {
      event = await StripeService.constructWebhookEvent(payload, sig, companyId);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const transactionId = session.client_reference_id || session.metadata?.transactionId;

        if (transactionId) {
          await prisma.paymentTransaction.updateMany({
            where: {
              OR: [{ transactionId: transactionId }, { paymentIntentId: session.id }],
            },
            data: {
              status: "succeeded",
              paymentIntentId: session.payment_intent ? String(session.payment_intent) : session.id,
            },
          });
        }
        logger.info(`Stripe Checkout Session completed: ${session.id} for transaction ${transactionId}`);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const transactionId = paymentIntent.metadata?.transactionId;

        await prisma.paymentTransaction.updateMany({
          where: {
            OR: [{ paymentIntentId: paymentIntent.id }, ...(transactionId ? [{ transactionId }] : [])],
          },
          data: { status: "succeeded" },
        });
        logger.info(`Stripe PaymentIntent succeeded: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        await prisma.paymentTransaction.updateMany({
          where: { paymentIntentId: paymentIntent.id },
          data: { status: "failed" },
        });
        logger.info(`Stripe PaymentIntent failed: ${paymentIntent.id}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        if (paymentIntentId) {
          await prisma.paymentTransaction.updateMany({
            where: { paymentIntentId: String(paymentIntentId) },
            data: { status: "refunded" },
          });
        }
        logger.info(`Stripe Charge refunded: ${charge.id}`);
        break;
      }

      default:
        logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error(`Stripe Webhook handling failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

/**
 * Handles generating a refund for a payment (Stripe or Mollie).
 */
export const handleRefund = async (req: AuthRequest, res: Response) => {
  const { paymentId, amount, companyId } = req.body;

  if (!paymentId || typeof paymentId !== "string" || !paymentId.trim()) {
    return res.status(400).json({
      success: false,
      message: "paymentId is required and must be a valid string",
    });
  }

  if (amount === undefined || amount === null) {
    return res.status(400).json({
      success: false,
      message: "amount is required",
    });
  }

  const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "amount must be a positive number",
    });
  }

  try {
    let resolvedCompanyId = companyId ? parseInt(companyId, 10) : null;

    if (req.userRole !== "superadmin") {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { companyId: true },
      });

      if (!user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }

      if (resolvedCompanyId && user.companyId && resolvedCompanyId !== user.companyId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot issue refunds for another company",
        });
      }

      resolvedCompanyId = resolvedCompanyId || user.companyId;
    }

    // Find the transaction to identify provider
    const tx = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ paymentIntentId: paymentId.trim() }, { transactionId: paymentId.trim() }],
      },
    });

    const isStripe =
      tx?.provider === "stripe" ||
      paymentId.startsWith("cs_") ||
      paymentId.startsWith("pi_") ||
      paymentId.startsWith("ch_");

    if (isStripe) {
      const isStripeConfigured = await StripeService.isConfigured(resolvedCompanyId);
      if (!isStripeConfigured) {
        return res.status(501).json({
          success: false,
          message: "Stripe payment integration is not configured.",
        });
      }

      const refund = await StripeService.generateRefund(paymentId.trim(), parsedAmount, resolvedCompanyId);
      logger.info(`Stripe refund generated for payment ${paymentId} by user ${req.userId}: ${parsedAmount} EUR`);
      return res.json({
        success: true,
        data: refund,
      });
    } else {
      const isMollieConfigured = await MollieService.isConfigured(resolvedCompanyId);
      if (!isMollieConfigured) {
        return res.status(501).json({
          success: false,
          message: "Mollie payment integration is not configured.",
        });
      }

      const amountStr = parsedAmount.toFixed(2);
      const refund = await MollieService.generateRefund(paymentId.trim(), amountStr, resolvedCompanyId);

      logger.info(`Mollie refund generated for payment ${paymentId} by user ${req.userId}: ${amountStr} EUR`);
      return res.json({
        success: true,
        data: refund,
      });
    }
  } catch (error: any) {
    logger.error(`Failed to handle refund for payment ${paymentId}`, error);
    res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message,
    });
  }
};
