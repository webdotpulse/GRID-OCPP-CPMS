import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { InvoiceService } from "../../services/InvoiceService.js";
import { logger } from "../../utils/logger.js";
import { parseId } from "../../utils/validation.js";

/**
 * GET /api/invoices - Retrieve all invoices with multi-tenant filtering and pagination
 */
export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const { status, companyId, userId, year, month, search, page, limit } = req.query;

    const result = await InvoiceService.getInvoices(
      {
        status: status as string,
        companyId: companyId ? Number(companyId) : undefined,
        userId: userId ? Number(userId) : undefined,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        search: search as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      },
      req.userRole,
      req.userId
    );

    res.json({
      success: true,
      data: result.invoices,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error: any) {
    logger.error("Error fetching invoices:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch invoices" });
  }
};

/**
 * GET /api/invoices/:id - Retrieve single invoice details
 */
export const getInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const invoice = await InvoiceService.getInvoiceById(id, req.userRole, req.userId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    res.json({ success: true, data: invoice });
  } catch (error: any) {
    logger.error(`Error fetching invoice #${req.params.id}:`, error);
    const statusCode = error.message.includes("Access denied") ? 403 : 500;
    res.status(statusCode).json({ success: false, error: error.message || "Failed to fetch invoice" });
  }
};

/**
 * GET /api/invoices/:id/pdf - Stream / download vector PDF invoice
 */
export const downloadInvoicePdf = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const invoice = await InvoiceService.getInvoiceById(id, req.userRole, req.userId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    const pdfBuffer = await InvoiceService.generateInvoicePdf(id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoiceNumber}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    res.end(pdfBuffer);
  } catch (error: any) {
    logger.error(`Error downloading PDF for invoice #${req.params.id}:`, error);
    const statusCode = error.message?.includes("Access denied") ? 403 : 500;
    res.status(statusCode).json({ success: false, error: error.message || "Failed to generate invoice PDF" });
  }
};

/**
 * POST /api/invoices/generate - Trigger monthly invoicing on demand (Admin/Superadmin only)
 */
export const generateInvoices = async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin" && req.userRole !== "superadmin") {
      return res.status(403).json({ success: false, error: "Only administrators can generate monthly invoices" });
    }

    const { year, month } = req.body;
    let targetDate: Date | undefined;

    if (year && month) {
      targetDate = new Date(Date.UTC(Number(year), Number(month) - 1, 15));
    }

    const result = await InvoiceService.generateMonthlyInvoices(targetDate);

    res.status(201).json({
      success: true,
      message: `Generated ${result.invoicesGenerated} invoices for ${result.month}/${result.year}`,
      data: result,
    });
  } catch (error: any) {
    logger.error("Error generating monthly invoices:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate monthly invoices" });
  }
};

/**
 * POST /api/invoices/:id/send - Dispatch invoice PDF via email (Admin/Superadmin only)
 */
export const sendInvoiceEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "admin" && req.userRole !== "superadmin") {
      return res.status(403).json({ success: false, error: "Only administrators can email invoices" });
    }

    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const result = await InvoiceService.emailInvoice(id, req.userRole, req.userId);
    res.json(result);
  } catch (error: any) {
    logger.error(`Error emailing invoice #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to email invoice" });
  }
};

/**
 * PATCH /api/invoices/:id/status - Update invoice status (e.g., mark as paid) (Admin/Superadmin only)
 */
export const updateInvoiceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid invoice ID" });
    }

    const { status, notes } = req.body;
    if (!status || !["draft", "issued", "paid", "void"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be one of: 'draft', 'issued', 'paid', 'void'",
      });
    }

    const updated = await InvoiceService.updateInvoiceStatus(id, status, notes, req.userRole, req.userId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error(`Error updating status for invoice #${req.params.id}:`, error);
    const statusCode = error.message?.includes("Permission denied") ? 403 : 500;
    res.status(statusCode).json({ success: false, error: error.message || "Failed to update invoice status" });
  }
};
