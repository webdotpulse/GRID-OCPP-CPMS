import { Router } from "express";
import {
  postStartSession,
  postStopSession,
  postUnlockConnector,
} from "./commands.controller.js";

const router = Router();

router.post("/START_SESSION", postStartSession);
router.post("/STOP_SESSION", postStopSession);
router.post("/UNLOCK_CONNECTOR", postUnlockConnector);

export default router;
