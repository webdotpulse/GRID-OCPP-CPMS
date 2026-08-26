import { Router } from "express";
import {
  getReservations,
  createReservation,
  cancelReservation,
} from "./reservations.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

router.get("/", authenticateToken, getReservations);
router.post("/", authenticateToken, createReservation);
router.post("/:id/cancel", authenticateToken, cancelReservation);

export default router;
