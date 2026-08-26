import { Router } from "express";
import {
  getMandates,
  getMandate,
  createOrUpdateMandate,
  deleteMandate,
  validateIbanBic,
  exportDirectDebitXml,
} from "./sepa.controller.js";

const router = Router();

// Mandate management
router.get("/mandates", getMandates);
router.post("/mandates", createOrUpdateMandate);
router.get("/mandates/:id", getMandate);
router.delete("/mandates/:id", deleteMandate);

// Validation
router.post("/validate", validateIbanBic);

// Direct Debit ISO 20022 XML batch export
router.post("/direct-debit/export", exportDirectDebitXml);

export default router;
