import { Router } from "express";
import { getHardwareAtRiskSettings, updateHardwareAtRiskSettings } from "./hardwareAtRisk.controller.js";
import { requireAdmin } from "../../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

router.get("/", getHardwareAtRiskSettings);
router.put("/", updateHardwareAtRiskSettings);

export default router;
