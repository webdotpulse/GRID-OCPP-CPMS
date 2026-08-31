import { Router } from "express";
import { getAuditLogs, exportAuditLogs, clearAuditLogs } from "./audit.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.get("/", authenticateToken, requireAdmin, getAuditLogs);
router.get("/export", authenticateToken, requireAdmin, exportAuditLogs);
router.delete("/", authenticateToken, requireAdmin, clearAuditLogs);

export default router;
