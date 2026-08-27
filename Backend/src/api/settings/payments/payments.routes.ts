import { Router } from "express";
import {
  getMollieConfig,
  updateMollieConfig,
  getStripeConfig,
  updateStripeConfig,
  getPaymentGatewaysOverview,
} from "./payments.controller.js";
import { requireAdmin } from "../../../middleware/auth.js";

const router = Router();

router.get("/overview", requireAdmin, getPaymentGatewaysOverview);
router.get("/mollie", requireAdmin, getMollieConfig);
router.post("/mollie", requireAdmin, updateMollieConfig);
router.get("/stripe", requireAdmin, getStripeConfig);
router.post("/stripe", requireAdmin, updateStripeConfig);

export default router;
