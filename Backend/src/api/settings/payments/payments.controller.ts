import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";
import { StripeService } from "../../../services/StripeService.js";
import { MollieService } from "../../../services/MollieService.js";

export const getMollieConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.mollieConfig.findFirst({
      where: { companyId: null },
    });

    if (config) {
      // Don't send the full API key back to the client for security
      return res.json({
        success: true,
        data: {
          id: config.id,
          profileId: config.profileId,
          testMode: config.testMode,
          hasApiKey: !!config.apiKey,
        },
      });
    }

    res.json({ success: true, data: null });
  } catch (error: any) {
    logger.error("Failed to fetch Mollie config", error);
    res.status(500).json({ success: false, message: "Failed to fetch config" });
  }
};

export const updateMollieConfig = async (req: Request, res: Response) => {
  try {
    const { apiKey, profileId, testMode } = req.body;

    const existingConfig = await prisma.mollieConfig.findFirst({
      where: { companyId: null },
    });

    let config;
    if (existingConfig) {
      config = await prisma.mollieConfig.update({
        where: { id: existingConfig.id },
        data: {
          ...(apiKey ? { apiKey } : {}),
          profileId,
          testMode: typeof testMode === "boolean" ? testMode : existingConfig.testMode,
        },
      });
    } else {
      if (!apiKey) {
        return res.status(400).json({ success: false, message: "API Key is required for initial setup." });
      }
      config = await prisma.mollieConfig.create({
        data: {
          apiKey,
          profileId,
          testMode: typeof testMode === "boolean" ? testMode : true,
        },
      });
    }

    res.json({
      success: true,
      data: { id: config.id, testMode: config.testMode, profileId: config.profileId },
    });
  } catch (error: any) {
    logger.error("Failed to update Mollie config", error);
    res.status(500).json({ success: false, message: "Failed to update config" });
  }
};

export const getStripeConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.stripeConfig.findFirst({
      where: { companyId: null },
    });

    if (config) {
      return res.json({
        success: true,
        data: {
          id: config.id,
          publishableKey: config.publishableKey || "",
          hasSecretKey: !!config.secretKey,
          hasWebhookSecret: !!config.webhookSecret,
          testMode: config.testMode,
        },
      });
    }

    // Also check environment variable fallback
    const hasEnvSecret = !!process.env.STRIPE_SECRET_KEY;
    if (hasEnvSecret) {
      return res.json({
        success: true,
        data: {
          id: 0,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
          hasSecretKey: true,
          hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
          testMode: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"),
        },
      });
    }

    res.json({ success: true, data: null });
  } catch (error: any) {
    logger.error("Failed to fetch Stripe config", error);
    res.status(500).json({ success: false, message: "Failed to fetch Stripe config" });
  }
};

export const updateStripeConfig = async (req: Request, res: Response) => {
  try {
    const { secretKey, publishableKey, webhookSecret, testMode } = req.body;

    const existingConfig = await prisma.stripeConfig.findFirst({
      where: { companyId: null },
    });

    let config;
    if (existingConfig) {
      config = await prisma.stripeConfig.update({
        where: { id: existingConfig.id },
        data: {
          ...(secretKey ? { secretKey } : {}),
          ...(publishableKey !== undefined ? { publishableKey } : {}),
          ...(webhookSecret !== undefined ? { webhookSecret } : {}),
          ...(typeof testMode === "boolean" ? { testMode } : {}),
        },
      });
    } else {
      if (!secretKey) {
        return res.status(400).json({ success: false, message: "Stripe Secret Key is required for initial setup." });
      }
      config = await prisma.stripeConfig.create({
        data: {
          secretKey,
          publishableKey: publishableKey || null,
          webhookSecret: webhookSecret || null,
          testMode: typeof testMode === "boolean" ? testMode : true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: config.id,
        publishableKey: config.publishableKey,
        hasSecretKey: !!config.secretKey,
        hasWebhookSecret: !!config.webhookSecret,
        testMode: config.testMode,
      },
    });
  } catch (error: any) {
    logger.error("Failed to update Stripe config", error);
    res.status(500).json({ success: false, message: "Failed to update Stripe config" });
  }
};

export const getPaymentGatewaysOverview = async (req: Request, res: Response) => {
  try {
    const mollieConfigured = await MollieService.isConfigured(null);
    const stripeConfigured = await StripeService.isConfigured(null);

    const mollie = await prisma.mollieConfig.findFirst({ where: { companyId: null } });
    const stripe = await prisma.stripeConfig.findFirst({ where: { companyId: null } });

    res.json({
      success: true,
      data: {
        gateways: [
          {
            id: "mollie",
            name: "Mollie",
            description: "Ad-hoc checkout via iDEAL, Bancontact, EPS, and European payment methods",
            isConfigured: mollieConfigured,
            testMode: mollie ? mollie.testMode : true,
            hasApiKey: !!mollie?.apiKey,
            profileId: mollie?.profileId || null,
          },
          {
            id: "stripe",
            name: "Stripe",
            description: "Global credit card, Apple Pay, Google Pay, and international digital wallets",
            isConfigured: stripeConfigured,
            testMode: stripe ? stripe.testMode : !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"),
            publishableKey: stripe?.publishableKey || process.env.STRIPE_PUBLISHABLE_KEY || null,
            hasSecretKey: !!stripe?.secretKey || !!process.env.STRIPE_SECRET_KEY,
            hasWebhookSecret: !!stripe?.webhookSecret || !!process.env.STRIPE_WEBHOOK_SECRET,
          },
        ],
      },
    });
  } catch (error: any) {
    logger.error("Failed to fetch payment gateways overview", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment gateways overview" });
  }
};
