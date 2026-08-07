export interface SepaTransactionItem {
  id: number;
  totalAmount: number;
  month: number;
  year: number;
  userName?: string | null;
  iban: string;
}

export interface SepaHeaderOptions {
  companyName?: string;
  companyIban?: string;
  companyBic?: string;
}

export class SepaXmlService {
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

    const messageId = `MSG-${Date.now()}`;
    const creationDtTm = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const companyName = options.companyName || process.env.COMPANY_NAME || 'Company Name';
    const companyIban = options.companyIban || process.env.COMPANY_IBAN || 'NL99BANK0123456789';
    const companyBic = options.companyBic || process.env.COMPANY_BIC || 'BANKNL2A';

    let totalAmount = 0;
    let transactionsXml = '';

    ledgers.forEach((ledger) => {
      totalAmount += ledger.totalAmount;
      const txId = `TX-${ledger.id}-${Date.now()}`;
      const e2eId = `E2E-${ledger.id}-${Date.now()}`;
      const desc = `Reimbursement for ${ledger.month}/${ledger.year}`;
      const userName = (ledger.userName || 'Unknown User').substring(0, 70);

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
              <IBAN>${ledger.iban}</IBAN>
            </Id>
          </CdtrAcct>
          <RmtInf>
            <Ustrd>${desc.substring(0, 140)}</Ustrd>
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
        <Nm>Company Fleet Manager</Nm>
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
      <ReqdExctnDt>${new Date().toISOString().split('T')[0]}</ReqdExctnDt>
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
