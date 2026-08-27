import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  updateUserRole,
  resetUserPassword,
  createUser,
  deleteUser,
} from "./users.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

// Base authentication required for all routes
router.use(authenticateToken as any);

router.get("/", requireAdmin as any, getAllUsers as any);
router.get("/:id", getUserById as any);
router.post("/", requireAdmin as any, createUser as any);
router.put("/:id", updateUser as any);
router.put("/:id/role", requireAdmin as any, updateUserRole as any);
router.post("/:id/reset-password", requireAdmin as any, resetUserPassword as any);
router.delete("/:id", deleteUser as any);

export default router;
