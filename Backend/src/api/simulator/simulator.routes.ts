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
} from "./simulator.controller.js";

const router = Router();

router.get("/templates", getTemplates);
router.get("/sessions", getSessions);
router.get("/sessions/:id", getSessionById);
router.post("/quick-provision", quickProvision);
router.post("/start", startSession);
router.post("/sessions/:id/stop", stopSession);
router.post("/sessions/:id/action", sendAction);
router.post("/sessions/:id/scenario", triggerScenario);
router.post("/sessions/:id/test-suite", runTestSuite);
router.post("/sessions/:id/raw-frame", sendRawFrame);
router.get("/rfid-tags", getRfidTags);

export default router;
