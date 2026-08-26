import PDFDocument from "pdfkit";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/mailer.js";

export interface MonthlyInvoiceResult {
  month: number;
  year: number;
  invoicesGenerated: number;
  totalSubtotal: number;
  totalVat: number;
  totalAmount: number;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    recipientName: string;
    totalAmount: number;
    itemCount: number;
  }>;
}

export interface InvoiceFilters {
  status?: string;
  companyId?: number;
  userId?: number;
  year?: number;
  month?: number;
  search?: string;
  page?: number;
  limit?: number;
}

// Standard VAT rates across key EU/international countries
const VAT_RATES: Record<string, number> = {
  NL: 21.0,
  BE: 21.0,
  DE: 19.0,
  FR: 20.0,
  IT: 22.0,
  ES: 21.0,
  AT: 20.0,
  LU: 17.0,
  PT: 23.0,
  GB: 20.0,
  UK: 20.0,
  US: 0.0,
};

export class InvoiceService {
  /**
   * Determine applicable VAT rate based on country, entity type, and tax numbers.
   * Handles domestic rates and EU B2B Reverse Charge (0%).
   */
  static determineVatRate(params: {
    country?: string | null;
    taxNumber?: string | null;
    isBusiness?: boolean;
    operatorCountry?: string;
  }): { vatRate: number; isReverseCharge: boolean } {
    const country = (params.country || "NL").toUpperCase().trim();
    const operatorCountry = (params.operatorCountry || "NL").toUpperCase().trim();
    const hasValidTaxNumber = !!(params.taxNumber && params.taxNumber.trim().length > 4);

    // EU B2B cross-border reverse charge: B2B customer in different EU country with valid tax number
    if (params.isBusiness && hasValidTaxNumber && country !== operatorCountry && country in VAT_RATES) {
      return { vatRate: 0.0, isReverseCharge: true };
    }

    const vatRate = VAT_RATES[country] ?? 21.0;
    return { vatRate, isReverseCharge: false };
  }

  /**
   * Generates next fiscal sequential invoice number (e.g. INV-202608-0001).
   */
  static async generateInvoiceNumber(year: number, month: number): Promise<string> {
    const monthStr = String(month).padStart(2, "0");
    const prefix = `INV-${year}${monthStr}-`;

    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: "desc",
      },
    });

    let nextSequence = 1;
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split("-");
      if (parts.length >= 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSequence = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSequence).padStart(4, "0")}`;
  }

  /**
   * Automatically generate monthly invoices for all completed, unbilled charging transactions.
   * Groups transactions by Company or User, calculates itemized energy and fees, and applies multi-tax rules.
   */
  static async generateMonthlyInvoices(targetDate?: Date): Promise<MonthlyInvoiceResult> {
    const now = targetDate || new Date();

    let targetMonth = now.getMonth() + 1; // 1-12
    let targetYear = now.getFullYear();

    // If running in scheduled mode (no date passed), bill for previous calendar month
    if (!targetDate) {
      targetMonth -= 1;
      if (targetMonth === 0) {
        targetMonth = 12;
        targetYear -= 1;
      }
    }

    logger.info(`Starting monthly invoice generation for ${targetMonth}/${targetYear}...`);

    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
    const dueDate = new Date(Date.UTC(targetYear, targetMonth, 15, 23, 59, 59, 999)); // Default 14 days after month start

    // Fetch unbilled completed transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        status: "completed",
        invoiceId: null,
        startTime: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        charger: {
          include: {
            chargingStation: true,
            owner: {
              include: { company: true },
            },
          },
        },
        rfidUser: {
          include: {
            owner: {
              include: { company: true },
            },
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    logger.info(`Found ${transactions.length} unbilled completed transaction(s) for ${targetMonth}/${targetYear}.`);

    // Group transactions by billing entity (Company or User)
    interface BillingEntity {
      companyId: number | null;
      userId: number | null;
      recipientName: string;
      recipientEmail: string;
      billingAddress: string;
      taxNumber: string;
      country: string;
      isBusiness: boolean;
      transactions: typeof transactions;
    }

    const entityMap = new Map<string, BillingEntity>();

    for (const tx of transactions) {
      let groupKey = "";
      let entity: BillingEntity;

      const rfidOwner = tx.rfidUser?.owner;
      const chargerOwner = tx.charger?.owner;
      const primaryUser = rfidOwner || chargerOwner;

      if (primaryUser?.companyId && primaryUser.company) {
        groupKey = `company_${primaryUser.companyId}`;
        if (!entityMap.has(groupKey)) {
          entityMap.set(groupKey, {
            companyId: primaryUser.companyId,
            userId: primaryUser.id,
            recipientName: primaryUser.company.name,
            recipientEmail: primaryUser.email,
            billingAddress: primaryUser.address || "",
            taxNumber: primaryUser.taxNumber || "",
            country: "NL",
            isBusiness: true,
            transactions: [],
          });
        }
      } else if (primaryUser) {
        groupKey = `user_${primaryUser.id}`;
        if (!entityMap.has(groupKey)) {
          entityMap.set(groupKey, {
            companyId: null,
            userId: primaryUser.id,
            recipientName: primaryUser.name || primaryUser.companyName || primaryUser.email,
            recipientEmail: primaryUser.email,
            billingAddress: primaryUser.address || "",
            taxNumber: primaryUser.taxNumber || "",
            country: "NL",
            isBusiness: !!primaryUser.companyName || !!primaryUser.taxNumber,
            transactions: [],
          });
        }
      } else {
        // Fallback for standalone/unassigned transactions
        groupKey = "standalone";
        if (!entityMap.has(groupKey)) {
          entityMap.set(groupKey, {
            companyId: null,
            userId: null,
            recipientName: "Ad-Hoc EV Customers",
            recipientEmail: "billing@ev-cpms.local",
            billingAddress: "",
            taxNumber: "",
            country: "NL",
            isBusiness: false,
            transactions: [],
          });
        }
      }

      entity = entityMap.get(groupKey)!;
      entity.transactions.push(tx);
    }

    const results: MonthlyInvoiceResult = {
      month: targetMonth,
      year: targetYear,
      invoicesGenerated: 0,
      totalSubtotal: 0,
      totalVat: 0,
      totalAmount: 0,
      invoices: [],
    };

    for (const [, entity] of entityMap) {
      if (entity.transactions.length === 0) continue;

      try {
        const { vatRate, isReverseCharge } = this.determineVatRate({
          country: entity.country,
          taxNumber: entity.taxNumber,
          isBusiness: entity.isBusiness,
        });

        // Group transaction items by charging station & date
        const lineItemsData: Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          vatRate: number;
          vatAmount: number;
          amount: number;
        }> = [];

        let subtotal = 0;

        for (const tx of entity.transactions) {
          const stationName = tx.charger?.chargingStation?.station_name || `Charger ${tx.charger_id}`;
          const kwh = Math.round(((tx.energyConsumed || 0) / 1000) * 100) / 100;
          
          let lineCostEur = 0;
          if (tx.totalCost !== null && tx.totalCost !== undefined && tx.totalCost > 0) {
            lineCostEur = Math.round((tx.totalCost / 100) * 100) / 100; // totalCost stored in cents
          } else {
            // Default rate: 0.35 EUR / kWh
            lineCostEur = Math.round(kwh * 0.35 * 100) / 100;
          }

          const unitPrice = kwh > 0 ? Math.round((lineCostEur / kwh) * 10000) / 10000 : lineCostEur;
          const lineVat = Math.round(lineCostEur * (vatRate / 100) * 100) / 100;

          const dateFormatted = tx.startTime ? tx.startTime.toISOString().split("T")[0] : "";
          const txDesc = `EV Charging: ${stationName} (${tx.connectorName}) on ${dateFormatted} [Tx: ${tx.transactionId}]`;

          lineItemsData.push({
            description: txDesc,
            quantity: kwh || 1,
            unitPrice: unitPrice,
            vatRate: vatRate,
            vatAmount: lineVat,
            amount: lineCostEur,
          });

          subtotal += lineCostEur;
        }

        subtotal = Math.round(subtotal * 100) / 100;
        const totalVat = Math.round(subtotal * (vatRate / 100) * 100) / 100;
        const totalAmount = Math.round((subtotal + totalVat) * 100) / 100;

        const invoiceNumber = await this.generateInvoiceNumber(targetYear, targetMonth);

        const notes = isReverseCharge
          ? "Reverse Charge: VAT liability shifted to customer pursuant to EU Directive 2006/112/EC Art. 196 (BTW Verlegd)."
          : undefined;

        // Create Invoice record with cascade items
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            companyId: entity.companyId,
            userId: entity.userId,
            recipientName: entity.recipientName,
            recipientEmail: entity.recipientEmail,
            billingAddress: entity.billingAddress,
            taxNumber: entity.taxNumber,
            country: entity.country,
            periodStart: startDate,
            periodEnd: endDate,
            subtotal,
            vatAmount: totalVat,
            totalAmount,
            vatRate,
            currency: "EUR",
            status: "issued",
            dueDate,
            notes,
            items: {
              create: lineItemsData,
            },
          },
        });

        // Link transactions to newly generated invoice
        const txIds = entity.transactions.map((t) => t.id);
        await prisma.transaction.updateMany({
          where: { id: { in: txIds } },
          data: { invoiceId: invoice.id },
        });

        results.invoicesGenerated += 1;
        results.totalSubtotal += subtotal;
        results.totalVat += totalVat;
        results.totalAmount += totalAmount;
        results.invoices.push({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          recipientName: entity.recipientName,
          totalAmount: invoice.totalAmount,
          itemCount: lineItemsData.length,
        });

        logger.info(
          `Generated Invoice ${invoice.invoiceNumber} for ${entity.recipientName}: Subtotal €${subtotal}, VAT €${totalVat}, Total €${totalAmount}`
        );
      } catch (entityError) {
        logger.error(`Error generating invoice for entity ${entity.recipientName}:`, entityError);
      }
    }

    results.totalSubtotal = Math.round(results.totalSubtotal * 100) / 100;
    results.totalVat = Math.round(results.totalVat * 100) / 100;
    results.totalAmount = Math.round(results.totalAmount * 100) / 100;

    return results;
  }

  /**
   * Generates a vector PDF invoice document using pdfkit.
   * Returns a Buffer ready for HTTP response streaming or email attachment.
   */
  static async generateInvoicePdf(invoiceId: number): Promise<Buffer> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          orderBy: { id: "asc" },
        },
        company: true,
        user: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 40,
          info: {
            Title: `Invoice ${invoice.invoiceNumber}`,
            Author: "OCPP-CPMS Smart Charging System",
            Subject: `Invoice ${invoice.invoiceNumber}`,
          },
        });

        const buffers: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err: Error) => reject(err));

        // Colors
        const primaryColor = "#1e2228";
        const accentColor = "#54a8c7";
        const darkGray = "#4a5568";
        const lightGray = "#f7fafc";
        const borderGray = "#e2e8f0";

        // --- Header Section ---
        doc.rect(40, 40, 515, 65).fill(primaryColor);

        doc
          .fillColor("#ffffff")
          .fontSize(18)
          .font("Helvetica-Bold")
          .text("OCPP-CPMS", 55, 55);

        doc
          .fillColor(accentColor)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("THE CHARGE GRID PLATFORM", 55, 78);

        doc
          .fillColor("#ffffff")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("INVOICE", 420, 55, { align: "right", width: 120 });

        doc
          .fillColor("#cbd5e0")
          .fontSize(9)
          .font("Helvetica")
          .text(invoice.invoiceNumber, 420, 78, { align: "right", width: 120 });

        // --- Meta & Address Section ---
        let currentY = 120;

        // Left Column: Bill To
        doc
          .fillColor(accentColor)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("BILL TO", 40, currentY);

        doc
          .fillColor(primaryColor)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(invoice.recipientName || "Valued Customer", 40, currentY + 14);

        doc
          .fillColor(darkGray)
          .fontSize(9)
          .font("Helvetica");

        let addressY = currentY + 28;
        if (invoice.billingAddress) {
          doc.text(invoice.billingAddress, 40, addressY);
          addressY += 12;
        }
        if (invoice.recipientEmail) {
          doc.text(invoice.recipientEmail, 40, addressY);
          addressY += 12;
        }
        if (invoice.taxNumber) {
          doc.text(`VAT/Tax ID: ${invoice.taxNumber}`, 40, addressY);
          addressY += 12;
        }

        // Right Column: Invoice Details Box
        const metaBoxX = 350;
        doc.roundedRect(metaBoxX, currentY, 205, 80, 4).fillAndStroke(lightGray, borderGray);

        const rowY = (offset: number) => currentY + 10 + offset * 14;

        doc.fillColor(darkGray).fontSize(8).font("Helvetica");
        doc.text("Invoice Date:", metaBoxX + 10, rowY(0));
        doc.text("Due Date:", metaBoxX + 10, rowY(1));
        doc.text("Status:", metaBoxX + 10, rowY(2));
        doc.text("Billing Period:", metaBoxX + 10, rowY(3));

        doc.fillColor(primaryColor).font("Helvetica-Bold");
        const invoiceDateStr = invoice.createdAt.toISOString().split("T")[0];
        const dueDateStr = invoice.dueDate.toISOString().split("T")[0];
        doc.text(invoiceDateStr, metaBoxX + 90, rowY(0), { align: "right", width: 105 });
        doc.text(dueDateStr, metaBoxX + 90, rowY(1), { align: "right", width: 105 });
        
        const statusText = invoice.status.toUpperCase();
        doc.fillColor(invoice.status === "paid" ? "#38a169" : "#dd6b20");
        doc.text(statusText, metaBoxX + 90, rowY(2), { align: "right", width: 105 });

        const periodStr = invoice.periodStart && invoice.periodEnd
          ? `${invoice.periodStart.toISOString().split("T")[0].substring(0, 7)}`
          : "N/A";
        doc.fillColor(primaryColor).font("Helvetica");
        doc.text(periodStr, metaBoxX + 90, rowY(3), { align: "right", width: 105 });

        // --- Items Table ---
        currentY = Math.max(addressY + 15, currentY + 100);

        // Table Header
        doc.rect(40, currentY, 515, 22).fill(primaryColor);
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
        doc.text("DESCRIPTION", 48, currentY + 6);
        doc.text("QTY / KWH", 310, currentY + 6, { width: 55, align: "right" });
        doc.text("RATE (€)", 375, currentY + 6, { width: 45, align: "right" });
        doc.text("VAT %", 430, currentY + 6, { width: 35, align: "right" });
        doc.text("AMOUNT (€)", 475, currentY + 6, { width: 70, align: "right" });

        currentY += 22;

        doc.font("Helvetica").fontSize(8);

        invoice.items.forEach((item, index) => {
          const isEven = index % 2 === 0;
          if (isEven) {
            doc.rect(40, currentY, 515, 20).fill(lightGray);
          }

          doc.fillColor(primaryColor);
          const truncatedDesc = item.description.length > 55
            ? `${item.description.substring(0, 52)}...`
            : item.description;

          doc.text(truncatedDesc, 48, currentY + 6);
          doc.text(item.quantity.toFixed(2), 310, currentY + 6, { width: 55, align: "right" });
          doc.text(`€${item.unitPrice.toFixed(4)}`, 375, currentY + 6, { width: 45, align: "right" });
          doc.text(`${item.vatRate.toFixed(0)}%`, 430, currentY + 6, { width: 35, align: "right" });
          doc.text(`€${item.amount.toFixed(2)}`, 475, currentY + 6, { width: 70, align: "right" });

          currentY += 20;

          // Add new page if table overflows
          if (currentY > 680) {
            doc.addPage();
            currentY = 50;
          }
        });

        // Border bottom under items
        doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderGray).stroke();
        currentY += 15;

        // --- Totals Summary Box ---
        const summaryX = 350;
        doc.fillColor(darkGray).fontSize(9).font("Helvetica");
        doc.text("Subtotal (excl. VAT):", summaryX, currentY);
        doc.fillColor(primaryColor).text(`€${invoice.subtotal.toFixed(2)}`, 460, currentY, { align: "right", width: 95 });
        currentY += 16;

        doc.fillColor(darkGray).text(`VAT (${invoice.vatRate.toFixed(0)}%):`, summaryX, currentY);
        doc.fillColor(primaryColor).text(`€${invoice.vatAmount.toFixed(2)}`, 460, currentY, { align: "right", width: 95 });
        currentY += 18;

        doc.rect(summaryX - 10, currentY - 4, 215, 26).fill(lightGray);
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold");
        doc.text("TOTAL DUE:", summaryX, currentY + 2);
        doc.fillColor(accentColor).text(`€${invoice.totalAmount.toFixed(2)} ${invoice.currency}`, 450, currentY + 2, { align: "right", width: 95 });

        currentY += 40;

        // --- Notes & Statutory Notices ---
        if (invoice.notes) {
          doc.roundedRect(40, currentY, 515, 30, 4).fillAndStroke("#ebf8ff", "#bee3f8");
          doc.fillColor("#2b6cb0").fontSize(8).font("Helvetica-Bold");
          doc.text("Notice: ", 48, currentY + 8, { continued: true });
          doc.font("Helvetica").text(invoice.notes);
          currentY += 45;
        }

        // --- Payment & Bank Details Footer ---
        currentY = Math.max(currentY, 690);

        doc.rect(40, currentY, 515, 60).fillAndStroke(lightGray, borderGray);

        doc.fillColor(accentColor).fontSize(8).font("Helvetica-Bold").text("PAYMENT INSTRUCTIONS", 50, currentY + 8);

        doc.fillColor(darkGray).fontSize(7.5).font("Helvetica");
        doc.text("Bank Name: European Central e-Mobility Bank", 50, currentY + 20);
        doc.text("IBAN: NL91ABNA0417164300", 50, currentY + 31);
        doc.text("BIC: ABNANL2A", 50, currentY + 42);

        doc.text(`Payment Reference: ${invoice.invoiceNumber}`, 260, currentY + 20);
        doc.text(`Due Date: ${dueDateStr}`, 260, currentY + 31);
        doc.text("Support: billing@ocpp-cpms.io", 260, currentY + 42);

        // Footer copyright
        doc
          .fillColor("#a0aec0")
          .fontSize(7)
          .text("OCPP-CPMS Enterprise System • Multi-Tax & Automated Fiscal Billing Module (FIN-01)", 40, 770, { align: "center", width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Retrieves invoices with filtering, search, pagination, and multi-tenant role isolation.
   */
  static async getInvoices(filters: InvoiceFilters, userRole?: string, userId?: number) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Multi-tenant scoping: Non-admins only see own invoices or their company's invoices
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, companyId: true },
      });

      if (user?.companyId) {
        where.OR = [{ userId: user.id }, { companyId: user.companyId }];
      } else {
        where.userId = userId;
      }
    } else {
      if (filters.companyId) where.companyId = Number(filters.companyId);
      if (filters.userId) where.userId = Number(filters.userId);
    }

    if (filters.status && filters.status !== "all") {
      where.status = filters.status;
    }

    if (filters.year) {
      const startOfYear = new Date(Date.UTC(Number(filters.year), 0, 1));
      const endOfYear = new Date(Date.UTC(Number(filters.year) + 1, 0, 1));
      where.createdAt = { gte: startOfYear, lt: endOfYear };
    }

    if (filters.search) {
      const searchStr = filters.search.trim();
      where.OR = [
        ...(where.OR || []),
        { invoiceNumber: { contains: searchStr, mode: "insensitive" } },
        { recipientName: { contains: searchStr, mode: "insensitive" } },
        { recipientEmail: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [invoices, total, statsAgg] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          company: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: {
          subtotal: true,
          vatAmount: true,
          totalAmount: true,
        },
      }),
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalSubtotal: Math.round((statsAgg._sum.subtotal || 0) * 100) / 100,
        totalVat: Math.round((statsAgg._sum.vatAmount || 0) * 100) / 100,
        totalAmount: Math.round((statsAgg._sum.totalAmount || 0) * 100) / 100,
      },
    };
  }

  /**
   * Retrieves single invoice by ID with items, transactions, and tenant security check.
   */
  static async getInvoiceById(id: number, userRole?: string, userId?: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { id: "asc" } },
        company: true,
        user: { select: { id: true, name: true, email: true, companyName: true } },
        transactions: {
          select: {
            id: true,
            transactionId: true,
            connectorName: true,
            startTime: true,
            endTime: true,
            energyConsumed: true,
            totalCost: true,
            charger: {
              select: {
                charger_id: true,
                name: true,
                chargingStation: { select: { id: true, station_name: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) return null;

    // Tenant check
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId) {
      if (invoice.userId !== userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
        if (!user?.companyId || user.companyId !== invoice.companyId) {
          throw new Error("Access denied: You do not have permission to view this invoice.");
        }
      }
    }

    return invoice;
  }

  /**
   * Updates status of an invoice (e.g. mark as paid).
   */
  static async updateInvoiceStatus(id: number, status: string, notes?: string, userRole?: string) {
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin) {
      throw new Error("Permission denied: Only administrators can update invoice status.");
    }

    const data: any = { status };
    if (status === "paid") {
      data.paidAt = new Date();
    }
    if (notes) {
      data.notes = notes;
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data,
    });

    return updated;
  }

  /**
   * Email invoice PDF to recipient via MailService / mailer.
   */
  static async emailInvoice(invoiceId: number): Promise<{ success: boolean; message: string }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { user: true, company: true },
    });

    if (!invoice) {
      throw new Error(`Invoice #${invoiceId} not found.`);
    }

    const recipientEmail = invoice.recipientEmail || invoice.user?.email;
    if (!recipientEmail) {
      throw new Error(`No email address available for Invoice ${invoice.invoiceNumber}.`);
    }

    const pdfBuffer = await this.generateInvoicePdf(invoiceId);

    const subject = `Your EV Charging Invoice ${invoice.invoiceNumber}`;
    const textBody = `Dear ${invoice.recipientName || "Customer"},\n\nPlease find attached your charging invoice ${invoice.invoiceNumber} for the amount of €${invoice.totalAmount.toFixed(2)}.\n\nDue Date: ${invoice.dueDate.toISOString().split("T")[0]}\n\nThank you for choosing our charging network.\n\nBest regards,\nOCPP-CPMS Billing Team`;
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e2228; margin-top: 0;">EV Charging Invoice</h2>
        <p>Dear <strong>${invoice.recipientName || "Customer"}</strong>,</p>
        <p>Your monthly EV charging invoice is ready. Please find attached the formal PDF invoice.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f7fafc;">
            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Total Amount:</strong></td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>€${invoice.totalAmount.toFixed(2)} ${invoice.currency}</strong></td>
          </tr>
          <tr style="background: #f7fafc;">
            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Due Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${invoice.dueDate.toISOString().split("T")[0]}</td>
          </tr>
        </table>
        <p>If you have any questions regarding your invoice, please contact our support team.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #718096;">OCPP-CPMS Smart Charging System • Automated Billing Engine</p>
      </div>
    `;

    await sendEmail(
      recipientEmail,
      subject,
      textBody,
      htmlBody,
      undefined,
      "en",
      undefined,
      [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    );

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} successfully emailed to ${recipientEmail}`,
    };
  }
}
