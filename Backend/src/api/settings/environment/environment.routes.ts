import { Router } from "express";
import { getServerEnvironmentMetrics, runEnvironmentPing } from "./environment.controller.js";
import { requireAdmin } from "../../../middleware/auth.js";

const router = Router();

// GET /api/settings/environment - Full environment & OCPP server status metrics
router.get("/", requireAdmin, getServerEnvironmentMetrics);

// POST /api/settings/environment/ping - Live diagnostic latency test
router.post("/ping", requireAdmin, runEnvironmentPing);

export default router;
