import { Router } from "express";
import multer from "multer";
import {
  getServerEnvironmentMetrics,
  runEnvironmentPing,
  exportDatabaseBackup,
  importDatabaseBackup,
  getDatabaseBackupStats,
} from "./environment.controller.js";
import { requireAdmin } from "../../../middleware/auth.js";

const router = Router();

// Configure memory storage for SQL backup file uploads (up to 100MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max backup file size
  },
});

// GET /api/settings/environment - Full environment & OCPP server status metrics
router.get("/", requireAdmin, getServerEnvironmentMetrics);

// POST /api/settings/environment/ping - Live diagnostic latency test
router.post("/ping", requireAdmin, runEnvironmentPing);

// GET /api/settings/environment/backup/export - Export full SQL or JSON database snapshot
router.get("/backup/export", requireAdmin, exportDatabaseBackup);

// POST /api/settings/environment/backup/import - Import and restore database from SQL backup
router.post("/backup/import", requireAdmin, upload.single("file"), importDatabaseBackup);

// GET /api/settings/environment/backup/stats - Database inventory and table statistics
router.get("/backup/stats", requireAdmin, getDatabaseBackupStats);

export default router;
