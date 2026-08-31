import { Router } from "express";
import {
  getAllChargeGroups,
  getChargeGroupById,
  createChargeGroup,
  updateChargeGroup,
  deleteChargeGroup
} from "./chargeGroups.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.get("/", getAllChargeGroups);
router.get("/:id", getChargeGroupById);
router.post("/", requireAdmin, createChargeGroup);
router.put("/:id", requireAdmin, updateChargeGroup);
router.delete("/:id", requireAdmin, deleteChargeGroup);

export default router;
