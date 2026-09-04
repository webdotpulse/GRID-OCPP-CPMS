import { Router } from "express";
import {
  getSessions,
  getSessionById,
  getTemplates,
  quickProvision,
  startSession,
  stopSession,
  sendAction,
  triggerScenario,
  runTestSuite,
  sendRawFrame,
  getRfidTags,
  getSimulatedChargers,
  createSimulatedCharger,
  deleteSimulatedCharger,
  forceStopSession,
} from "./simulator.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

router.get("/templates", getTemplates);
router.get("/sessions", getSessions);
router.get("/sessions/:id", getSessionById);
router.get("/chargers", getSimulatedChargers);
router.post("/chargers", createSimulatedCharger);
router.delete("/chargers/:id", deleteSimulatedCharger);
router.post("/chargers/:id/force-stop", forceStopSession);
router.post("/quick-provision", quickProvision);
router.post("/start", startSession);
router.post("/sessions/:id/stop", stopSession);
router.post("/sessions/:id/force-stop", forceStopSession);
router.post("/sessions/:id/action", sendAction);
router.post("/sessions/:id/scenario", triggerScenario);
router.post("/sessions/:id/test-suite", runTestSuite);
router.post("/sessions/:id/raw-frame", sendRawFrame);
router.get("/rfid-tags", getRfidTags);

export default router;

