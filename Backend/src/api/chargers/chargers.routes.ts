import { Router } from "express";
import {
  getAllChargers,
  getUnrecognizedConnections,
  deleteUnrecognizedConnections,
  getChargerById,
  getChargerStatus,
  createCharger,
  updateCharger,
  deleteCharger,
  createBulkConnectors,
  getChargerLogs,
  getChargerConfigurations,
  getPredictiveSchedule,
  combineChargers,
  uncombineChargers,
  getCombineCandidates,
  triggerPhaseCommutation
} from "./chargers.controller.js";
import {
  getLocalAuthList,
  syncLocalAuthList,
  queryLocalListVersion,
} from "../localAuthList/localAuthList.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.get("/", getAllChargers);
router.post("/combine", combineChargers);
router.post("/uncombine", uncombineChargers);
router.get("/unrecognized", getUnrecognizedConnections);
router.delete("/unrecognized", deleteUnrecognizedConnections);

// Local Authorization List routes
router.get("/:id/local-auth-list", getLocalAuthList);
router.post("/:id/local-auth-list/sync", requireAdmin, syncLocalAuthList);
router.post("/:id/local-auth-list/version", requireAdmin, queryLocalListVersion);

router.get("/:id", getChargerById);
router.get("/:id/status", getChargerStatus);
router.get("/:id/logs", getChargerLogs);
router.get("/:id/configurations", getChargerConfigurations);
router.get("/:id/combine-candidates", getCombineCandidates);
router.post("/:id/phase-commutation", triggerPhaseCommutation);
router.post("/", createCharger);
router.put("/:id", updateCharger);
router.delete("/:id", deleteCharger);
router.post("/connectors", createBulkConnectors);

router.get("/:id/predictive-schedule", getPredictiveSchedule);

export default router;
