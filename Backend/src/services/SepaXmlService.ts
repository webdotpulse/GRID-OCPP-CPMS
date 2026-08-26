export interface SepaTransactionItem {
  id: number | string;
  totalAmount: number;
  month: number;
  year: number;
  userName?: string | null;
  iban: string;
}

export interface SepaHeaderOptions {
  initiatingPartyName?: string;
  companyName?: string;
  companyIban?: string;
  companyBic?: string;
}

export interface SepaDirectDebitItem {
  id: number | string;
  amount: number;
  debtorName: string;
  debtorIban: string;
  debtorBic?: string | null;
  mandateRef: string;
  mandateSignatureDate: Date | string;
  mandateType?: "CORE" | "B2B" | string;
  sequenceType?: "FRST" | "RCUR" | "FNAL" | "OOFF" | string;
  description?: string;
  endToEndId?: string;
}

export interface SepaCreditorOptions {
  initiatingPartyName?: string;
  creditorName?: string;
  creditorIban?: string;
  creditorBic?: string;
  creditorSchemeId?: string;
  collectionDate?: Date | string;
  mandateType?: "CORE" | "B2B" | string;
  sequenceType?: "FRST" | "RCUR" | "FNAL" | "OOFF" | string;
}

// Lengths of standard IBANs per country
const IBAN_LENGTHS: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BE: 16, BA: 20, BR: 29, BG: 22, CR: 22,
  HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22,
  DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HU: 28, IS: 26, IE: 22, IL: 23, IT: 27,
  JO: 30, KZ: 20, KW: 30, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20, MK: 19, MT: 31,
  MR: 27, MU: 30, MC: 27, MD: 24, ME: 22, NL: 18, NO: 15, PK: 24, PS: 29, PL: 28,
  PT: 25, QA: 29, RO: 24, SM: 27, SA: 24, RS: 22, SK: 24, SI: 19, ES: 24, SE: 24,
  CH: 21, TN: 24, TR: 26, AE: 23, GB: 22, VG: 24,
};

export class SepaXmlService {
  /**
   * Safely escapes XML special characters to prevent XML injection
   */
  public static escapeXml(str: string | null | undefined): string {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Sanitizes IBAN by removing spaces, dashes, and capitalizing
   */
  public static sanitizeIban(iban: string | null | undefined): string {
    if (!iban) return "";
    return iban.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  /**
   * Sanitizes BIC by removing spaces and capitalizing
   */
  public static sanitizeBic(bic: string | null | undefined): string {
    if (!bic) return "";
    return bic.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  /**
   * Validates IBAN with ISO 7064 Mod-97-10 checksum calculation and country format checks.
   */
  public static isValidIban(iban: string | null | undefined): { valid: boolean; error?: string } {
    if (!iban) {
      return { valid: false, error: "IBAN is empty" };
    }

    const cleanIban = this.sanitizeIban(iban);

    if (cleanIban.length < 15 || cleanIban.length > 34) {
      return { valid: false, error: `Invalid IBAN length (${cleanIban.length} characters)` };
    }

    const countryCode = cleanIban.substring(0, 2);
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return { valid: false, error: "Invalid IBAN country prefix" };
    }

    const expectedLength = IBAN_LENGTHS[countryCode];
    if (expectedLength && cleanIban.length !== expectedLength) {
      return {
        valid: false,
        error: `Invalid IBAN length for ${countryCode}: expected ${expectedLength}, got ${cleanIban.length}`,
      };
    }

    // Rearrange: Move country code and check digits to end
    const rearranged = cleanIban.substring(4) + cleanIban.substring(0, 4);

    // Convert letters to digits (A=10, B=11, ..., Z=35)
    let numericStr = "";
    for (let i = 0; i < rearranged.length; i++) {
      const code = rearranged.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        numericStr += rearranged[i];
      } else if (code >= 65 && code <= 90) {
        numericStr += (code - 55).toString();
      } else {
        return { valid: false, error: "IBAN contains invalid characters" };
      }
    }

    // Modulo 97 check using BigInt or chunked remainder
    try {
      const remainder = BigInt(numericStr) % 97n;
      if (remainder === 1n) {
        return { valid: true };
      }
      return { valid: false, error: "Invalid IBAN checksum" };
    } catch {
      return { valid: false, error: "Failed to verify IBAN checksum" };
    }
  }

  /**
   * Validates BIC (Business Identifier Code / SWIFT) according to ISO 9362 (8 or 11 alphanumeric).
   */
  public static isValidBic(bic: string | null | undefined): { valid: boolean; error?: string } {
    if (!bic) {
      return { valid: false, error: "BIC is empty" };
    }

    const cleanBic = this.sanitizeBic(bic);
    const bicRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

    if (!bicRegex.test(cleanBic)) {
      return {
        valid: false,
        error: "Invalid BIC format (must be 8 or 11 alphanumeric characters matching SWIFT ISO 9362)",
      };
    }

    return { valid: true };
  }

  /**
   * Generates standard ISO 20022 SEPA pain.001.001.03 XML for reimbursement payouts (Credit Transfer).
   */
  public static generatePain001003(
    ledgers: SepaTransactionItem[],
    options: SepaHeaderOptions = {}
  ): string {
    if (!ledgers || ledgers.length === 0) {
      throw new Error("No reimbursement transactions provided for SEPA export.");
    }

    const messageId = this.escapeXml(`MSG-${Date.now()}`);
    const creationDtTm = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const initgPartyName = this.escapeXml((options.initiatingPartyName || "Company Fleet Manager").substring(0, 70));
    const companyName = this.escapeXml((options.companyName || process.env.COMPANY_NAME || "Company Name").substring(0, 70));
    const companyIban = this.escapeXml(this.sanitizeIban(options.companyIban || process.env.COMPANY_IBAN || "NL99BANK0123456789"));
    const companyBic = this.escapeXml(this.sanitizeBic(options.companyBic || process.env.COMPANY_BIC || "BANKNL2A"));

    let totalAmount = 0;
    let transactionsXml = "";

    ledgers.forEach((ledger) => {
      totalAmount += ledger.totalAmount;
      const txId = this.escapeXml(`TX-${ledger.id}-${Date.now()}`.substring(0, 35));
      const e2eId = this.escapeXml(`E2E-${ledger.id}-${Date.now()}`.substring(0, 35));
      const desc = this.escapeXml(`Reimbursement for ${ledger.month}/${ledger.year}`.substring(0, 140));
      const userName = this.escapeXml((ledger.userName || "Unknown User").substring(0, 70));
      const iban = this.escapeXml(this.sanitizeIban(ledger.iban));

      transactionsXml += `
        <CdtTrfTxInf>
          <PmtId>
            <InstrId>${txId}</InstrId>
            <EndToEndId>${e2eId}</EndToEndId>
          </PmtId>
          <Amt>
            <InstdAmt Ccy="EUR">${ledger.totalAmount.toFixed(2)}</InstdAmt>
          </Amt>
          <Cdtr>
            <Nm>${userName}</Nm>
          </Cdtr>
          <CdtrAcct>
            <Id>
              <IBAN>${iban}</IBAN>
            </Id>
          </CdtrAcct>
          <RmtInf>
            <Ustrd>${desc}</Ustrd>
          </RmtInf>
        </CdtTrfTxInf>`;
    });

    const numberOfTxs = ledgers.length;

    const sepaXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDtTm}</CreDtTm>
      <NbOfTxs>${numberOfTxs}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${initgPartyName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${messageId}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${numberOfTxs}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${new Date().toISOString().split("T")[0]}</ReqdExctnDt>
      <Dbtr>
        <Nm>${companyName}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${companyIban}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${companyBic}</BIC>
        </FinInstnId>
      </DbtrAgt>
${transactionsXml}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

    return sepaXml.trim();
  }

  /**
   * Generates ISO 20022 SEPA pain.008.001.02 XML for Direct Debit collections (B2B and CORE).
   */
  public static generatePain008002(
    collections: SepaDirectDebitItem[],
    creditorInfo: SepaCreditorOptions = {}
  ): string {
    if (!collections || collections.length === 0) {
      throw new Error("No direct debit collection items provided for SEPA export.");
    }

    const messageId = this.escapeXml(`DD-MSG-${Date.now()}`);
    const creationDtTm = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const initgPartyName = this.escapeXml((creditorInfo.initiatingPartyName || "OCPP-CPMS Billing System").substring(0, 70));
    const creditorName = this.escapeXml((creditorInfo.creditorName || process.env.COMPANY_NAME || "OCPP-CPMS Operator").substring(0, 70));
    const creditorIban = this.escapeXml(this.sanitizeIban(creditorInfo.creditorIban || process.env.COMPANY_IBAN || "NL99BANK0123456789"));
    const creditorBic = this.escapeXml(this.sanitizeBic(creditorInfo.creditorBic || process.env.COMPANY_BIC || "BANKNL2A"));
    const creditorSchemeId = this.escapeXml(creditorInfo.creditorSchemeId || process.env.SEPA_CREDITOR_ID || "NL98ZZZ012345670000");

    const batchMandateType = creditorInfo.mandateType === "B2B" ? "B2B" : "CORE";
    const batchSeqType = creditorInfo.sequenceType || "RCUR";
    const collectionDateStr = creditorInfo.collectionDate
      ? (typeof creditorInfo.collectionDate === "string"
          ? creditorInfo.collectionDate.split("T")[0]
          : creditorInfo.collectionDate.toISOString().split("T")[0])
      : new Date().toISOString().split("T")[0];

    let totalAmount = 0;
    let transactionsXml = "";

    collections.forEach((item) => {
      totalAmount += item.amount;
      const e2eId = this.escapeXml((item.endToEndId || `E2E-DD-${item.id}-${Date.now()}`).substring(0, 35));
      const desc = this.escapeXml((item.description || `Collection for EV Charging ID ${item.id}`).substring(0, 140));
      const debtorName = this.escapeXml(item.debtorName.substring(0, 70));
      const debtorIban = this.escapeXml(this.sanitizeIban(item.debtorIban));
      const debtorBic = this.escapeXml(this.sanitizeBic(item.debtorBic || "NOTPROVIDED"));
      const mandateRef = this.escapeXml(item.mandateRef.substring(0, 35));

      const signDateStr = item.mandateSignatureDate
        ? (typeof item.mandateSignatureDate === "string"
            ? item.mandateSignatureDate.split("T")[0]
            : item.mandateSignatureDate.toISOString().split("T")[0])
        : new Date().toISOString().split("T")[0];

      transactionsXml += `
        <DrctDbtTxInf>
          <PmtId>
            <EndToEndId>${e2eId}</EndToEndId>
          </PmtId>
          <InstdAmt Ccy="EUR">${item.amount.toFixed(2)}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${mandateRef}</MndtId>
              <DtOfSgntr>${signDateStr}</DtOfSgntr>
            </MndtRltdInf>
          </DrctDbtTx>
          <DbtrAgt>
            <FinInstnId>
              <BIC>${debtorBic}</BIC>
            </FinInstnId>
          </DbtrAgt>
          <Dbtr>
            <Nm>${debtorName}</Nm>
          </Dbtr>
          <DbtrAcct>
            <Id>
              <IBAN>${debtorIban}</IBAN>
            </Id>
          </DbtrAcct>
          <RmtInf>
            <Ustrd>${desc}</Ustrd>
          </RmtInf>
        </DrctDbtTxInf>`;
    });

    const numberOfTxs = collections.length;

    const sepaXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDtTm}</CreDtTm>
      <NbOfTxs>${numberOfTxs}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${initgPartyName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${messageId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${numberOfTxs}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>${batchMandateType}</Cd>
        </LclInstrm>
        <SeqTp>${batchSeqType}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${collectionDateStr}</ReqdColltnDt>
      <Cdtr>
        <Nm>${creditorName}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${creditorIban}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BIC>${creditorBic}</BIC>
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <OrgId>
            <Othr>
              <Id>${creditorSchemeId}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </OrgId>
        </Id>
      </CdtrSchmeId>
${transactionsXml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

    return sepaXml.trim();
  }
}
