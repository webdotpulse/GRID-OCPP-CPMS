import { Router } from "express";
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  lookupCompanyRegistry,
  syncCompanyStations,
} from "./companies.controller.js";
import { authenticateToken, requireAdmin, requireSuperAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/", getAllCompanies as any);
router.get("/lookup", lookupCompanyRegistry as any);
router.get("/:id", getCompanyById as any);
router.post("/:id/sync-stations", requireAdmin as any, syncCompanyStations as any);
router.post("/", requireSuperAdmin as any, createCompany as any);
router.put("/:id", requireAdmin as any, updateCompany as any);
router.delete("/:id", requireSuperAdmin as any, deleteCompany as any);

export default router;

