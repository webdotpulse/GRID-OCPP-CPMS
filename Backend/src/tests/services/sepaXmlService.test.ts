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
});
