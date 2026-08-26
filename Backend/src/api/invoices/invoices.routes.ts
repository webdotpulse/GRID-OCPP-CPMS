import { Router } from "express";
import {
  getInvoices,
  getInvoice,
  downloadInvoicePdf,
  generateInvoices,
  sendInvoiceEmail,
  updateInvoiceStatus,
} from "./invoices.controller.js";

const router = Router();

// Invoices CRUD & operations
router.get("/", getInvoices);
router.post("/generate", generateInvoices);
router.get("/:id", getInvoice);
router.get("/:id/pdf", downloadInvoicePdf);
router.post("/:id/send", sendInvoiceEmail);
router.patch("/:id/status", updateInvoiceStatus);

export default router;
