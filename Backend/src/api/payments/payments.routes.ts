import { Router } from "express";
import {
  createPaymentIntent,
  handleWebhook,
  handleRefund
} from "./payments.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

// Routes for payment integration
router.post("/intent", authenticateToken, createPaymentIntent);
router.post("/refund", authenticateToken, requireAdmin, handleRefund);

// Mollie webhook sends the ID via a standard form post (unauthenticated for external callbacks)
router.post("/webhook", handleWebhook);

export default router;

