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
  getCombineCandidates
} from "./chargers.controller.js";

const router = Router();

router.get("/", getAllChargers);
router.post("/combine", combineChargers);
router.post("/uncombine", uncombineChargers);
router.get("/unrecognized", getUnrecognizedConnections);
router.delete("/unrecognized", deleteUnrecognizedConnections);
router.get("/:id", getChargerById);
router.get("/:id/status", getChargerStatus);
router.get("/:id/logs", getChargerLogs);
router.get("/:id/configurations", getChargerConfigurations);
router.get("/:id/combine-candidates", getCombineCandidates);
router.post("/", createCharger);
router.put("/:id", updateCharger);
router.delete("/:id", deleteCharger);
router.post("/connectors", createBulkConnectors);

router.get("/:id/predictive-schedule", getPredictiveSchedule);

export default router;
