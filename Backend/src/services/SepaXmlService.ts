export interface SepaTransactionItem {
  id: number;
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
   * Sanitizes IBAN by removing spaces and capitalizing
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
   * Generates standard ISO 20022 SEPA pain.001.001.03 XML for reimbursement payouts.
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
}
