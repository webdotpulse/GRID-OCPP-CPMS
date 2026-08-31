import { Router } from "express";
import {
  verifyOcmfPayload,
  getEichrechtRecords,
  getTransactionEichrecht,
  exportTransparencyXml,
} from "./eichrecht.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.post("/verify", verifyOcmfPayload);
router.get("/records", requireAdmin, getEichrechtRecords);
router.get("/transaction/:id", getTransactionEichrecht);
router.get("/transaction/:id/xml", exportTransparencyXml);

export default router;
