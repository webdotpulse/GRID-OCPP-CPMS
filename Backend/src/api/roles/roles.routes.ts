import { Router } from "express";
import {
  getRoles,
  getCapabilities,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  assignUserRole,
} from "./roles.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/", getRoles as any);
router.get("/capabilities", getCapabilities as any);
router.post("/", requireAdmin as any, createCustomRole as any);
router.put("/:id", requireAdmin as any, updateCustomRole as any);
router.delete("/:id", requireAdmin as any, deleteCustomRole as any);
router.post("/assign", requireAdmin as any, assignUserRole as any);

export default router;
