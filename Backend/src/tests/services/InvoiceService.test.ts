import { jest } from "@jest/globals";
import { prisma } from "../../config/database.js";
import { InvoiceService } from "../../services/InvoiceService.js";

describe("InvoiceService & Multi-Tax Invoicing Engine (FIN-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Multi-Tax & VAT Rate Engine", () => {
    it("should resolve correct domestic EU VAT rates", () => {
      const nlRate = InvoiceService.determineVatRate({ country: "NL" });
      expect(nlRate.vatRate).toBe(21.0);
      expect(nlRate.isReverseCharge).toBe(false);

      const deRate = InvoiceService.determineVatRate({ country: "DE" });
      expect(deRate.vatRate).toBe(19.0);
      expect(deRate.isReverseCharge).toBe(false);

      const frRate = InvoiceService.determineVatRate({ country: "FR" });
      expect(frRate.vatRate).toBe(20.0);
      expect(frRate.isReverseCharge).toBe(false);
    });

    it("should apply 0% Reverse Charge for cross-border EU B2B corporate entities with valid VAT number", () => {
      const reverseChargeResult = InvoiceService.determineVatRate({
        country: "BE",
        operatorCountry: "NL",
        isBusiness: true,
        taxNumber: "BE0123456789",
      });

      expect(reverseChargeResult.vatRate).toBe(0.0);
      expect(reverseChargeResult.isReverseCharge).toBe(true);
    });

    it("should not apply reverse charge if customer is in the same country as operator", () => {
      const domesticB2B = InvoiceService.determineVatRate({
        country: "NL",
        operatorCountry: "NL",
        isBusiness: true,
        taxNumber: "NL861234567B01",
      });

      expect(domesticB2B.vatRate).toBe(21.0);
      expect(domesticB2B.isReverseCharge).toBe(false);
    });
  });

  describe("Sequential Fiscal Invoice Numbering", () => {
    it("should generate starting invoice number if no previous invoice exists in period", async () => {
      const findFirstSpy = jest.spyOn(prisma.invoice, "findFirst").mockResolvedValue(null);

      const invNumber = await InvoiceService.generateInvoiceNumber(2026, 8);
      expect(invNumber).toBe("INV-202608-0001");

      findFirstSpy.mockRestore();
    });

    it("should increment sequence number from previous invoice", async () => {
      const findFirstSpy = jest.spyOn(prisma.invoice, "findFirst").mockResolvedValue({
        id: 5,
        invoiceNumber: "INV-202608-0042",
      } as any);

      const invNumber = await InvoiceService.generateInvoiceNumber(2026, 8);
      expect(invNumber).toBe("INV-202608-0043");

      findFirstSpy.mockRestore();
    });
  });

  describe("Monthly Batch Invoice Generation", () => {
    it("should aggregate completed transactions and generate itemized invoices", async () => {
      const mockTransactions = [
        {
          id: 1,
          transactionId: "TX-AUG-01",
          connectorName: "CCS2-A",
          charger_id: 10,
          energyConsumed: 50000, // 50 kWh
          totalCost: 1750, // 1750 cents = €17.50
          startTime: new Date("2026-08-05T10:00:00Z"),
          charger: {
            charger_id: 10,
            chargingStation: { station_name: "Amsterdam SuperHub" },
            owner: {
              id: 100,
              name: "Acme Logistics",
              email: "fleet@acme.com",
              companyId: 1,
              company: { id: 1, name: "Acme Fleet Corp" },
              address: "Keizersgracht 100, Amsterdam",
              taxNumber: "NL888888888B01",
            },
          },
          rfidUser: {
            rfid_user_id: 1,
            owner: {
              id: 100,
              name: "Acme Logistics",
              email: "fleet@acme.com",
              companyId: 1,
              company: { id: 1, name: "Acme Fleet Corp" },
            },
          },
        },
        {
          id: 2,
          transactionId: "TX-AUG-02",
          connectorName: "CCS2-B",
          charger_id: 10,
          energyConsumed: 30000, // 30 kWh
          totalCost: 1050, // 1050 cents = €10.50
          startTime: new Date("2026-08-12T14:00:00Z"),
          charger: {
            charger_id: 10,
            chargingStation: { station_name: "Amsterdam SuperHub" },
            owner: {
              id: 100,
              name: "Acme Logistics",
              email: "fleet@acme.com",
              companyId: 1,
              company: { id: 1, name: "Acme Fleet Corp" },
            },
          },
          rfidUser: null,
        },
      ];

      const findTxSpy = jest
        .spyOn(prisma.transaction, "findMany")
        .mockResolvedValue(mockTransactions as any);
      const findFirstInvoiceSpy = jest
        .spyOn(prisma.invoice, "findFirst")
        .mockResolvedValue(null);
      const createInvoiceSpy = jest.spyOn(prisma.invoice, "create").mockResolvedValue({
        id: 101,
        invoiceNumber: "INV-202608-0001",
        recipientName: "Acme Fleet Corp",
        subtotal: 28.0,
        vatAmount: 5.88,
        totalAmount: 33.88,
      } as any);
      const updateManyTxSpy = jest
        .spyOn(prisma.transaction, "updateMany")
        .mockResolvedValue({ count: 2 });

      const targetDate = new Date("2026-08-15T00:00:00Z");
      const result = await InvoiceService.generateMonthlyInvoices(targetDate);

      expect(result.month).toBe(8);
      expect(result.year).toBe(2026);
      expect(result.invoicesGenerated).toBe(1);
      expect(result.totalSubtotal).toBe(28.0); // 17.50 + 10.50 = 28.00
      expect(result.totalVat).toBe(5.88); // 28 * 0.21 = 5.88
      expect(result.totalAmount).toBe(33.88); // 28 + 5.88 = 33.88

      expect(createInvoiceSpy).toHaveBeenCalledTimes(1);
      expect(updateManyTxSpy).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { invoiceId: 101 },
      });

      findTxSpy.mockRestore();
      findFirstInvoiceSpy.mockRestore();
      createInvoiceSpy.mockRestore();
      updateManyTxSpy.mockRestore();
    });
  });

  describe("Vector PDF Generation Engine", () => {
    it("should generate a valid PDF document buffer with header, line items, and VAT summary", async () => {
      const mockInvoice = {
        id: 1,
        invoiceNumber: "INV-202608-0001",
        recipientName: "Dutch Fleet Logistics B.V.",
        recipientEmail: "finance@dutchfleet.nl",
        billingAddress: "Damrak 1, 1012 LG Amsterdam",
        taxNumber: "NL123456789B01",
        country: "NL",
        periodStart: new Date("2026-08-01T00:00:00Z"),
        periodEnd: new Date("2026-08-31T23:59:59Z"),
        subtotal: 100.0,
        vatAmount: 21.0,
        totalAmount: 121.0,
        vatRate: 21.0,
        currency: "EUR",
        status: "issued",
        dueDate: new Date("2026-09-14T00:00:00Z"),
        createdAt: new Date("2026-09-01T00:00:00Z"),
        notes: null,
        company: { id: 1, name: "Dutch Fleet Logistics B.V." },
        user: { id: 10, email: "finance@dutchfleet.nl" },
        items: [
          {
            id: 1,
            description: "EV Charging: Amsterdam SuperHub (CCS2) [Tx: TX-101]",
            quantity: 150.0,
            unitPrice: 0.4,
            vatRate: 21.0,
            vatAmount: 12.6,
            amount: 60.0,
          },
          {
            id: 2,
            description: "EV Charging: Rotterdam FastHub (CCS2) [Tx: TX-102]",
            quantity: 100.0,
            unitPrice: 0.4,
            vatRate: 21.0,
            vatAmount: 8.4,
            amount: 40.0,
          },
        ],
      };

      const findUniqueSpy = jest
        .spyOn(prisma.invoice, "findUnique")
        .mockResolvedValue(mockInvoice as any);

      const pdfBuffer = await InvoiceService.generateInvoicePdf(1);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      // Verify PDF magic header bytes
      const headerStr = pdfBuffer.subarray(0, 5).toString("utf-8");
      expect(headerStr).toBe("%PDF-");

      findUniqueSpy.mockRestore();
    });
  });

  describe("Invoice Filtering & Access Control", () => {
    it("should scope invoices to regular user and their company", async () => {
      const findUserSpy = jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: 25,
        companyId: 3,
      } as any);

      const findManySpy = jest.spyOn(prisma.invoice, "findMany").mockResolvedValue([]);
      const countSpy = jest.spyOn(prisma.invoice, "count").mockResolvedValue(0);
      const aggSpy = jest.spyOn(prisma.invoice, "aggregate").mockResolvedValue({
        _sum: { subtotal: 0, vatAmount: 0, totalAmount: 0 },
      } as any);

      await InvoiceService.getInvoices({}, "user", 25);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ userId: 25 }, { companyId: 3 }],
          }),
        })
      );

      findUserSpy.mockRestore();
      findManySpy.mockRestore();
      countSpy.mockRestore();
      aggSpy.mockRestore();
    });
  });
});
