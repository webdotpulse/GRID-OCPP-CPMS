import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import {
  getCertificates,
  getCertificateById,
  createCertificate,
  updateCertificate,
  deleteCertificate,
} from "./vcc.controller.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/", getCertificates as any);
router.get("/:id", getCertificateById as any);
router.post("/", createCertificate as any);
router.put("/:id", updateCertificate as any);
router.delete("/:id", deleteCertificate as any);

export default router;
