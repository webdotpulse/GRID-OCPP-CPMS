import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import {
  getScheduledChargings,
  getScheduledChargingById,
  createScheduledCharging,
  updateScheduledCharging,
  deleteScheduledCharging,
  toggleScheduledCharging,
  executeScheduledChargingNow,
} from "./scheduledCharging.controller.js";

const router = Router();

router.get("/", authenticateToken, getScheduledChargings);
router.post("/", authenticateToken, createScheduledCharging);
router.get("/:id", authenticateToken, getScheduledChargingById);
router.put("/:id", authenticateToken, updateScheduledCharging);
router.delete("/:id", authenticateToken, deleteScheduledCharging);
router.post("/:id/toggle", authenticateToken, toggleScheduledCharging);
router.post("/:id/execute-now", authenticateToken, executeScheduledChargingNow);

export default router;
