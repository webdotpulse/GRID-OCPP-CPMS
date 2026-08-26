import { Router } from "express";
import {
  getRootCa,
  getCertificates,
  signCsrRequest,
  installCertificateToCharger,
  deleteCertificateFromCharger,
} from "./security.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.get("/ca", authenticateToken, getRootCa);
router.get("/certificates", authenticateToken, requireAdmin, getCertificates);
router.post("/certificates/sign", authenticateToken, requireAdmin, signCsrRequest);
router.post("/certificates/install", authenticateToken, requireAdmin, installCertificateToCharger);
router.post("/certificates/delete", authenticateToken, requireAdmin, deleteCertificateFromCharger);

export default router;
