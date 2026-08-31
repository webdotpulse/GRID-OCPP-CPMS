import { Router } from "express";
import {
  getMollieConfig,
  updateMollieConfig,
  getStripeConfig,
  updateStripeConfig,
  getPaymentGatewaysOverview,
} from "./payments.controller.js";
import { requireAdmin, requireSuperAdmin } from "../../../middleware/auth.js";

const router = Router();

router.get("/overview", requireAdmin, getPaymentGatewaysOverview);
router.get("/mollie", requireAdmin, getMollieConfig);
router.post("/mollie", requireSuperAdmin, updateMollieConfig);
router.get("/stripe", requireAdmin, getStripeConfig);
router.post("/stripe", requireSuperAdmin, updateStripeConfig);

export default router;
