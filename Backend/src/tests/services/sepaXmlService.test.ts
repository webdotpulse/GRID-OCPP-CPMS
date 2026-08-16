import { SepaXmlService, SepaTransactionItem } from "../../services/SepaXmlService.js";

describe("SepaXmlService", () => {
  it("should throw an error if no transaction items are provided", () => {
    expect(() => SepaXmlService.generatePain001003([])).toThrow(
      "No reimbursement transactions provided for SEPA export."
    );
  });

  it("should generate a valid ISO 20022 SEPA pain.001.001.03 XML document", () => {
    const mockItems: SepaTransactionItem[] = [
      {
        id: 101,
        totalAmount: 45.50,
        month: 7,
        year: 2026,
        userName: "John Doe",
        iban: "NL91ABNA0417164300",
      },
      {
        id: 102,
        totalAmount: 32.00,
        month: 7,
        year: 2026,
        userName: "Jane Smith",
        iban: "BE68539007547034",
      },
    ];

    const xml = SepaXmlService.generatePain001003(mockItems, {
      companyName: "Acme Fleet Management",
      companyIban: "NL99BANK0123456789",
      companyBic: "BANKNL2A",
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">');
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
    expect(xml).toContain('<CtrlSum>77.50</CtrlSum>');
    expect(xml).toContain('<InstdAmt Ccy="EUR">45.50</InstdAmt>');
    expect(xml).toContain('<InstdAmt Ccy="EUR">32.00</InstdAmt>');
    expect(xml).toContain('<Nm>John Doe</Nm>');
    expect(xml).toContain('<Nm>Jane Smith</Nm>');
    expect(xml).toContain('<IBAN>NL91ABNA0417164300</IBAN>');
    expect(xml).toContain('<IBAN>BE68539007547034</IBAN>');
    expect(xml).toContain('<Cd>SEPA</Cd>');
  });

  it("should properly escape XML special characters to prevent XML injection (FIN-02)", () => {
    const mockItems: SepaTransactionItem[] = [
      {
        id: 103,
        totalAmount: 120.00,
        month: 8,
        year: 2026,
        userName: "Smith & Sons <Tech> \"Ltd\"",
        iban: "nl 91 abna 0417 1643 00", // Unformatted lowercase with spaces
      },
    ];

    const xml = SepaXmlService.generatePain001003(mockItems, {
      initiatingPartyName: "Admin & Partner <HQ>",
      companyName: "AT&T Europe 'Holdings'",
      companyIban: "nl 99 bank 0123 4567 89",
      companyBic: "bank nl 2a",
    });

    // Special characters should be escaped
    expect(xml).toContain('<Nm>Smith &amp; Sons &lt;Tech&gt; &quot;Ltd&quot;</Nm>');
    expect(xml).toContain('<Nm>Admin &amp; Partner &lt;HQ&gt;</Nm>');
    expect(xml).toContain('<Nm>AT&amp;T Europe &apos;Holdings&apos;</Nm>');

    // IBAN & BIC should be sanitized (no spaces, uppercase)
    expect(xml).toContain('<IBAN>NL91ABNA0417164300</IBAN>');
    expect(xml).toContain('<IBAN>NL99BANK0123456789</IBAN>');
    expect(xml).toContain('<BIC>BANKNL2A</BIC>');

    // No unescaped dangerous characters in content
    expect(xml).not.toContain('<Nm>Smith & Sons');
    expect(xml).not.toContain('<Nm>AT&T');
  });
});
