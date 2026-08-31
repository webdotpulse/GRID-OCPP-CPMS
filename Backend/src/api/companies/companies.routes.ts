import { Router } from "express";
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
} from "./companies.controller.js";
import { authenticateToken, requireAdmin, requireSuperAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/", getAllCompanies as any);
router.get("/:id", getCompanyById as any);
router.post("/", requireSuperAdmin as any, createCompany as any);
router.put("/:id", requireAdmin as any, updateCompany as any);
router.delete("/:id", requireSuperAdmin as any, deleteCompany as any);

export default router;
