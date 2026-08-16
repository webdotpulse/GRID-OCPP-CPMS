import { Router } from "express";
import {
  getQuirkProfiles,
  getQuirkProfile,
  createQuirkProfile,
  updateQuirkProfile,
  deleteQuirkProfile,
  exportProfiles,
  importProfiles,
} from "./quirk-profiles.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

router.get("/", getQuirkProfiles);
router.post("/", createQuirkProfile);

router.get("/export", exportProfiles);
router.post("/import", importProfiles);

router.get("/:id", getQuirkProfile);
router.put("/:id", updateQuirkProfile);
router.delete("/:id", deleteQuirkProfile);

export default router;
