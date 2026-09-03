<h1 align="center">⚙️ OCPP-CPMS Backend Engine</h1>

<p align="center">
  Enterprise Node.js / Express 5 & TypeScript 6+ server engine providing <strong>dual-protocol OCPP 1.6-J & 2.0.1/2.1 WebSocket handling</strong>, high-frequency telemetry ingestion, dynamic load balancing (LMS), EPEX day-ahead spot pricing, ISO 20022 SEPA Direct Debit export, and multi-tenant REST APIs.
</p>

---

## 📑 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Dual-Protocol OCPP Pipeline](#2-dual-protocol-ocpp-pipeline)
3. [REST API Endpoint Catalog](#3-rest-api-endpoint-catalog)
4. [Database Models & Prisma ORM](#4-database-models--prisma-orm)
5. [Smart Charging & Optimization Services](#5-smart-charging--optimization-services)
6. [Security, Authentication & Multi-Tenancy](#6-security-authentication--multi-tenancy)
7. [Developer Setup & Commands](#7-developer-setup--commands)

---

## 1. Architecture Overview

The backend is built with modern **ECMAScript Modules (ESM)** on **Node.js 24+ LTS**, using **Express 5** for REST routing, the low-overhead **`ws`** library for the RFC 6455 OCPP WebSocket server, **Prisma ORM 7.8** for PostgreSQL interaction, and **Redis 7** for real-time pub/sub and state caching.

```text
                                  ┌──────────────────────────────┐
                                  │   Physical EVSE Chargers     │
                                  │  (Alfen, ABB, EVBox, Mennekes)│
                                  └──────────────┬───────────────┘
                                                 │
                             ws://:9220/OCPP/[1.6|2.1]/{chargerId}
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Backend Server Process (:3000)                                 │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌────────────────────────────────┐                 ┌──────────────────────────────────────┐  │
│   │   Unified OCPP Server (:9220)  │                 │    Express 5 REST API Router (:3000) │  │
│   ├────────────────────────────────┤                 ├──────────────────────────────────────┤  │
│   │  • Subprotocol Detection       │                 │  • /api/chargers & /api/connectors   │  │
│   │  • OCPP 1.6-J JSON Handler     │                 │  • /api/stations & Ground Plan       │  │
│   │  • OCPP 2.0.1 / 2.1 Router     │                 │  • /api/invoices & SEPA pain.008     │  │
│   │  • Remote Control Dispatcher   │                 │  • /api/chargeGroups (LMS)           │  │
│   │  • Live WebSocket Log Broadcaster│               │  • /api/tariffs & EPEX Spot          │  │
│   └───────────────┬────────────────┘                 │  • /api/roaming (OCPI 2.2.1 / OICP)  │  │
│                   │                                  │  • /api/users & Corporate Accounts   │  │
│                   │ Internal Events                  └──────────────────┬───────────────────┘  │
│                   ▼                                                     │                      │
│   ┌─────────────────────────────────────────────────────────────────────▼──────────────────┐   │
│   │                              Service Layer (Business Logic)                            │   │
│   ├────────────────────────────────────────────────────────────────────────────────────────┤   │
│   │  • LoadManagementService.ts     • DynamicTariffService.ts     • SepaXmlService.ts      │   │
│   │  • V2GOrchestrationService.ts   • OcpiService.ts              • MeterValueService.ts   │   │
│   │  • FirmwareUpdateService.ts     • StripeService.ts            • MollieService.ts       │   │
│   └──────────────────────────────────────────┬─────────────────────────────────────────────┘   │
│                                              │                                                 │
└──────────────────────────────────────────────┼─────────────────────────────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
        ┌─────────────────────────────┐                 ┌─────────────────────────────┐
        │     PostgreSQL Database     │                 │       Redis 7 Cluster       │
        │    (via Prisma ORM 7.8)     │                 │   (Cache, Rate Limits, Bus) │
        └─────────────────────────────┘                 └─────────────────────────────┘
```

---

## 2. Dual-Protocol OCPP Pipeline

### Message Routing
The WebSocket listener binds to port `9220` (`OCPP_PORT`) and routes connections based on the handshake URL and the `Sec-WebSocket-Protocol` header:

```typescript
// Unified WebSocket route
ws://<server-ip>:9220/OCPP/<chargerId>
// Explicit protocol routes
ws://<server-ip>:9220/OCPP/1.6/<chargerId>   --> Handled by Backend/src/ocpp/handlers/
ws://<server-ip>:9220/OCPP/2.1/<chargerId>   --> Handled by Backend/src/ocpp/v201/
```

### JSON-RPC Message Types
1. **`CALL`** (Type 2): `[2, "<uniqueId>", "<Action>", { <payload> }]`
2. **`CALLRESULT`** (Type 3): `[3, "<uniqueId>", { <responsePayload> }]`
3. **`CALLERROR`** (Type 4): `[4, "<uniqueId>", "<ErrorCode>", "<ErrorDescription>", { <details> }]`

### Core Supported OCPP 1.6-J Handlers
- **`BootNotification`**: Validates registration against the database. Records vendor, model, serial, and firmware version. Responds with `HeartbeatInterval`.
- **`Heartbeat`**: Updates charger online status and timestamp in PostgreSQL and Redis.
- **`Authorize`**: Validates RFID tags against the `RfidUser` whitelist or corporate roaming contracts.
- **`StatusNotification`**: Ingests EVSE connector state changes (`Available`, `Preparing`, `Charging`, `SuspendedEVSE`, `SuspendedEV`, `Finishing`, `Reserved`, `Unavailable`, `Faulted`).
- **`StartTransaction`**: Begins an active charging session, records `meterStart`, and generates a `Transaction` entity.
- **`MeterValues`**: High-frequency telemetry ingestion recording active power (W), energy active import (Wh), voltage (V), current (A), and battery State of Charge (SoC %).
- **`StopTransaction`**: Calculates total energy consumed, invokes `DynamicTariffService` to compute session financial cost, and updates reimbursement ledgers.

---

## 3. REST API Endpoint Catalog

All REST endpoints are mounted under `/api/` on port `3000`.

### 1. Chargers & Connectors
- `GET /api/chargers`: List all chargers with online status, station mapping, and active power.
- `POST /api/chargers`: Register a new charger.
- `GET /api/chargers/:id`: Charger detail view with connectors, active transaction, and quirk overrides.
- `PUT /api/chargers/:id`: Update hardware metadata and load limits.
- `DELETE /api/chargers/:id`: Remove charger from network.
- `GET /api/chargers/:id/configurations`: Query configuration key-value pairs stored on the device.
- `POST /api/chargers/:id/remote-start`: Send `RemoteStartTransaction` RPC command.
- `POST /api/chargers/:id/remote-stop`: Send `RemoteStopTransaction` RPC command.
- `POST /api/chargers/:id/reset`: Trigger `Reset` (type: `Soft` or `Hard`).
- `POST /api/chargers/:id/unlock`: Trigger `UnlockConnector`.

### 2. Stations & 2D Ground Plan
- `GET /api/stations`: List all charging stations with GPS coordinates and connector counts.
- `POST /api/stations`: Create a new charging station.
- `GET /api/stations/:id`: Retrieve station profile and ground plan layout settings.
- `PUT /api/stations/:id`: Update station location, operating hours, and capacity limits.
- `PUT /api/stations/:id/ground-plan`: Persist 2D ground plan JSON (bays, orientation, background image).

### 3. Dynamic Load Management (LMS)
- `GET /api/chargeGroups`: List all dynamic load balancing groups.
- `POST /api/chargeGroups`: Create a new load group with max amperage, phase unbalance limit, and fail-safe current.
- `GET /api/chargeGroups/:id`: Load group detail with assigned chargers and live phase allocation.
- `PUT /api/chargeGroups/:id`: Modify current limits and phase balancing thresholds.

### 4. Invoicing & ISO 20022 SEPA Banking
- `GET /api/invoices`: List monthly invoice records with status (`Pending`, `Paid`, `Failed`), subtotal, and VAT.
- `POST /api/invoices/generate`: Trigger monthly billing calculation run for all companies.
- `GET /api/invoices/:id/pdf`: Download vector PDF invoice document.
- `POST /api/invoices/sepa/export`: Generate ISO 20022 `pain.008.001.02` Direct Debit XML batch file.
- `GET /api/invoices/mandates`: List customer SEPA Direct Debit mandates.
- `POST /api/invoices/mandates`: Register a new signed SEPA mandate.

### 5. Roaming (OCPI 2.2.1 & OICP 2.3)
- `GET /api/ocpi/cpo/2.2.1/locations`: OCPI Locations endpoint for navigation eMSPs.
- `GET /api/ocpi/cpo/2.2.1/sessions`: Active charging sessions for roaming partners.
- `GET /api/ocpi/cpo/2.2.1/cdrs`: Charge Detail Records for clearing and settlement.
- `POST /api/roaming/test-suite/run`: Execute automated partner endpoint conformance tests.

---

## 4. Database Models & Prisma ORM

The PostgreSQL schema is managed via **Prisma ORM 7.8** in `Backend/prisma/schema.prisma`.

### Key Relational Entities
- **`User`**: System identity (`superadmin`, `admin`, `user`). Includes `twoFactorSecret` and `twoFactorEnabled`.
- **`Company`**: B2B corporate billing entity. Groups chargers, corporate drivers, and invoice ledgers.
- **`ChargingStation`**: Physical site with GPS coordinates (`latitude`, `longitude`) and ground plan canvas settings.
- **`Charger`**: Physical OCPP charge point (unique `charger_id`). Belongs to a station and optional `ChargeGroup`.
- **`Connector`**: Individual charging plug (EVSE id, connector id, type: `Type2`, `CCS2`, `CHAdeMO`, max power).
- **`Transaction`**: Active or finalized charging session (`meterStart`, `meterStop`, `totalCost`, `soc`).
- **`MeterValue`**: High-resolution time-series energy and power samples.
- **`Tariff`**: Pricing model with fixed, time-based, idle-fee, and EPEX dynamic spot pricing formulas.
- **`ChargeGroup`**: Dynamic cluster managing safe site current, phase balancing, and fail-safe levels.
- **`ReimbursementContract` & `ReimbursementLedger`**: Employee home charging compensation and SEPA records.
- **`QuirkProfile`**: Hardware manufacturer compatibility flags and timing overrides.

---

## 5. Smart Charging & Optimization Services

### `LoadManagementService.ts`
Evaluates aggregated site currents across phases $L1, L2, L3$ every 10 seconds. Calculates safe current limits and dispatches OCPP `SetChargingProfile` commands to throttled chargers.

### `DynamicTariffService.ts`
Integrates with ENTSO-E to retrieve hourly day-ahead wholesale electricity prices. Computes exact session cost by multiplying interval kWh consumption by the applicable spot rate plus CPO markup.

### `V2GOrchestrationService.ts`
Manages bidirectional energy transfer. When local grid tariffs spike or site demand exceeds contractual capacity, the engine commands connected ISO 15118 vehicles to discharge battery reserves down to the user-specified minimum SoC floor.

### `SepaXmlService.ts`
Generates banking-grade ISO 20022 XML files using `fast-xml-parser`:
- Direct Debit: `pain.008.001.02` (CORE and B2B schemes)
- Credit Transfer: `pain.001.001.03` (Reimbursements)

---

## 6. Security, Authentication & Multi-Tenancy

1. **Strict Multi-Tenant Scoping**: Non-superadmin requests are strictly scoped by `owner_id: req.userId` or `company_id: req.user.companyId`.
2. **JWT Authentication**: Enforced across all non-public routes with SHA-256 signature verification.
3. **Role-Based Access Control (RBAC)**: Fine-grained capabilities matrix (`chargers.view`, `chargers.control`, `invoices.view`, `invoices.export`, `roaming.manage`).
4. **Audit Trail**: Every administrative action (remote controls, tariff edits, role assignments) writes an immutable record to `AuditLog`.

---

## 7. Developer Setup & Commands

### Prerequisites
- Node.js 24+ LTS
- PostgreSQL 15+
- Redis 7+

### Commands
```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Push database schema without interactive prompt
npx prisma db push --accept-data-loss

# Check TypeScript types (Must exit code 0)
npx tsc --noEmit

# Run unit and integration tests
npm test

# Run a specific service test
npx jest src/tests/services/V2GOrchestrationService.test.ts

# Create initial Superadmin account
npm run create-superadmin -- "admin@mobilitypulse.com" "SecurePassword123!"

# Start development server
npm run dev
```

---

*Authored for enterprise EV infrastructure — webdotpulse/GRID-OCPP-CPMS.*
