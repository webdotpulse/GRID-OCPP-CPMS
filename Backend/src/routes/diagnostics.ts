import { Router } from "express";
import {
  getDiagnostics,
  getAnomalyEvents,
  getComponentHealthScores,
  getTelemetryStreamWindow,
  resolveAnomalyEvent,
  clearAnomalyDerating,
} from "../controllers/DiagnosticsController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateToken, getDiagnostics);
router.get("/anomalies", authenticateToken, getAnomalyEvents);
router.get("/health-scores", authenticateToken, getComponentHealthScores);
router.get("/telemetry-stream/:chargerId/:connectorId", authenticateToken, getTelemetryStreamWindow);
router.post("/anomalies/:id/resolve", authenticateToken, resolveAnomalyEvent);
router.post("/anomalies/:id/clear-derating", authenticateToken, clearAnomalyDerating);

export default router;
