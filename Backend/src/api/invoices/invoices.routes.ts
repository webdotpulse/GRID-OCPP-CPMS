import { Router } from "express";
import {
  getInvoices,
  getInvoice,
  downloadInvoicePdf,
  generateInvoices,
  sendInvoiceEmail,
  updateInvoiceStatus,
  deleteInvoice,
  resetInvoiceNumbering,
} from "./invoices.controller.js";

const router = Router();

// Invoices CRUD & operations
router.get("/", getInvoices);
router.post("/generate", generateInvoices);
router.post("/reset-numbering", resetInvoiceNumbering);
router.get("/:id", getInvoice);
router.get("/:id/pdf", downloadInvoicePdf);
router.post("/:id/send", sendInvoiceEmail);
router.patch("/:id/status", updateInvoiceStatus);
router.delete("/:id", deleteInvoice);

export default router;

