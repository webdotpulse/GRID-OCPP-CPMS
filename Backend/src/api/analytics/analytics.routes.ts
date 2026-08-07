import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { getAnalyticsSummary, exportAnalyticsCsv } from "./analytics.controller.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/summary", getAnalyticsSummary as any);
router.get("/export/csv", exportAnalyticsCsv as any);

export default router;
