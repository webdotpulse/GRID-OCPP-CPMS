import { Router } from "express";
import {
  createPaymentIntent,
  handleWebhook,
  handleStripeWebhook,
  handleRefund,
} from "./payments.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

// Routes for payment integration
router.post("/intent", authenticateToken, createPaymentIntent);
router.post("/refund", authenticateToken, requireAdmin, handleRefund);

// Mollie webhook callback
router.post("/webhook", handleWebhook);
router.post("/webhook/mollie", handleWebhook);

// Stripe webhook callback
router.post("/webhook/stripe", handleStripeWebhook);

export default router;
