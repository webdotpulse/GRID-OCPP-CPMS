# Financial & Roaming Operations Manual

Welcome to the **Financial & Roaming Operations Manual** for the OCPP Central Processing Management System (CPMS). This guide is designed for Chief Financial Officers (CFOs), billing accountants, roaming managers, and business administrators to navigate the platform's core billing systems, banking exports, payment gateways, and roaming settlement workflows.

---

## 1. Billing, Invoicing ("Facturen") & Payment Gateways

The CPMS billing engine computes the financial cost of charging sessions in real-time and provides an enterprise-grade invoicing ledger supporting both contract subscription billing and walk-in ad-hoc payments.

### End-to-End Billing Cycle

```mermaid
flowchart TD
    A["⚡ Charger sends StopTransaction\n(Final Meter & Timestamp)"] --> B["OCPP Server Normalizes\nMeter Values & Duration"]
    B --> C["Fetch Assigned Tariff\n(User Group / Station / Charger)"]
    C --> D{"Calculate Fee Components"}
    D --> E["Connection Fee (€)"]
    D --> F["Time Fee & Idle Fee (€/hr)"]
    D --> H["Energy Fee (€/kWh)\n(Flat Rate or Dynamic EPEX)"]
    E & F & H --> I["Total Net Cost & 21% VAT Computed"]
    I --> J["Save Transaction Record in Database"]
    J --> K{"Customer Billing Method"}
    K -- Ad-Hoc Public --> L["Create Stripe or Mollie Checkout Session"]
    L --> M["Customer Completes Checkout via Hosted UI"]
    M --> N["Webhook Verified (/api/payments/webhook[/stripe])"]
    N --> O["Mark Transaction 'Paid'"]
    K -- Contract / Post-Paid --> Q["Consolidated Monthly Invoicing Run ('Facturen')"]
```

---

### Invoicing & Automated Billing Suite ("Facturen")

The platform provides a complete enterprise invoicing subsystem located under `/invoices` (localized in Dutch as **Facturen** and French as **Factures**), supporting both B2B corporate billing and private subscriber accounting.

```mermaid
flowchart LR
    Sessions["Completed Transactions\n(Unbilled Sessions)"] --> Aggregator["Monthly Invoice\nGenerator Engine"]
    Aggregator --> Invoice["Tax Invoice PDF & Record\n(Subtotal + 21% VAT)"]
    Invoice --> Mandate{"Payment Method"}
    Mandate -->|Direct Debit| SEPA["ISO 20022 Direct Debit XML\n(pain.008.001.02)"]
    Mandate -->|Credit Card / Wallets / iDEAL| Gateways["Stripe & Mollie Hosted Checkout\n& Webhook Settlement"]
    SEPA --> Bank["Corporate Banking Portal\n(Camt.053 reconciliation)"]
```

#### Key Capabilities of the Invoicing Suite:

#### 1. Billing Ledger Overview (`/invoices`)
The centralized billing ledger tracks all corporate and driver invoices with real-time financial KPI summary widgets:
* **Gross Turnover, Subtotal & 21% VAT:** Immediate aggregated view across billing periods.
* **Status Filtering:** Filter by `Draft`, `Sent`, `Paid`, `Overdue`, `Cancelled`.
* **Payment Methods:** Distinguish between SEPA Direct Debit, Credit Card, and Manual Bank Wire.

![Invoices Billing Ledger](../Screenshots/39_Invoices_Billing_Ledger.png)

---

#### 2. Detailed Itemized Invoice View
Opening any invoice record provides a line-item breakdown of all aggregated charging sessions:
* Meter start/stop timestamps, consumed kWh, duration, energy tariff rates, and idle fee penalties.
* Real-time PDF generation and direct email dispatch to the customer's billing contact.

![Invoice Detail Modal](../Screenshots/40_Invoices_Detail_Modal.png)

---

#### 3. Batch Generation Wizard
The **Generate Invoices Wizard** consolidates all unbilled completed transactions across a selected calendar month into formalized client invoices.

![Generate Invoices Dialog](../Screenshots/41_Invoices_Generate_Dialog.png)

---

#### 4. SEPA Direct Debit Mandate Management
Manage formal B2B and CORE Direct Debit mandates:
* Unique Mandate Identifier (UMR).
* Debtor IBAN, BIC, and account holder name.
* Electronic signature date and active authorization state.

![SEPA Direct Debit Mandates Dialog](../Screenshots/42_Invoices_SEPA_Mandates_Dialog.png)

---

#### 5. ISO 20022 SEPA Direct Debit XML Export (`pain.008`)
Compile all pending unpaid invoices into a banking-compliant ISO 20022 `pain.008.001.02` XML direct debit batch file:
* Creditor Identifier (CI) and creditor bank details.
* Batch sequence type (`FRST` for first collection, `RCUR` for recurring collections).
* Configurable execution date ready for direct upload to banking portals (ABN AMRO, ING, Rabobank, BNP Paribas, KBC).

![SEPA Direct Debit Export Dialog](../Screenshots/43_Invoices_DirectDebit_Export_Dialog.png)

---

### Stripe & Mollie Ad-Hoc Public Payments & Gateway Settings

For walk-in drivers without an RFID subscription card, the CPMS offers instant ad-hoc checkout via dual payment processors:

* **Stripe Gateway (`/settings/payments`):**
  * **Global Payment Methods:** Settle charging sessions using Visa, MasterCard, American Express, Apple Pay, Google Pay, and SEPA Credit.
  * **Webhook Integration:** Automated status synchronization via `/api/payments/webhook/stripe` listening to `checkout.session.completed`, `payment_intent.succeeded`, and `charge.refunded`.
  * **PCI-DSS Level 1 Hosted Checkout:** Secure tokenization without exposing sensitive card credentials to CPMS servers.
* **Mollie Gateway (`/settings/payments`):**
  * **European Direct Banking:** Optimized for Benelux and European markets supporting iDEAL 2.0, Bancontact, EPS, KBC/CBC, and Belfius.
  * **Webhook Verification:** Instant server-to-server callback processing via `/api/payments/webhook`.
* **Public Checkout Portal (`/payments`):**
  * Drivers scan a station QR code or visit the checkout portal to select their preferred payment provider and complete 256-bit encrypted checkout.

| Public Payments Checkout | Payment Gateways Settings (Stripe & Mollie) |
| :---: | :---: |
| ![Public Payments Checkout](../Screenshots/60_Public_Payments_Checkout.png) | ![Payment Gateways](../Screenshots/70_Settings_MolliePayments_Gateway.png) |

---

## 2. Employee Home Reimbursements & Split-Billing

The **Reimbursements** module (`/reimbursements`) is built for corporate fleet split-billing, designed specifically to reimburse employees for electricity consumed when charging company fleet vehicles at their residential home chargers.

```mermaid
sequenceDiagram
    participant EV as 🚗 Company Vehicle
    participant CP as 🏠 Employee Home Charger
    participant CPMS as CPMS Reimbursement Engine
    participant SEPA as 🏦 ISO 20022 SEPA XML
    participant Bank as Corporate Banking Portal

    EV->>CP: Charge with Fleet RFID Tag
    CP->>CPMS: StartTransaction & StopTransaction
    CPMS->>CPMS: Match Contract (User + Tag + Home Station + Tariff)
    CPMS->>CPMS: Monthly Ledger: Aggregate kWh * Home Tariff (€)
    CPMS->>SEPA: Generate pain.001.001.03 Credit Transfer Batch
    SEPA->>Bank: Finance Uploads XML for Automated Payout
    Bank-->>EV: Employee Receives Direct IBAN Reimbursement
```

### Reimbursement Workflow

1. **Reimbursement Contracts:** An administrator creates a contract linking a `userId` (employee), `rfidUserId` (company car RFID tag), `stationId` (home charger), `tariffId` (employee's residential electricity rate), and the employee's payout `IBAN`.
2. **Monthly Expense Ledger:** The system automatically aggregates all home charging sessions for the contract, computing exact `totalKwh` and `totalAmount` due.
3. **ISO 20022 SEPA Credit Transfer Export:** Finance officers click **Export SEPA** to generate a validated `pain.001.001.03` XML file for single-batch corporate bank transfers.

![Reimbursements Home Charging SEPA](../Screenshots/44_Reimbursements_HomeCharging_SEPA.png)

---

## 3. Roaming Hubs (OCPI 2.2.1 & OICP Hubject)

To maximize charger utilization and allow contracted drivers to charge on external networks, the CPMS acts as both a **Charge Point Operator (CPO)** and an **e-Mobility Service Provider (eMSP)**.

### 3.1 OCPI 2.2.1 Implementation
* **Credentials:** Secure handshake and token exchange with roaming partners.
* **Locations & EVSEs:** Automated publishing of station geolocations, connector specs, and live availability.
* **Tariffs:** Export 4-component pricing structures to roaming hubs.
* **Sessions & CDRs:** Real-time push of active roaming sessions and finalized Charge Detail Records.

![OCPI Roaming Hubs](../Screenshots/48_Roaming_OCPI_Hubs.png)

### 3.2 Hubject OICP 2.3 Integration
* Automated EVSE status synchronization with Hubject's Open InterCharge Protocol.
* Asynchronous Charge Detail Record (CDR) submission processed through BullMQ background event queues.

![Hubject OICP Roaming](../Screenshots/49_Roaming_OICP_Hubject_Tab.png)

### 3.3 Roaming Settlement Visualizer & Clearinghouse Export
The **Settlement Visualizer** (`/roaming`) breaks down roaming economics:
* Compare wholesale partner energy costs against retail MSP driver billing.
* Calculate net margin, gross revenue, and volume per roaming partner.
* Export standardized clearinghouse CSV reconciliation files.

![Roaming Settlement Visualizer](../Screenshots/50_Roaming_Settlement_Visualizer_Tab.png)
