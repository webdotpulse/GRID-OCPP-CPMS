import { Router } from "express";
import { getAuditLogs } from "./audit.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.get("/", authenticateToken, requireAdmin, getAuditLogs);

export default router;
