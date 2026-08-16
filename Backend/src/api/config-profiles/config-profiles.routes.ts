import { Router } from "express";
import {
  getConfigProfiles,
  getConfigProfile,
  createConfigProfile,
  updateConfigProfile,
  deleteConfigProfile,
  applyConfigProfile,
  generateRecoveryProfile,
  generateStandardProfile,
} from "./config-profiles.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

router.get("/", getConfigProfiles);
router.get("/:id", getConfigProfile);
router.post("/", createConfigProfile);
router.put("/:id", updateConfigProfile);
router.delete("/:id", deleteConfigProfile);
router.post("/:profileId/apply/:chargerId", applyConfigProfile);



router.post("/generate-recovery", generateRecoveryProfile);
router.post("/generate-standard", generateStandardProfile);

export default router;
