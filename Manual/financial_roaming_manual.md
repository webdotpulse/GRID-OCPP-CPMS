# Financial & Roaming Operations Manual

Welcome to the Financial & Roaming Operations Manual for the OCPP Central Processing Management System (CPMS). This guide is designed for business administrators and financial officers to navigate the core financial systems, roaming integrations, and settlement workflows.

## 1. Billing & Mollie Integration

The billing engine calculates the final cost of a charging session dynamically based on assigned tariffs and user profiles.

### End-to-End Billing Cycle

```mermaid
graph TD
    A[Charger sends StopTransaction] --> B[OCPP Server Parses Meter values & Duration]
    B --> C[Fetch Assigned Tariff]
    C --> D{Calculate Fees}
    D --> E[Connection Fee]
    D --> F[Time Fee & Idle Fee]
    D --> H[Energy Fee - Flat or Dynamic EPEX]
    E & F & H --> I[Total Cost Computed]
    I --> J[Save Transaction to Database]
    J --> K{Billing Type}
    K -- Ad-Hoc --> L[Create Mollie PaymentIntent]
    L --> M[User Input Payment via Frontend]
    M --> N[Mollie processes charge]
    N --> O[Mollie Webhook sent to backend]
    O --> P[Update PaymentTransaction to 'succeeded']
    K -- Contract / Post-Paid --> Q[Monthly Invoice Generation]
```

### Tariff Calculations
Tariffs are determined by looking up the `ChargeGroupUser` assignment, or falling back to the default `Charger` tariff. The final cost of a session is calculated exactly when the `StopTransaction` event is received from the EVSE.

The system computes:
- **Connection Fee:** A flat fee triggered per session start.
- **Time Fee:** Cost based on total connected minutes.
- **Idle Fee:** Cost based on minutes where the charger is plugged in but power draw is 0W.
- **Energy Fee:** Can be either a flat rate per kWh or dynamically calculated based on live EPEX spot market prices. For dynamic tariffs, exact consumption deltas between individual `meterValue` timestamps are multiplied by the spot market price of that exact interval.

### Invoicing & Automated Billing ("Facturen")

The platform provides a complete enterprise invoicing subsystem located under `/invoices` (displayed in Dutch as **Facturen**), supporting both B2B corporate billing and private subscriber accounting.

```mermaid
flowchart LR
    Sessions["Completed Transactions\n(Unbilled Sessions)"] --> Aggregator["Monthly Invoice\nGenerator Engine"]
    Aggregator --> Invoice["Tax Invoice PDF & Record\n(Subtotal + 21% VAT)"]
    Invoice --> Mandate{"Payment Method"}
    Mandate -->|Direct Debit| SEPA["ISO 20022 Direct Debit XML\n(pain.008.001.02)"]
    Mandate -->|Credit Card / iDEAL| Mollie["Mollie Hosted Checkout\n& Webhook Settlement"]
    SEPA --> Bank["Corporate Banking Portal\n(Campr.053 reconciliation)"]
```

#### Key Capabilities of the Invoicing Suite:
1. **Automated Monthly Billing Runs (`/invoices` - [39_Invoices_Billing_Ledger.png](../Screenshots/39_Invoices_Billing_Ledger.png)):**
   - Summarizes total subtotal, VAT (21%), gross turnover, paid amounts, and pending receivables in real-time KPI summary widgets.
   - Filters invoices by status (`Draft`, `Sent`, `Paid`, `Overdue`, `Cancelled`), payment method, and billing period.
2. **Detailed Itemized Invoice View ([40_Invoices_Detail_Modal.png](../Screenshots/40_Invoices_Detail_Modal.png)):**
   - Displays full line-item breakdowns per charging transaction, including meter start/stop timestamps, kWh consumed, energy tariff rates, idle duration penalties, and VAT calculation.
   - Provides direct one-click PDF generation and email delivery to customer contact addresses.
3. **Batch Generation Wizard ([41_Invoices_Generate_Dialog.png](../Screenshots/41_Invoices_Generate_Dialog.png)):**
   - Automatically groups all unbilled completed transactions across a calendar month into consolidated client invoices.
4. **SEPA Core Direct Debit Mandates ([42_Invoices_SEPA_Mandates_Dialog.png](../Screenshots/42_Invoices_SEPA_Mandates_Dialog.png)):**
   - Manages formal B2B / CORE direct debit mandates with unique Mandate Identification (UMR), debtor IBAN/BIC, signature date, and active authorization state.
5. **ISO 20022 SEPA Direct Debit XML Export ([43_Invoices_DirectDebit_Export_Dialog.png](../Screenshots/43_Invoices_DirectDebit_Export_Dialog.png)):**
   - Compiles all unpaid invoices into a single banking-grade `pain.008.001.02` XML direct debit batch file with creditor identifier, batch sequence (`FRST` / `RCUR`), and execution date.

### Mollie Integration (Ad-Hoc & Public Checkout)
Ad-hoc payments enable walk-in customers to pay directly via credit card, iDEAL, or Bancontact without prior registration ([60_Public_Payments_Checkout.png](../Screenshots/60_Public_Payments_Checkout.png)).
- The system generates a `PaymentIntent` containing the exact `amountInCents` upon completion of the charge.
- Users are presented with the Mollie `PaymentElement` in the frontend UI.
- The backend listens for the `payment_intent.succeeded` and `payment_intent.payment_failed` webhooks on `/api/payments/webhook`. It ensures raw body signature validation before marking the transaction as settled.
- Gateway credentials and API keys are managed centrally in `/settings/payments` ([70_Settings_MolliePayments_Gateway.png](../Screenshots/70_Settings_MolliePayments_Gateway.png)).

## 2. Reimbursements & Split-Billing

The reimbursement system is built for split-billing, designed primarily to reimburse employees for charging fleet vehicles at their personal home chargers.

### Workflow
1. **Contracts:** Administrators or users create a `ReimbursementContract` via the UI. This maps a `userId`, `rfidUserId` (fleet vehicle tag), `stationId` (employee home charger), an assigned `tariffId` (their home electricity rate), and their `IBAN`.
2. **Ledgers:** Each month, a `ReimbursementLedger` automatically aggregates the `totalKwh` consumed and the `totalAmount` due for that specific contract.
3. **SEPA Export:** Instead of manually transferring funds, finance officers can click **Export SEPA** in the UI. The backend generates a validated `pain.001.001.03` SEPA XML file containing all pending transfers, ready to be uploaded directly into your corporate banking portal.

## 3. Roaming (OCPI & OICP)

To maximize station utilization and allow your contracted drivers to charge anywhere, the system acts as both a Charge Point Operator (CPO) and a Mobility Service Provider (MSP) through the OCPI and OICP protocols.

### Configuring Connections
Connections to roaming hubs (e.g., Hubject, Gireve, or peer-to-peer CPOs) are configured in the Roaming UI tab.
- **OCPI Configuration:** Enter the Endpoint URL and the `Authorization: Token` credentials. OCPI is typically used for peer-to-peer roaming or direct hub integration.
- **OICP Configuration:** Enter the Endpoint URL and `Authorization: Bearer` credentials (standard for Hubject).

### CDR Pushes & Pulls
When a driver roams on your network (CPO mode), the CPMS captures the session and automatically generates a Charge Detail Record (CDR) which is pushed to the roaming partner.
When your driver uses an external network (MSP mode), the roaming partner pushes the CDR to your CPMS. The system reconciles this record against the roaming contract margin to display wholesale vs. retail costs.

## 4. Settlement & Ad-Manager

### Financial Settlements
The Settlement module generates monthly clearinghouse reports. These are essential for reconciling roaming revenue and costs.
- It aggregates all `RoamingSession` records.
- Calculates `totalWholesaleBilled`, `totalBaseCost`, and `netMargin` per partner.
- Heatmaps visualize stations attracting the most roaming sessions.
- Data can be exported as a raw CSV (`monthly_clearinghouse_report.csv`) for accounting software integration.

### Ad-Manager
For display-enabled chargers, the CPMS features an Ad-Manager to generate supplementary revenue.
- Advertisers or marketing teams can upload image (PNG, JPG) or video (MP4) assets.
- Drag-and-drop file uploads are supported in the Ad-Manager UI.
- Campaigns can be targeted specifically to individual stations, station groups, or entire geographic regions.
- The system handles the distribution of these media assets directly to compatible OCPP EVSE screens over the network.
