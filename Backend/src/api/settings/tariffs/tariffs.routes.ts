import { Router } from "express";
import {
  getEntsoeApiKey,
  updateEntsoeApiKey,
} from "./tariffs.controller.js";
import { requireAdmin, requireSuperAdmin } from "../../../middleware/auth.js";

const router = Router();

router.get("/entsoe-key", requireAdmin, getEntsoeApiKey);
router.post("/entsoe-key", requireSuperAdmin, updateEntsoeApiKey);

export default router;
