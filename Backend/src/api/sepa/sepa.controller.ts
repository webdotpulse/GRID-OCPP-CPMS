import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { SepaXmlService, SepaDirectDebitItem, SepaCreditorOptions } from "../../services/SepaXmlService.js";
import { logger } from "../../utils/logger.js";
import { parseId } from "../../utils/validation.js";

/**
 * GET /api/sepa/mandates - List SEPA Direct Debit mandates
 */
export const getMandates = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, mandateType, isActive, search } = req.query;
    const isAdmin = req.userRole === "admin" || req.userRole === "superadmin";

    const where: any = {};

    if (!isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, companyId: true },
      });

      if (user?.companyId) {
        where.OR = [{ userId: user.id }, { companyId: user.companyId }];
      } else {
        where.userId = req.userId;
      }
    } else {
      if (userId) where.userId = Number(userId);
      if (companyId) where.companyId = Number(companyId);
    }

    if (mandateType) {
      where.mandateType = String(mandateType);
    }

    if (isActive !== undefined) {
      where.isActive = String(isActive) === "true";
    }

    if (search) {
      const searchStr = String(search).trim();
      where.OR = [
        ...(where.OR || []),
        { mandateRef: { contains: searchStr, mode: "insensitive" } },
        { debtorName: { contains: searchStr, mode: "insensitive" } },
        { iban: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const mandates = await prisma.sepaMandate.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: mandates });
  } catch (error: any) {
    logger.error("Error fetching SEPA mandates:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch SEPA mandates" });
  }
};

/**
 * GET /api/sepa/mandates/:id - Get single mandate by ID
 */
export const getMandate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid mandate ID" });
    }

    const mandate = await prisma.sepaMandate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (!mandate) {
      return res.status(404).json({ success: false, error: "SEPA mandate not found" });
    }

    const isAdmin = req.userRole === "admin" || req.userRole === "superadmin";
    if (!isAdmin && mandate.userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
      if (!user?.companyId || user.companyId !== mandate.companyId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
    }

    res.json({ success: true, data: mandate });
  } catch (error: any) {
    logger.error(`Error fetching mandate #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch mandate" });
  }
};

/**
 * POST /api/sepa/mandates - Create or update a SEPA mandate
 */
export const createOrUpdateMandate = async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.userRole === "admin" || req.userRole === "superadmin";
    const {
      id,
      userId,
      companyId,
      debtorName,
      iban,
      bic,
      mandateRef,
      signatureDate,
      mandateType = "CORE",
      sequenceType = "RCUR",
      isActive = true,
    } = req.body;

    const targetUserId = isAdmin && userId ? Number(userId) : req.userId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    if (!debtorName || !iban) {
      return res.status(400).json({ success: false, error: "Debtor name and IBAN are required" });
    }

    // Validate IBAN
    const ibanCheck = SepaXmlService.isValidIban(iban);
    if (!ibanCheck.valid) {
      return res.status(400).json({ success: false, error: ibanCheck.error || "Invalid IBAN checksum" });
    }

    // Validate BIC if present
    if (bic) {
      const bicCheck = SepaXmlService.isValidBic(bic);
      if (!bicCheck.valid) {
        return res.status(400).json({ success: false, error: bicCheck.error || "Invalid BIC format" });
      }
    }

    const cleanIban = SepaXmlService.sanitizeIban(iban);
    const cleanBic = bic ? SepaXmlService.sanitizeBic(bic) : null;
    const finalMandateRef =
      mandateRef && String(mandateRef).trim().length > 0
        ? String(mandateRef).trim()
        : `MND-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
            1000 + Math.random() * 9000
          )}`;

    let mandate;

    if (id) {
      const existing = await prisma.sepaMandate.findUnique({ where: { id: Number(id) } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "Mandate not found to update" });
      }
      if (!isAdmin && existing.userId !== req.userId) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      mandate = await prisma.sepaMandate.update({
        where: { id: Number(id) },
        data: {
          debtorName: String(debtorName).trim(),
          iban: cleanIban,
          bic: cleanBic,
          mandateRef: finalMandateRef,
          signatureDate: signatureDate ? new Date(signatureDate) : existing.signatureDate,
          mandateType: mandateType === "B2B" ? "B2B" : "CORE",
          sequenceType: ["FRST", "RCUR", "FNAL", "OOFF"].includes(sequenceType) ? sequenceType : "RCUR",
          isActive: Boolean(isActive),
          companyId: companyId ? Number(companyId) : existing.companyId,
        },
      });
    } else {
      mandate = await prisma.sepaMandate.create({
        data: {
          userId: targetUserId,
          companyId: companyId ? Number(companyId) : null,
          debtorName: String(debtorName).trim(),
          iban: cleanIban,
          bic: cleanBic,
          mandateRef: finalMandateRef,
          signatureDate: signatureDate ? new Date(signatureDate) : new Date(),
          mandateType: mandateType === "B2B" ? "B2B" : "CORE",
          sequenceType: ["FRST", "RCUR", "FNAL", "OOFF"].includes(sequenceType) ? sequenceType : "RCUR",
          isActive: Boolean(isActive),
        },
      });
    }

    res.status(id ? 200 : 201).json({ success: true, data: mandate });
  } catch (error: any) {
    logger.error("Error creating/updating SEPA mandate:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to save SEPA mandate" });
  }
};

/**
 * DELETE /api/sepa/mandates/:id - Deactivate or remove a SEPA mandate
 */
export const deleteMandate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid mandate ID" });
    }

    const mandate = await prisma.sepaMandate.findUnique({ where: { id } });
    if (!mandate) {
      return res.status(404).json({ success: false, error: "Mandate not found" });
    }

    const isAdmin = req.userRole === "admin" || req.userRole === "superadmin";
    if (!isAdmin && mandate.userId !== req.userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    await prisma.sepaMandate.delete({ where: { id } });
    res.json({ success: true, message: "SEPA mandate deleted successfully" });
  } catch (error: any) {
    logger.error(`Error deleting mandate #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete mandate" });
  }
};

/**
 * POST /api/sepa/validate - Validate IBAN and BIC checksums
 */
export const validateIbanBic = async (req: AuthRequest, res: Response) => {
  const { iban, bic } = req.body;

  const ibanResult = SepaXmlService.isValidIban(iban);
  const bicResult = bic ? SepaXmlService.isValidBic(bic) : { valid: true };

  res.json({
    success: true,
    data: {
      ibanValid: ibanResult.valid,
      ibanError: ibanResult.error,
      bicValid: bicResult.valid,
      bicError: bicResult.error,
    },
  });
};

/**
 * POST /api/sepa/direct-debit/export - Generate ISO 20022 pain.008.001.02 XML batch file
 */
export const exportDirectDebitXml = async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.userRole === "admin" || req.userRole === "superadmin";
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Only administrators can export SEPA Direct Debit batches" });
    }

    const { invoiceIds, year, month, mandateType = "CORE", sequenceType = "RCUR", collectionDate } = req.body;

    const where: any = {
      status: { in: ["issued", "pending"] },
    };

    if (invoiceIds && Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      where.id = { in: invoiceIds.map((id: any) => Number(id)) };
    } else if (year) {
      const targetYear = Number(year);
      const startOfYear = new Date(Date.UTC(targetYear, 0, 1));
      const endOfYear = new Date(Date.UTC(targetYear + 1, 0, 1));
      where.createdAt = { gte: startOfYear, lt: endOfYear };

      if (month) {
        const targetMonth = Number(month);
        where.createdAt = {
          gte: new Date(Date.UTC(targetYear, targetMonth - 1, 1)),
          lt: new Date(Date.UTC(targetYear, targetMonth, 1)),
        };
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        user: {
          include: {
            sepaMandates: {
              where: { isActive: true },
              orderBy: { id: "desc" },
              take: 1,
            },
          },
        },
        company: {
          include: {
            sepaMandates: {
              where: { isActive: true },
              orderBy: { id: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No unpaid invoices found matching criteria for direct debit collection",
      });
    }

    const collections: SepaDirectDebitItem[] = [];

    for (const inv of invoices) {
      // Find active mandate for company or user
      const mandate = inv.company?.sepaMandates?.[0] || inv.user?.sepaMandates?.[0];

      if (!mandate) {
        logger.warn(`Skipping Invoice ${inv.invoiceNumber}: No active SEPA mandate registered.`);
        continue;
      }

      collections.push({
        id: inv.id,
        amount: inv.totalAmount,
        debtorName: mandate.debtorName || inv.recipientName || "Customer",
        debtorIban: mandate.iban,
        debtorBic: mandate.bic,
        mandateRef: mandate.mandateRef,
        mandateSignatureDate: mandate.signatureDate,
        mandateType: mandate.mandateType,
        sequenceType: mandate.sequenceType || sequenceType,
        description: `Invoice ${inv.invoiceNumber} - Charging Sessions`,
        endToEndId: `E2E-${inv.invoiceNumber}`,
      });
    }

    if (collections.length === 0) {
      return res.status(400).json({
        success: false,
        error: "None of the selected invoices have an active SEPA mandate registered for direct debit.",
      });
    }

    const creditorOptions: SepaCreditorOptions = {
      initiatingPartyName: process.env.COMPANY_NAME || "OCPP-CPMS Billing System",
      creditorName: process.env.COMPANY_NAME || "OCPP-CPMS Operator",
      creditorIban: process.env.COMPANY_IBAN || "NL99BANK0123456789",
      creditorBic: process.env.COMPANY_BIC || "BANKNL2A",
      creditorSchemeId: process.env.SEPA_CREDITOR_ID || "NL98ZZZ012345670000",
      mandateType,
      sequenceType,
      collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
    };

    const xmlContent = SepaXmlService.generatePain008002(collections, creditorOptions);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="SEPA-DirectDebit-pain008-${Date.now()}.xml"`);
    res.send(xmlContent);
  } catch (error: any) {
    logger.error("Error exporting SEPA Direct Debit XML:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate SEPA Direct Debit file" });
  }
};
