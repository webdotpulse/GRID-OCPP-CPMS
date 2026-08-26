import { Router } from "express";
import {
  getOcpiSessions,
  getOcpiSessionById,
} from "./sessions.controller.js";

const router = Router();

router.get("/", getOcpiSessions);
router.get("/:session_id", getOcpiSessionById);

export default router;
