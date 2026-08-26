import {
  SepaXmlService,
  SepaDirectDebitItem,
  SepaCreditorOptions,
} from "../../services/SepaXmlService.js";

describe("SepaXmlService - ISO 20022 SEPA Direct Debit (FIN-02)", () => {
  describe("IBAN and BIC Validation", () => {
    it("should validate valid European IBANs with mod-97 algorithm", () => {
      expect(SepaXmlService.isValidIban("NL91ABNA0417164300").valid).toBe(true);
      expect(SepaXmlService.isValidIban("BE68539007547034").valid).toBe(true);
      expect(SepaXmlService.isValidIban("DE89370400440532013000").valid).toBe(true);
      expect(SepaXmlService.isValidIban("FR1420041010050500013M02606").valid).toBe(true);
    });

    it("should reject invalid IBAN check digits or invalid lengths", () => {
      // Wrong check digits
      expect(SepaXmlService.isValidIban("NL00ABNA0417164300").valid).toBe(false);
      // Wrong length
      expect(SepaXmlService.isValidIban("NL91ABNA04171643").valid).toBe(false);
      // Non-IBAN characters
      expect(SepaXmlService.isValidIban("INVALID_IBAN").valid).toBe(false);
      // Empty input
      expect(SepaXmlService.isValidIban("").valid).toBe(false);
      expect(SepaXmlService.isValidIban(null).valid).toBe(false);
    });

    it("should validate valid 8 and 11-character SWIFT/BICs", () => {
      expect(SepaXmlService.isValidBic("ABNANL2A").valid).toBe(true);
      expect(SepaXmlService.isValidBic("ABNANL2AXXX").valid).toBe(true);
      expect(SepaXmlService.isValidBic("DEUTDEDD").valid).toBe(true);
      expect(SepaXmlService.isValidBic("BNPAFRPPXXX").valid).toBe(true);
    });

    it("should reject invalid BICs", () => {
      expect(SepaXmlService.isValidBic("SHORT").valid).toBe(false);
      expect(SepaXmlService.isValidBic("TOOLONGBICCODE123").valid).toBe(false);
      expect(SepaXmlService.isValidBic("12345678").valid).toBe(false);
      expect(SepaXmlService.isValidBic("").valid).toBe(false);
    });
  });

  describe("ISO 20022 pain.008.001.02 Direct Debit XML Generation", () => {
    it("should throw an error when collection array is empty", () => {
      expect(() => SepaXmlService.generatePain008002([])).toThrow(
        "No direct debit collection items provided for SEPA export."
      );
    });

    it("should generate a compliant pain.008.001.02 CORE direct debit XML batch", () => {
      const mockCollections: SepaDirectDebitItem[] = [
        {
          id: 1,
          amount: 85.5,
          debtorName: "Acme Logistics BV",
          debtorIban: "NL91ABNA0417164300",
          debtorBic: "ABNANL2A",
          mandateRef: "MND-2026-0001",
          mandateSignatureDate: "2026-01-15",
          mandateType: "CORE",
          sequenceType: "RCUR",
          description: "Monthly Charging Subscription & Energy",
          endToEndId: "E2E-INV-202608-0001",
        },
        {
          id: 2,
          amount: 142.25,
          debtorName: "Van Dijk Transport",
          debtorIban: "BE68539007547034",
          debtorBic: "GEBABEBB",
          mandateRef: "MND-2026-0002",
          mandateSignatureDate: new Date("2026-02-01"),
          mandateType: "CORE",
          sequenceType: "RCUR",
          description: "August Fleet Invoices",
          endToEndId: "E2E-INV-202608-0002",
        },
      ];

      const creditorOptions: SepaCreditorOptions = {
        initiatingPartyName: "OCPP-CPMS Direct Debit Engine",
        creditorName: "ChargePoint Grid B.V.",
        creditorIban: "NL99BANK0123456789",
        creditorBic: "BANKNL2A",
        creditorSchemeId: "NL98ZZZ012345670000",
        mandateType: "CORE",
        sequenceType: "RCUR",
        collectionDate: "2026-09-05",
      };

      const xml = SepaXmlService.generatePain008002(mockCollections, creditorOptions);

      // Verify Document and schema header
      expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"');
      expect(xml).toContain("<CstmrDrctDbtInitn>");
      expect(xml).toContain("<NbOfTxs>2</NbOfTxs>");
      expect(xml).toContain("<CtrlSum>227.75</CtrlSum>"); // 85.50 + 142.25 = 227.75

      // Verify payment method and type info
      expect(xml).toContain("<PmtMtd>DD</PmtMtd>");
      expect(xml).toContain("<Cd>SEPA</Cd>");
      expect(xml).toContain("<Cd>CORE</Cd>");
      expect(xml).toContain("<SeqTp>RCUR</SeqTp>");
      expect(xml).toContain("<ReqdColltnDt>2026-09-05</ReqdColltnDt>");

      // Verify creditor info
      expect(xml).toContain("<Nm>ChargePoint Grid B.V.</Nm>");
      expect(xml).toContain("<IBAN>NL99BANK0123456789</IBAN>");
      expect(xml).toContain("<BIC>BANKNL2A</BIC>");
      expect(xml).toContain("<Id>NL98ZZZ012345670000</Id>");

      // Verify mandate and transaction details
      expect(xml).toContain("<InstdAmt Ccy=\"EUR\">85.50</InstdAmt>");
      expect(xml).toContain("<MndtId>MND-2026-0001</MndtId>");
      expect(xml).toContain("<DtOfSgntr>2026-01-15</DtOfSgntr>");
      expect(xml).toContain("<Nm>Acme Logistics BV</Nm>");
      expect(xml).toContain("<IBAN>NL91ABNA0417164300</IBAN>");
      expect(xml).toContain("<EndToEndId>E2E-INV-202608-0001</EndToEndId>");

      expect(xml).toContain("<InstdAmt Ccy=\"EUR\">142.25</InstdAmt>");
      expect(xml).toContain("<MndtId>MND-2026-0002</MndtId>");
      expect(xml).toContain("<DtOfSgntr>2026-02-01</DtOfSgntr>");
      expect(xml).toContain("<Nm>Van Dijk Transport</Nm>");
      expect(xml).toContain("<IBAN>BE68539007547034</IBAN>");
    });

    it("should generate a B2B first-time (FRST) direct debit XML batch", () => {
      const mockCollections: SepaDirectDebitItem[] = [
        {
          id: 10,
          amount: 500.0,
          debtorName: "Enterprise Fleet Corp & Co.",
          debtorIban: "DE89370400440532013000",
          debtorBic: "DEUTDEDD",
          mandateRef: "B2B-MND-9999",
          mandateSignatureDate: "2026-08-20",
          mandateType: "B2B",
          sequenceType: "FRST",
          description: "Initial B2B Fast Charging Mandate Setup",
        },
      ];

      const creditorOptions: SepaCreditorOptions = {
        creditorName: "ChargePoint Grid B.V.",
        creditorIban: "NL99BANK0123456789",
        creditorBic: "BANKNL2A",
        creditorSchemeId: "NL98ZZZ012345670000",
        mandateType: "B2B",
        sequenceType: "FRST",
      };

      const xml = SepaXmlService.generatePain008002(mockCollections, creditorOptions);

      expect(xml).toContain("<Cd>B2B</Cd>");
      expect(xml).toContain("<SeqTp>FRST</SeqTp>");
      expect(xml).toContain("<MndtId>B2B-MND-9999</MndtId>");
      expect(xml).toContain("Enterprise Fleet Corp &amp; Co."); // Escaped XML
    });
  });
});
