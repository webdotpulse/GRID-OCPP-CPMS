import { Router } from "express";
import { getMargins, getReport, getStats } from "./roaming.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

router.get("/margins", getMargins);
router.get("/report", getReport);
router.get("/stats", getStats);

export default router;
