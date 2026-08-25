# Comprehensive Repository Analysis & System Proposals: OCPP-CPMS

**Platform:** Enterprise Centralized Charge Point Management System (OCPP-CPMS)  
**Repository:** `webdotpulse/OCPP-CPMS`  
**Date:** August 25, 2026  
**Author:** Antigravity (Google DeepMind Advanced Agentic AI)

---

## Executive Summary & Architectural Evaluation

The OCPP-CPMS platform is a modern, high-performance EV Charging Station Management System designed for Charge Point Operators (CPOs) and e-Mobility Service Providers (eMSPs). Following the clean removal of external EMS hardware dependencies, the system is positioned to excel as an independent, cloud-native, and multi-tenant smart charging platform.

This document presents a comprehensive deep-dive into the repository architecture across **8 key technical domains**, identifying critical fixes, structural optimizations, and indispensable features that must be added to achieve tier-1 commercial grade reliability.

Each proposal includes:
1. **Current State & Technical Gap Analysis**
2. **Proposed Architectural Solution & Implementation Detail**
3. **🤖 Ready-to-Use Agent Prompt** (copy-paste ready for immediate autonomous execution).

---

## Table of Proposals

| ID | Domain | Proposal Title | Severity / Priority |
| :--- | :--- | :--- | :---: |
| **ARC-01** | Architecture & Scale | BullMQ Job Queue Engine for Asynchronous OCPP Meter & Event Ingestion | 🔴 High |
| **ARC-02** | Architecture & Scale | Process Decoupling & Multi-Pod Redis Pub/Sub WebSocket Synchronization | 🟠 Medium-High |
| **PRT-01** | OCPP Protocol | Complete OCPP 2.0.1 / 2.1 ISO 15118 Plug & Charge PKI Pipeline | 🔴 Critical |
| **PRT-02** | OCPP Protocol | Smart Charging Profile Stack Priority Resolution & Composite Engine | 🔴 High |
| **ENG-01** | Smart Charging | Hierarchical 3-Phase Dynamic Load Balancing (DLB) with Phase Unbalance Mitigation | 🔴 Critical |
| **ENG-02** | Smart Charging | Native Solar Inverter Cloud Telemetry Integrations (SolarEdge, Fronius, Enphase) | 🟠 Medium |
| **ROM-01** | Roaming & Interop | Complete Bilateral OCPI 2.2.1 CPO & eMSP Modules with Automated CDR Exchange | 🔴 High |
| **ROM-02** | Roaming & Interop | Hubject OICP 2.3 Dynamic EVSE Broadcast & Authorize Integration | 🟠 Medium-High |
| **SEC-01** | Security & Auth | Mutual TLS (mTLS) X.509 Authentication for OCPP WebSockets & Strict RBAC/ABAC | 🔴 Critical |
| **SEC-02** | Security & Auth | Webhook HMAC SHA-256 Signature Verification & Immutable Audit Logging Ledger | 🟠 High |
| **FIN-01** | Billing & Tariffs | Automated Monthly Invoicing Engine with PDF Generation & Multi-Tax Support | 🔴 High |
| **FIN-02** | Billing & Tariffs | SEPA Direct Debit B2B/CORE (`pain.008.001.02`) Automated Mandate & Collection | 🟠 High |
| **UIX-01** | Frontend & UX | Live Interactive Station Topology Canvas & Feeder Cable Load Visualizer | 🟠 Medium |
| **UIX-02** | Frontend & UX | Real-time OCPP Packet Inspector with Wireshark-Style Protocol Decoding | 🟠 Medium |
| **OPS-01** | DevOps & QA | Virtual Charger Fleet Simulator (100+ Virtual OCPP 1.6/2.0.1 Chargers) | 🔴 High |
| **OPS-02** | DevOps & QA | Production Docker Compose, Helm Charts, and OpenTelemetry Distributed Tracing | 🟠 High |

---

# 1. Architecture & Scalability

---

### ARC-01: BullMQ Job Queue Engine for Asynchronous OCPP Meter & Event Ingestion
- **Category:** Architecture & Performance
- **Priority:** 🔴 **High**
- **Problem Statement:**  
  Currently, high-volume OCPP `MeterValues` and `StatusNotification` frames execute database writes or temporary Redis list pops synchronously within the WebSocket event loop. Under a fleet of 500+ chargers reporting 1-second sampled meter values, database connection pool exhaustion occurs, causing WebSocket heartbeat timeouts and dropped charger connections.
- **Proposed Solution:**  
  Integrate **BullMQ** with Redis to handle queueing and worker decoupling:
  1. OCPP WebSocket handlers push incoming meter values, transaction status updates, and telemetry frames into dedicated BullMQ queues (`meter-values-queue`, `events-queue`, `cdr-queue`).
  2. Background worker processes consume batches with backoff retries, rate limiting, and bulk database insertions.
  3. Ensure idempotency using transaction and sequence message keys.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (ARC-01)
```text
Implement a BullMQ-based asynchronous processing pipeline for high-volume OCPP events and meter values in Backend.
1. Install bullmq and @types/bullmq in Backend/package.json.
2. Create Backend/src/queues/queueManager.ts to initialize Redis-backed BullMQ queues: 'meterValuesQueue', 'statusEventsQueue', and 'billingQueue'.
3. In Backend/src/ocpp/handlers/meterValues.ts and startTransaction.ts, refactor handlers to push raw payloads directly to the corresponding BullMQ queue with immediate ACK response to the charger.
4. Create worker handlers in Backend/src/workers/meterValuesWorker.ts and eventWorker.ts with batch processing (concurrency: 50, batch size: 100), exponential backoff retries, and bulk Prisma database upserts.
5. Provide graceful worker shutdown in Backend/src/app.ts upon receiving SIGTERM/SIGINT.
```
```

---

### ARC-02: Process Decoupling & Multi-Pod Redis Pub/Sub WebSocket Synchronization
- **Category:** Architecture & Infrastructure
- **Priority:** 🟠 **Medium-High**
- **Problem Statement:**  
  The HTTP REST API, Socket.IO server, and OCPP WebSocket server currently run inside a single monolithic Node.js process. When scaling to multiple pods behind a load balancer, remote commands (e.g. `RemoteStartTransaction`, `SetChargingProfile`) require WebSocket sticky sessions or fails if the charger is connected to Pod A while the HTTP request arrives at Pod B.
- **Proposed Solution:**  
  Decouple the codebase into independent runnable entry points:
  1. `src/server.ts` (API & Webhook gateway)
  2. `src/ocppServer.ts` (Dedicated OCPP WebSocket ingestion pod)
  3. `src/workerServer.ts` (Dedicated background worker pod)
  Use Redis Pub/Sub with request-response correlation IDs (`ocpp:cmd:<chargerId>`, `ocpp:res:<msgId>`) so any API pod can seamlessly invoke remote controls on any charger connected to any OCPP WebSocket pod.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (ARC-02)
```text
Refactor Backend entrypoints to support decoupled process execution and distributed multi-pod OCPP remote control synchronization via Redis.
1. Create separate CLI execution scripts in Backend/package.json: "start:api", "start:ocpp", "start:worker".
2. Implement a distributed Redis RPC bridge in Backend/src/ocpp/distributedRemoteControl.ts that publishes commands to channel `ocpp:cmd:${chargerId}` and awaits response on `ocpp:res:${messageId}` with configurable timeout (15s).
3. In Backend/src/ocpp/ocppServer.ts, subscribe each WebSocket server pod to incoming commands for its locally connected chargers and return CALLRESULT via Redis.
4. Update Backend/src/ocpp/remoteControl.ts to utilize the distributed RPC bridge instead of relying on in-memory charger sockets.
```
```

---

# 2. OCPP Protocol Compliance & Next-Gen Support

---

### PRT-01: Complete OCPP 2.0.1 / 2.1 ISO 15118 Plug & Charge PKI Pipeline
- **Category:** Protocol & Standards
- **Priority:** 🔴 **Critical**
- **Problem Statement:**  
  While the repository contains OCPP 2.0.1/2.1 router skeletons, it lacks the full cryptographic Public Key Infrastructure (PKI) for ISO 15118-2 and ISO 15118-20 Plug & Charge. Without this, modern vehicles (e.g., Porsche Taycan, Mercedes EQ, Hyundai Ioniq 5/6) cannot perform automatic contract certificate authorization or secure TLS handshake negotiation.
- **Proposed Solution:**  
  1. Implement `GetInstalledCertificateIds`, `InstallCertificate`, `DeleteCertificate`, and `Authorize` with `15118CertificateHashData`.
  2. Implement automated Certificate Signing Requests (CSR) handling with Root Sub-CA and V2G PKI certificate issuance.
  3. Add Contract Certificate Pool management and automated OCSP (Online Certificate Status Protocol) validation.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (PRT-01)
```text
Implement the complete ISO 15118 Plug & Charge PKI management module for OCPP 2.0.1 and 2.1 in the Backend.
1. In Backend/src/ocpp/v201/handlers/, implement certificate management handlers:
   - CertificateSignedHandler.ts (handling CSR responses from chargers)
   - GetInstalledCertificateIdsHandler.ts
   - InstallCertificateHandler.ts
   - DeleteCertificateHandler.ts
2. In Backend/src/services/PkiCertificateService.ts, build an X.509 certificate generator and OCSP status checker using node-forge or native crypto.
3. In Backend/src/ocpp/handlers/authorize.ts, add ISO 15118 certificate hash validation against active vehicle contract certificates in prisma.vehicleContractCertificate.
4. Add unit tests in Backend/src/tests/ocpp/pkiCertificate.test.ts validating CSR validation, certificate installation, and certificate expiry alerts.
```
```

---

### PRT-02: Smart Charging Profile Stack Priority Resolution & Composite Engine
- **Category:** Protocol & Energy Optimization
- **Priority:** 🔴 **High**
- **Problem Statement:**  
  When multiple charging profiles (e.g. MaxChargingProfiles at stack level 0, TxDefaultProfiles at stack level 1, TxProfiles at stack level 2, and V2G Discharging at stack level 3) overlap in time, the CPMS must calculate a single composite schedule and resolve conflicting limits. Currently, profiles overwrite each other without merging.
- **Proposed Solution:**  
  Build a compliant **Composite Schedule Generator**:
  1. Implement `GetCompositeSchedule` handler in OCPP 1.6 & 2.0.1/2.1.
  2. Implement hierarchical stack level merging: `TxProfile` (highest) > `TxDefaultProfile` > `ChargePointMaxProfile` (lowest limit ceiling).
  3. Support duration periods with step-wise and polynomial interpolation.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (PRT-02)
```text
Create a comprehensive Smart Charging Composite Schedule Engine in Backend/src/services/SmartChargingProfileService.ts.
1. Implement calculateCompositeSchedule(chargerId, connectorId, durationSeconds, chargingRateUnit):
   - Fetch active profiles: ChargePointMaxProfile, TxDefaultProfile, and active TxProfile.
   - Resolve stack level precedence (StackLevel 3 > StackLevel 2 > StackLevel 1 > StackLevel 0).
   - Enforce the lowest ceiling limit at every interval slice (seconds).
2. Add support for OCPP 1.6 GetCompositeSchedule and OCPP 2.0.1/2.1 RequestCompositeSchedule RPC calls in Backend/src/ocpp/remoteControl.ts.
3. Add full unit test suite in Backend/src/tests/services/SmartChargingProfileService.test.ts covering conflicting profiles, multiple periods, and unit conversions (Amperes <-> Kilowatts).
```
```

---

# 3. Native Smart Charging & Grid Services

---

### ENG-01: Hierarchical 3-Phase Dynamic Load Balancing (DLB) with Phase Unbalance Mitigation
- **Category:** Energy & Grid Management
- **Priority:** 🔴 **Critical**
- **Problem Statement:**  
  EV chargers with single-phase vehicles (e.g., drawing 32A on L1 only) connect to 3-phase installations. When multiple single-phase cars charge simultaneously on the same phase, severe phase unbalance occurs, tripping main building breakers even when total kilowatt capacity is well within limits.
- **Proposed Solution:**  
  1. Extend `ChargeGroup` and `Connector` models to store phase mappings (L1, L2, L3).
  2. Read live phase amperages (`Current.Import.L1`, `Current.Import.L2`, `Current.Import.L3`) from OCPP `MeterValues`.
  3. Dynamic Phase Balancing Algorithm: dynamically throttle single-phase chargers or shift charging schedules to balance phase loads across the site.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (ENG-01)
```text
Implement a 3-Phase Dynamic Load Balancing (DLB) engine with Phase Unbalance Protection in Backend.
1. Update Backend/prisma/schema.prisma:
   - Add `phaseConnection` (String @default("L1-L2-L3")) to model Connector.
   - Add `maxPhaseCurrent` (Float @default(80.0)) and `maxPhaseUnbalance` (Float @default(16.0)) to model ChargeGroup.
2. In Backend/src/services/LoadManagementService.ts, implement balancePhasesForGroup(groupId):
   - Parse live MeterValues for current on L1, L2, and L3 across all active connectors.
   - If (max(L1, L2, L3) - min(L1, L2, L3)) > maxPhaseUnbalance or any phase exceeds maxPhaseCurrent, recalculate dynamic SetChargingProfile limits per connector.
3. Add unit test suite in Backend/src/tests/services/PhaseLoadManagement.test.ts verifying phase unbalance throttling and restoration.
```
```

---

### ENG-02: Native Solar Inverter Cloud Telemetry Integrations (SolarEdge, Fronius, Enphase)
- **Category:** Smart Charging & Renewables
- **Priority:** 🟠 **Medium**
- **Problem Statement:**  
  With hardware EMS gateways removed, the CPMS needs direct cloud-to-cloud API integrations with common solar inverters so that residential and commercial CPOs can enable 100% Green Solar Surplus Charging automatically without local hardware boxes.
- **Proposed Solution:**  
  1. Create a pluggable Inverter Cloud Integration service supporting:
     - **SolarEdge Monitoring API** (Site Overview & Power Flow)
     - **Fronius Solar.web API**
     - **Enphase Enlighten API**
     - **SMA Sunny Portal API**
  2. Allow station owners to configure API credentials in station settings.
  3. Ingest real-time PV generation every 60 seconds and route surplus solar amps directly to connected vehicles.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (ENG-02)
```text
Build native cloud solar inverter integration providers for SolarEdge, Fronius, and Enphase in Backend.
1. In Backend/prisma/schema.prisma, add `inverterProvider` (String?), `inverterApiKey` (String?), and `inverterSiteId` (String?) to ChargingStation.
2. Create Backend/src/services/inverters/InverterServiceFactory.ts and providers for:
   - SolarEdgeProvider.ts (fetch current solar generation kW)
   - FroniusProvider.ts
   - EnphaseProvider.ts
3. In Backend/src/services/PredictiveBalancingService.ts, query the configured inverter provider for real-time solar surplus kW when calculating solar amps.
4. Expose station inverter settings endpoints in Backend/src/api/stations/stations.controller.ts and add test suite in Backend/src/tests/services/inverterIntegrations.test.ts.
```
```

---

# 4. Roaming & Interoperability (OCPI 2.2.1 / OICP 2.3)

---

### ROM-01: Complete Bilateral OCPI 2.2.1 CPO & eMSP Modules with Automated CDR Exchange
- **Category:** Roaming & Protocols
- **Priority:** 🔴 **High**
- **Problem Statement:**  
  Current OCPI endpoints only offer basic read operations for locations and tariffs. To participate in major European/US roaming hubs (e.g. e-Clearing.net, Gireve, Eco-Movement), the CPMS must implement full bidirectional OCPI 2.2.1: CDR push, remote commands (`START_SESSION`, `STOP_SESSION`, `UNLOCK_CONNECTOR`), token whitelist sync, and real-time status push.
- **Proposed Solution:**  
  1. Implement complete OCPI 2.2.1 CPO modules:
     - `cdrs`: push generated CDR upon session completion.
     - `commands`: execute remote starts/stops from roaming partners.
     - `tokens`: realtime authorization (`POST /tokens/{token_uid}/authorize`).
     - `sessions`: push active session state updates.
  2. Automated signature and token verification matching OCPI 2.2.1 spec.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (ROM-01)
```text
Implement complete bilateral OCPI 2.2.1 modules for CPO operations in Backend.
1. In Backend/src/api/ocpi/v221/, create:
   - cdrs.controller.ts & cdrs.routes.ts (GET CDRs, POST CDR push to roaming partner endpoint)
   - commands.controller.ts (Handle START_SESSION, STOP_SESSION, UNLOCK_CONNECTOR from eMSPs)
   - tokens.controller.ts (Real-time token authorization and batch token syncing)
   - sessions.controller.ts (GET active sessions, stream session updates)
2. In Backend/src/services/OcpiService.ts, add dispatchCdrToPartner(cdrId, partnerId) with automatic retry and response logging.
3. In Backend/src/ocpp/handlers/stopTransaction.ts, trigger automatic CDR compilation and dispatch to roaming partners if the transaction was started via roaming token.
4. Add comprehensive integration test suite in Backend/src/tests/api/ocpi_full.test.ts.
```
```

---

### ROM-02: Hubject OICP 2.3 Dynamic EVSE Broadcast & Authorize Integration
- **Category:** Roaming & Hubject
- **Priority:** 🟠 **Medium-High**
- **Problem Statement:**  
  Hubject is the world's largest e-roaming clearinghouse. The repository currently has OICP skeletons but lacks the dynamic EVSE status push (`eRoamingPushEvseData`, `eRoamingPushEvseStatus`) and live authorization exchange (`eRoamingAuthorizeStart`).
- **Proposed Solution:**  
  1. Implement Hubject OICP 2.3 SOAP/REST client with WS-Security / Bearer token authentication.
  2. Synchronize charger availability changes (`Available`, `Occupied`, `Faulted`, `OutOfService`) to Hubject immediately upon OCPP `StatusNotification`.
  3. Process Hubject eRoaming CDR upload at the end of each session.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (ROM-02)
```text
Implement Hubject OICP 2.3 dynamic status broadcast and CDR exchange in Backend.
1. Create Backend/src/services/HubjectOicpService.ts supporting:
   - pushEvseData(stationId): upload static EVSE data (connectors, geo, power, pricing).
   - pushEvseStatus(chargerId, status): broadcast Available/Occupied/Faulted state.
   - authorizeStart(idTag): query Hubject for foreign driver authentication.
   - sendChargeDetailRecord(cdr): submit signed CDR.
2. In Backend/src/ocpp/handlers/statusNotification.ts, hook into status changes to invoke HubjectOicpService.pushEvseStatus asynchronously.
3. Add test suite in Backend/src/tests/services/HubjectOicpService.test.ts with mocked Hubject responses.
```
```

---

# 5. Security, Zero-Trust & Multi-Tenancy

---

### SEC-01: Mutual TLS (mTLS) X.509 Authentication for OCPP WebSockets & Strict RBAC/ABAC
- **Category:** Security & Compliance
- **Priority:** 🔴 **Critical**
- **Problem Statement:**  
  Many public EV chargers in high-security environments (government, highways, commercial fleets) mandate mTLS (Mutual Transport Layer Security) with client certificates (OCPP Security Profile 3). Passwords or basic tokens in URL paths (Security Profile 1/2) are vulnerable to interception and spoofing.
- **Proposed Solution:**  
  1. Implement mTLS on the OCPP WebSocket server (`ocppServer.ts`): validate charger client certificates against an internal CPO CA certificate.
  2. Extract Charger Common Name (CN) from client certificate during TLS handshake.
  3. Enforce Attribute-Based Access Control (ABAC) ensuring users and sub-accounts can only access chargers situated in their assigned stations/organizations.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (SEC-01)
```text
Implement OCPP Security Profile 3 (Mutual TLS / mTLS) and fine-grained ABAC in Backend.
1. In Backend/src/ocpp/ocppServer.ts, configure https/wss server options to support requestCert: true, rejectUnauthorized: true (configurable via MTLS_ENABLED=true in .env), and ca: [cpoRootCa].
2. During WebSocket upgrade, extract the client certificate CommonName (CN) and verify it matches the charger identity in the URL path.
3. In Backend/src/middleware/auth.ts, implement requireResourceAccess(resourceType) to enforce strict ABAC: Drivers only view own sessions, Site Managers only access stations within their organization, Superadmins access all.
4. Add unit test suite in Backend/src/tests/security/mtlsAuth.test.ts verifying certificate validation and unauthorized socket rejection.
```
```

---

### SEC-02: Webhook HMAC SHA-256 Signature Verification & Immutable Audit Logging Ledger
- **Category:** Security & Auditability
- **Priority:** 🟠 **High**
- **Problem Statement:**  
  Mollie payment webhooks and external partner webhooks must be protected against tampering and replay attacks. Furthermore, administrative actions (e.g. unlocking connectors, changing tariffs, restarting chargers) lack an immutable audit trail, creating compliance and liability risks for CPOs.
- **Proposed Solution:**  
  1. Add HMAC-SHA256 signature verification middleware with timestamp tolerance (max 5 minutes) to all incoming webhooks.
  2. Implement an `AuditLog` Prisma model recording: `userId`, `action`, `resource`, `resourceId`, `ipAddress`, `userAgent`, `changesJson`, `timestamp`.
  3. Record all remote control commands and tariff mutations in the audit log.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (SEC-02)
```text
Implement HMAC signature verification for webhooks and a comprehensive Audit Logging Ledger in Backend.
1. In Backend/prisma/schema.prisma, create model AuditLog:
   - id, userId (Int?), action (String), target (String), targetId (String?), payload (Json?), ip (String), createdAt (DateTime).
2. Create Backend/src/services/AuditLogService.ts with recordLog(params) that writes audit records.
3. In Backend/src/middleware/audit.ts, create middleware that logs administrative mutations across /api/chargers, /api/tariffs, /api/stations, /api/remote-control.
4. Add HMAC SHA-256 webhook verification helper in Backend/src/utils/security.ts and apply to payment/roaming webhook handlers.
5. Add unit tests in Backend/src/tests/security/auditLog.test.ts.
```
```

---

# 6. Billing, Tariffs & Financial Operations

---

### FIN-01: Automated Monthly Invoicing Engine with PDF Generation & Multi-Tax Support
- **Category:** Billing & Invoicing
- **Priority:** 🔴 **High**
- **Problem Statement:**  
  While the system calculates transaction costs and reimbursement ledgers, it cannot generate formal PDF invoices with VAT breakdowns, company logos, billing addresses, and fiscal invoice numbers required by European and North American tax laws.
- **Proposed Solution:**  
  1. Create `Invoice` and `InvoiceLine` Prisma models with sequential fiscal numbering (`INV-2026-0001`).
  2. Implement `PdfInvoiceGenerator` using `pdfkit` or `puppeteer-core` with customizable company branding and VAT rates per EU member state (Reverse Charge, Standard, Reduced).
  3. Add automated monthly billing cron job that aggregates non-invoiced transactions per company/driver and emails PDF invoices via `MailService`.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (FIN-01)
```text
Implement an automated monthly billing and PDF invoice generation engine in Backend.
1. In Backend/prisma/schema.prisma, add:
   - model Invoice: id, invoiceNumber (unique), companyId, userId, totalAmount, vatAmount, status (draft/issued/paid), pdfUrl, dueDate, createdAt.
   - model InvoiceItem: id, invoiceId, description, quantity, unitPrice, vatRate, amount.
2. In Backend/src/services/InvoiceService.ts:
   - generateMonthlyInvoices(year, month): group completed transactions and create invoices.
   - generateInvoicePdf(invoiceId): generate a professional branded PDF invoice using pdfkit with itemized charging sessions, kWh totals, and VAT rates.
3. In Backend/src/cron/invoiceCron.ts, schedule automated generation on the 1st of each month.
4. Add Frontend invoice download and viewer page at Frontend/app/invoices/page.tsx.
5. Add unit tests in Backend/src/tests/services/InvoiceService.test.ts.
```
```

---

### FIN-02: SEPA Direct Debit B2B/CORE (`pain.008.001.02`) Automated Mandate & Collection
- **Category:** Financial Operations & SEPA
- **Priority:** 🟠 **High**
- **Problem Statement:**  
  The system supports SEPA Credit Transfer (`pain.001.001.03`) for reimbursements, but lacks SEPA Direct Debit (`pain.008.001.02`) to automatically collect monthly subscription fees and charging session invoices directly from customer bank accounts with valid SEPA mandates.
- **Proposed Solution:**  
  1. Add `SepaMandate` model (IBAN, BIC, Mandate Reference, Signature Date, Sequence Type: `FRST`/`RCUR`).
  2. Extend `SepaXmlService` to generate ISO 20022 `pain.008.001.02` Direct Debit XML batches.
  3. Validate IBAN/BIC checksums with full SEPA country format validation.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (FIN-02)
```text
Implement SEPA Direct Debit (pain.008.001.02) automated collection in Backend.
1. In Backend/prisma/schema.prisma, create model SepaMandate:
   - id, userId, iban, bic, mandateRef (unique), signatureDate, mandateType (B2B/CORE), sequenceType (FRST/RCUR), isActive.
2. In Backend/src/services/SepaXmlService.ts, implement generatePain008002(collections, creditorInfo):
   - Output valid XML conforming to ISO 20022 pain.008.001.02 schema with XML entity escaping and CDATA protection.
3. Create API endpoints in Backend/src/api/sepa/sepa.controller.ts to manage mandates and export monthly direct debit XML files.
4. Add unit test suite in Backend/src/tests/services/SepaDirectDebit.test.ts verifying XML validity against banking schemas.
```
```

---

# 7. Frontend UX/UI & Observability

---

### UIX-01: Live Interactive Station Topology Canvas & Feeder Cable Load Visualizer
- **Category:** Frontend UX / Observability
- **Priority:** 🟠 **Medium**
- **Problem Statement:**  
  The ground plan builder allows placing chargers on a background image, but does not visualize the electrical topology (feeder cables, distribution boards, transformers, and live phase current flows). CPOs need visual insights into cable capacity bottlenecks.
- **Proposed Solution:**  
  1. Enhance Ground Plan with an **Electrical Topology Overlay**: draw feeder cables from Distribution Boards to Chargers.
  2. Color-code cables in real time based on active load: Green (<60%), Amber (60-85%), Red (>85% capacity).
  3. Display live total kW and Phase Amps (L1, L2, L3) directly on transformer and charger nodes.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (UIX-01)
```text
Build a Live Electrical Topology Canvas and Feeder Cable Load Visualizer in Frontend.
1. In Frontend/components/stations/ground-plan/, create TopologyOverlay.tsx using SVG/Canvas:
   - Allow CPOs to draw power feeders connecting Distribution Boards to specific Chargers.
   - Bind feeder lines to real-time live current data from Socket.IO stream.
   - Animate power flows along cables with color-coded load indicators (<60% green, 60-85% amber, >85% pulsing red).
2. Integrate a Live Phase Balance Inspector widget showing L1/L2/L3 amperage gauges on hover.
3. Test canvas responsiveness across desktop and tablet viewport resolutions.
```
```

---

### UIX-02: Real-time OCPP Packet Inspector with Wireshark-Style Protocol Decoding
- **Category:** Frontend & Debugging
- **Priority:** 🟠 **Medium**
- **Problem Statement:**  
  The current log viewer displays raw JSON strings. Debugging complex charging failures (e.g. invalid `idTagInfo`, status code rejections, schema mismatches) requires manual JSON parsing.
- **Proposed Solution:**  
  1. Build a Wireshark-inspired **OCPP Packet Inspector**:
     - Split view: Message List (Action, MessageType, Direction, Latency, Status) + Decoded Detail Tree.
     - Highlight protocol errors, schema validation failures, and slow CALL/CALLRESULT roundtrips (>3000ms).
     - Single-click copy as cURL or JSON-RPC test frame.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (UIX-02)
```text
Build an advanced Wireshark-style OCPP Packet Inspector component in Frontend/components/ocpp/OcppPacketInspector.tsx.
1. Design a two-pane layout:
   - Left Pane: Chronological message stream with direction badges (Charger -> CSMS / CSMS -> Charger), Action tag, latency ms, and status badges (Success/Failed/Timeout).
   - Right Pane: Interactive collapsible JSON tree with syntax highlighting, field-level schema validation errors, and raw frame toggle.
2. Add quick filters for specific OCPP Actions (BootNotification, Authorize, StartTransaction, MeterValues, StopTransaction), Charger ID, and Error types.
3. Add "Export Session Capture (.json / .pcap)" button to save diagnostic traces for hardware vendors.
```
```

---

# 8. DevOps, QA & Automated Fleet Simulation

---

### OPS-01: Virtual Charger Fleet Simulator (100+ Virtual OCPP 1.6/2.0.1 Chargers)
- **Category:** DevOps & Testing
- **Priority:** 🔴 **High**
- **Problem Statement:**  
  Testing smart charging, load management, and database performance currently relies on static mocks or manual single-charger tests. To test production load, the team needs an automated fleet simulator that connects 100+ virtual chargers over WebSockets, simulates charging curves, and sends meter values.
- **Proposed Solution:**  
  1. Build a standalone CLI fleet simulator in `Backend/src/simulator/`:
     - Configurable fleet size (e.g. `--chargers=100`, `--protocol=1.6|2.0.1`).
     - Emulates realistic driver behavior: Plug-in -> RFID Swipe -> StartTransaction -> 1-minute MeterValues with realistic CC/CV battery curve -> StopTransaction -> Unplug.
     - Supports remote commands (`RemoteStart`, `SetChargingProfile`, `Reset`).

```markdown
#### 🤖 Ready-to-Use Agent Prompt (OPS-01)
```text
Create a high-scale Virtual Charger Fleet Simulator in Backend/src/simulator/fleetSimulator.ts.
1. Build a CLI script capable of spawning N concurrent WebSocket clients connecting to ws://localhost:9220/OCPP/1.6/{chargerId}.
2. Implement realistic charger state machines:
   - Send BootNotification -> Heartbeat interval.
   - Simulate random RFID swipe and StartTransaction.
   - Stream MeterValues every 10s following realistic CC/CV lithium-ion charging curves (kW tapering at 80% SoC).
   - Respond correctly to CALL commands: SetChargingProfile, RemoteStopTransaction, ChangeAvailability, Reset.
3. Add npm script "simulate:fleet" in Backend/package.json with configurable flags (--count, --rate, --duration).
```
```

---

### OPS-02: Production Docker Compose, Helm Charts, and OpenTelemetry Distributed Tracing
- **Category:** DevOps & Production Readiness
- **Priority:** 🟠 **High**
- **Problem Statement:**  
  Deploying the platform across enterprise environments requires standardized containerization, horizontal pod scaling definitions, and distributed observability across WebSockets, HTTP REST, Redis, and PostgreSQL.
- **Proposed Solution:**  
  1. Provide optimized multi-stage `Dockerfile` definitions for Backend and Frontend.
  2. Create `docker-compose.prod.yml` including PostgreSQL 16, Redis 7, Backend, Frontend, and OpenTelemetry Collector.
  3. Create Kubernetes Helm Chart with HPA (Horizontal Pod Autoscaling) and ingress TLS.
  4. Instrument OpenTelemetry auto-tracing in Backend to track end-to-end request latencies.

```markdown
#### 🤖 Ready-to-Use Agent Prompt (OPS-02)
```text
Create production containerization, Kubernetes Helm charts, and OpenTelemetry distributed tracing for OCPP-CPMS.
1. In Backend/Dockerfile and Frontend/Dockerfile, create optimized multi-stage production Docker images (node:24-alpine, unprivileged user, small footprint).
2. Create docker-compose.prod.yml in repo root defining postgres, redis, backend, frontend, and otel-collector with health checks and restart policies.
3. Create deploy/helm/ocpp-cpms/ with Chart.yaml, values.yaml, and templates for deployments, services, ingress, and HPA.
4. In Backend/src/config/telemetry.ts, initialize OpenTelemetry SDK exporting traces and metrics to OTEL_EXPORTER_OTLP_ENDPOINT.
```
```

---

*Generated by Antigravity (Google DeepMind Advanced Agentic AI) for webdotpulse/OCPP-CPMS.*
