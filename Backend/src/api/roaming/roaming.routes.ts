import { Router } from "express";
import { getMargins, getReport, getStats } from "./roaming.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import testSuiteRoutes from "./testSuite.routes.js";

const router = Router();

// Roaming Test Suite & Mock Sandbox
router.use("/test-suite", testSuiteRoutes);

// Roaming Clearinghouse Reporting & Margins (Admin Only)
router.get("/margins", authenticateToken, requireAdmin, getMargins);
router.get("/report", authenticateToken, requireAdmin, getReport);
router.get("/stats", authenticateToken, requireAdmin, getStats);

export default router;
