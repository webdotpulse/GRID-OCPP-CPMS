import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { MollieService } from "../../services/MollieService.js";
import { PaymentStatus } from "@mollie/api-client";
import { AuthRequest } from "../../middleware/auth.js";

/**
 * Creates a Mollie payment and initiates a PaymentTransaction record.
 */
export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  const companyId = req.body.companyId ? parseInt(req.body.companyId, 10) : (req.userRole !== "superadmin" ? (await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } }))?.companyId || null : null);

  try {
    const isConfigured = await MollieService.isConfigured(companyId);
    if (!isConfigured) {
      return res.status(501).json({
        success: false,
        message: "Payment integration is not configured. Missing Mollie API Key.",
      });
    }

    const { amount, currency = "EUR", transactionId } = req.body;

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

    // Amount must be a string with 2 decimal places for Mollie
    const amountStr = parsedAmount.toFixed(2);

    const client = await MollieService.getClient(companyId);

    // Create a Payment in Mollie
    const payment = await client.payments.create({
      amount: {
        value: amountStr,
        currency: currency.toUpperCase(),
      },
      description: `Order ${transactionId}`,
      redirectUrl: `${req.headers.origin || process.env.FRONTEND_URL}/payments?success=true`,
      webhookUrl: `${process.env.BACKEND_URL}/api/payments/webhook${companyId ? `?companyId=${companyId}` : ''}`,
      metadata: {
        transactionId: transactionId,
      },
    });

    // Save initial transaction in database
    await prisma.paymentTransaction.create({
      data: {
        transactionId: transactionId,
        provider: "mollie",
        paymentIntentId: payment.id,
        amount: parsedAmount,
        currency: currency.toUpperCase(),
        status: "pending",
      }
    });

    res.json({
      success: true,
      data: {
         checkoutUrl: payment._links.checkout?.href,
      }
    });
  } catch (error: any) {
    logger.error("Error creating payment intent", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment intent",
      error: error.message
    });
  }
};

/**
 * Handles incoming payment webhooks from Mollie.
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const paymentId = req.body.id;
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : null;

  if (!paymentId) {
      return res.status(400).send('Missing payment ID');
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

    let status = 'pending';
    if (payment.status === PaymentStatus.paid) {
        status = 'succeeded';
    } else if (payment.status === PaymentStatus.failed || payment.status === PaymentStatus.canceled || payment.status === PaymentStatus.expired) {
        status = 'failed';
    }

    await prisma.paymentTransaction.updateMany({
        where: { paymentIntentId: payment.id },
        data: { status }
    });

    logger.info(`Payment intent ${payment.id} updated to ${status}`);

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  } catch (err: any) {
    logger.error(`Webhook handling failed: ${err.message}`);
    return res.status(500).send(`Webhook Error: ${err.message}`);
  }
};

/**
 * Handles generating a refund for a payment.
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

    const isConfigured = await MollieService.isConfigured(resolvedCompanyId);
    if (!isConfigured) {
      return res.status(501).json({
        success: false,
        message: "Payment integration is not configured.",
      });
    }

    const amountStr = parsedAmount.toFixed(2);
    const refund = await MollieService.generateRefund(paymentId.trim(), amountStr, resolvedCompanyId);

    logger.info(`Refund generated for payment ${paymentId} by user ${req.userId}: ${amountStr} EUR`);
    res.json({
      success: true,
      data: refund
    });
  } catch (error: any) {
    logger.error(`Failed to handle refund for payment ${paymentId}`, error);
    res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message
    });
  }
};

