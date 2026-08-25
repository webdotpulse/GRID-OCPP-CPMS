import { Router } from "express";
import {
  getOverview,
  getLiveSessions,
  getDistribution,
  getChargersStatus,
  getLoadMetrics,
  getFleetCapacity
} from "./dashboard.controller.js";

const router = Router();

router.get("/overview", getOverview);
router.get("/live-sessions", getLiveSessions);
router.get("/distribution", getDistribution);
router.get("/chargers-status", getChargersStatus);
router.get("/load", getLoadMetrics);
router.get("/fleet-capacity", getFleetCapacity);

export default router;
