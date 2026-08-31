import { Router } from "express";
import {
  getPlaybooks,
  getPlaybookStats,
  getExecutions,
  getExecution,
  getPlaybook,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  togglePlaybook,
  executePlaybook,
  aiAnalyze,
  seedDefaults,
  exportPlaybooks,
  importPlaybooks,
} from "./autoHealPlaybooks.controller.js";

const router = Router();

// Collections & Analytics
router.get("/stats", getPlaybookStats);
router.get("/executions", getExecutions);
router.get("/executions/:id", getExecution);
router.get("/export", exportPlaybooks);
router.post("/import", importPlaybooks);
router.post("/seed-defaults", seedDefaults);
router.post("/ai-analyze", aiAnalyze);

// Playbooks CRUD
router.get("/", getPlaybooks);
router.post("/", createPlaybook);
router.get("/:id", getPlaybook);
router.put("/:id", updatePlaybook);
router.delete("/:id", deletePlaybook);
router.post("/:id/toggle", togglePlaybook);
router.post("/:id/execute", executePlaybook);

export default router;
