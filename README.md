<h1 align="center">OCPP Charge Point Management System (CPMS)</h1>

<p align="center">
  An enterprise-grade, full-stack <strong>OCPP 1.6-J & 2.0.1/2.1 Charge Point Management System (CPMS)</strong> supporting multi-protocol EV charging hardware, real-time WebSockets, dynamic EPEX spot pricing, predictive solar load balancing, V2G battery orchestration, ISO 20022 SEPA banking exports, Mollie payments, OCPI roaming, interactive 2D ground plans, and responsive driver mobile interfaces.
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-24%2B-green?logo=node.js" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16%2B-black?logo=next.js" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15%2B-blue?logo=postgresql" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7%2B-red?logo=redis" />
  <img alt="OCPP" src="https://img.shields.io/badge/OCPP-1.6%20%7C%202.0.1%20%7C%202.1-orange" />
  <img alt="ISO 15118" src="https://img.shields.io/badge/ISO-15118%20PnC-purple" />
  <img alt="SEPA" src="https://img.shields.io/badge/SEPA-ISO%2020022-teal" />
</p>

---

## Table of Contents

- [Overview & Visual Showcase](#overview--visual-showcase)
- [High-Level Architecture](#high-level-architecture)
- [Key Features](#key-features)
- [Documentation & Manuals](#documentation--manuals)
- [Project Directory Structure](#project-directory-structure)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Connecting Chargers](#connecting-chargers)
- [Testing & Quality Assurance](#testing--quality-assurance)

---

## Overview & Visual Showcase

The **OCPP-CPMS** platform provides Charge Point Operators (CPOs), e-Mobility Service Providers (eMSPs), and fleet managers with an end-to-end control plane for electric vehicle charging infrastructure.

### Platform Visual Tour

| Executive Dashboard Overview | Interactive 2D Ground Plan Builder |
| :---: | :---: |
| ![Executive Dashboard](Screenshots/06_Dashboard_Executive_Overview.png) | ![Ground Plan Builder](Screenshots/21_Station_GroundPlan_2D_Builder.png) |
| *Real-time fleet power, active transactions, revenue, and geospatial station map.* | *Drag-and-drop parking bays, line drawing, socket mapping, and orientation.* |

| Users, Clients & Access Control | Corporate B2B Clients & Fleets |
| :---: | :---: |
| ![Users Directory](Screenshots/51_Users_Accounts_Directory.png) | ![Corporate Clients](Screenshots/51a_Corporate_Clients_Directory.png) |
| *Multi-role directory, 2FA security indicators, and individual driver profiles.* | *Corporate client accounts with VAT/KvK, linked drivers, and assigned chargers.* |

| Roles & Capabilities Matrix | Enterprise Invoicing & Facturen Ledger |
| :---: | :---: |
| ![Roles Matrix](Screenshots/51b_Roles_Permissions_Matrix.png) | ![Invoicing Ledger](Screenshots/39_Invoices_Billing_Ledger.png) |
| *Granular RBAC matrix across 6 operational modules and 5 system role tiers.* | *Automated billing runs, VAT breakdown, and ISO 20022 Direct Debit export.* |

| V2G Fleet Battery Orchestration | Live OCPP Packet Inspector |
| :---: | :---: |
| ![V2G Orchestration](Screenshots/29_V2G_Battery_Orchestration.png) | ![OCPP Packet Inspector](Screenshots/55_OCPP_PacketInspector_Console.png) |
| *Bidirectional discharge controls, minimum SoC reserves, and fleet battery stats.* | *Real-time WebSocket JSON-RPC frame debugger with payload parsing.* |

---

## High-Level Architecture

The system operates across four primary decoupled layers:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             OCPP CPMS – System Architecture                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐           OCPP 1.6-J & 2.0.1/2.1 WebSocket          ┌──────────────────────────┐
  │   EV Chargers /  │ ◄──────────────────────────────────────────────────►│   OCPP WebSocket Server  │
  │   Charge Points  │       ws(s)://host:9220/OCPP/[1.6|2.1]/{id}         │   (Node.js / ws engine)  │
  └──────────────────┘                                                     └────────────┬─────────────┘
                                                                                        │
                                                                                        │ Internal Events
                                                                                        ▼
  ┌──────────────────┐          HTTPS REST / Socket.IO                     ┌──────────────────────────┐
  │  Next.js Admin   │ ◄──────────────────────────────────────────────────►│   Express REST API       │
  │  Dashboard UI    │      http(s)://host:3000/api/v1/...                 │   (TypeScript 5.9 / ESM) │
  │  (Port 3002)     │ ◄──────────────────────────────────────────────────►│                          │
  └────────┬─────────┘      Socket.IO Stream (/api/realtime)               └────────────┬─────────────┘
           │ Mollie Ad-Hoc                                                              │ ORM Queries
           ▼                                                                            ▼
  ┌──────────────────┐        Roaming Sync / Spot Pricing / SEPA           ┌──────────────────────────┐
  │  Mollie / OCPI   │ ◄──────────────────────────────────────────────────►│   PostgreSQL Database    │
  │  ENTSO-E / EPEX  │                                                     │   (via Prisma ORM 7.8)   │
  └──────────────────┘                                                     └────────────┬─────────────┘
                                                                                        │
                                                                                        │ Pub/Sub & Caching
                                                                                        ▼
                                                                           ┌──────────────────────────┐
                                                                           │   Redis 7 (ioredis)      │
                                                                           │   (State, Rate-limit)    │
                                                                           └──────────────────────────┘
```

```mermaid
flowchart TD
    CP["⚡ EV Charge Points\n(Physical Chargers)"]
    OCPP["OCPP WebSocket Server\nws://:9220/OCPP/[1.6|2.1]/{id}"]
    API["Backend REST API\nExpress + TypeScript\nhttp://:3000"]
    DB[("PostgreSQL Database\n(via Prisma ORM)")]
    UI["🖥️ Admin Dashboard\nNext.js 16+ App Router\nhttp://:3002"]
    RT["📋 Live Real-Time Server\nSocket.IO Stream\n/api/realtime"]
    V2G["🔄 V2G Orchestration\nService"]
    MOLLIE["💳 Mollie API\n(Ad-Hoc Payments)"]
    OCPI["🌍 OCPI Partners\n(Roaming)"]

    CP <-->|"OCPP 1.6 & 2.1/2.0.1 JSON\nWebSocket"| OCPP
    OCPP -->|"Internal events\n& data writes"| API
    API <-->|"ORM queries\n& migrations"| DB
    UI <-->|"HTTPS / REST"| API
    UI <-->|"Socket.IO stream"| RT
    OCPP -->|"Real-time\nlog broadcast"| RT
    OCPP <-->|"Pub/Sub\n& Caching"| REDIS[("Redis Cache")]
    API <-->|"Pub/Sub\n& Caching"| REDIS
    API -->|"Dynamic Power Limits"| LMS["Load Management Service"]
    LMS -->|"SetChargingProfile"| OCPP

    API <-->|"Roaming Sync"| OCPI
    UI -->|"PaymentIntent"| MOLLIE
    API <-->|"Mollie Webhooks"| MOLLIE
    V2G -->|"Discharge Limits\n& Pricing"| API
```

---

## Key Features

### ⚡ Dual-Protocol OCPP WebSocket Engine
- Native dual-route listener on port `9220`:
  - `ws://host:9220/OCPP/1.6/<chargerId>` (OCPP 1.6-J handler pipeline)
  - `ws://host:9220/OCPP/2.1/<chargerId>` (OCPP 2.0.1 / 2.1 router)
- Comprehensive message coverage: `BootNotification`, `Heartbeat`, `Authorize`, `StatusNotification`, `StartTransaction`, `MeterValues`, `StopTransaction`, `DataTransfer`, `DiagnosticsStatusNotification`, `FirmwareStatusNotification`.
- Full remote control RPC operations: Remote Start/Stop, Soft/Hard Reset, Unlock Connector, Change Availability, Clear Cache, Trigger Message, Get/Change Configuration, SetChargingProfile, and Firmware Update.

### 🖥️ Next.js 16+ Admin Dashboard
- Dark-mode executive analytics with real-time KPI tiles, power draw gauges, and revenue trends.
- Interactive geospatial station mapping using `react-leaflet` with clustered status indicators.
- Live active session monitor with continuous duration counters, energy metering, and dynamic charts.
- Full internationalization support (`react-i18next`) with English and Dutch locale dictionaries.

### 🗺️ Interactive 2D Ground Plan Builder & Floor Monitor
- Visual drag-and-drop canvas powered by `@dnd-kit` for station parking bay layouts.
- Custom area drawing, boundary lines, 45-degree spot rotation, and physical connector socket mapping.
- Real-time glassmorphism Live Monitor displaying live bay occupancy, charging wattage, delivered kWh, and driver tags.

### 🔄 Smart Charging, EPEX Spot Pricing & V2G Battery Orchestration
- **Dynamic Spot Pricing:** Automated daily ingestion of EPEX Day-Ahead hourly electricity prices (via EnergyZero, ENTSO-E, and Energy-Charts).
- **Predictive Solar Balancing:** 24-hour rolling schedule generation fusing Open-Meteo solar irradiance forecasts with spot prices to prioritize local green energy.
- **V2G Battery Orchestration:** Bidirectional energy routing commanded via Profile ID 300 negative amperage limits, enforcing configurable driver minimum SoC reserves.
- **Dynamic Load Management:** Hierarchy-level power balancing across ChargeGroups and stations (Profile ID 100 & 101) with automatic headroom restoration (<95%).

### 🧾 Enterprise Invoicing ("Facturen") & ISO 20022 SEPA Direct Debit
- Comprehensive billing ledger (`/invoices`) aggregating completed charging sessions into monthly customer invoices.
- Line-item transaction breakdowns with meter timestamps, energy rates, idle fee penalties, and 21% VAT calculations.
- Integrated SEPA Mandate management (Unique Mandate Reference, debtor IBAN/BIC, signature validation).
- Banking-grade ISO 20022 SEPA Direct Debit XML export (`pain.008.001.02`) for direct corporate banking portal upload.

### 💸 Employee Home Reimbursements & SEPA Credit Transfer
- Automated split-billing engine for fleet drivers charging company vehicles at home.
- Monthly reimbursement contract ledgers mapping employee home meters, electricity rates, and IBANs.
- Banking-compliant ISO 20022 SEPA Credit Transfer XML export (`pain.001.001.03`).

### 💳 Mollie Ad-Hoc Public Payments
- Seamless walk-in ad-hoc driver checkout via Mollie PaymentIntents (Credit Cards, iDEAL, Bancontact).
- Public checkout web page (`/payments`) with secure webhook callback validation (`/api/payments/webhook`).

### 🔑 Whitelist RFID & ISO 15118 Plug & Charge
- Central RFID whitelist management with instant remote activation, deactivation, and hardware cache flush.
- ISO 15118 Plug & Charge vehicle contract certificate management and vehicle energy profile pairing.

### 🌐 Roaming Hubs (OCPI 2.2.1 & OICP Hubject)
- Bidirectional CPO / MSP roaming integration for Locations, Tariffs, Sessions, Tokens, and CDRs.
- Roaming Settlement Visualizer and clearinghouse CSV report exporter tracking wholesale costs, retail billing, and partner net margins.

### 🛡️ Hardware Reliability: Auto-Heal & Quirk Normalizer
- **Hardware-at-Risk:** Automated heuristic scanner detecting silent disconnects, ground faults, and connector lock failures with configurable auto-heal recovery sequences.
- **Quirk Normalizer:** Runtime normalizer repairing vendor-specific OCPP non-compliance (missing power derivation, energy multipliers, power-to-energy integration).
- **Configuration Templates:** Standardized OCPP configuration profiles deployable across charger fleets with one click.

### 📢 Multimedia Screen Ad-Campaign Manager
- Targeted advertisement campaign scheduler distributing promotional images and video assets to screen-equipped charging stations.

### 📱 Responsive Mobile Driver Companion
- Dedicated mobile web application (`/mobile`) optimized for smartphone screens, featuring nearby station discovery, interactive map routing, live charging controller, and driver account settings.

### 🔐 Enterprise Security & Auditability
- Role-Based Access Control (Superadmin, Admin, User) with tenant data isolation.
- Two-Factor Authentication (TOTP 2FA), email verification, and password reset flows.
- Cryptographic PKI Security Profiles (`/settings/security`) and immutable Enterprise Audit Trail logging (`/settings/audit`).

---

## Documentation & Manuals

Comprehensive guides tailored for administrators, operators, and developers are located in the [`Manual/`](Manual/) directory:

| Document | Audience | Description |
| :--- | :--- | :--- |
| 📖 **[Platform Overview & Architecture](Manual/platform_overview.md)** | All | High-level system topology, data flow sequence diagrams, and hardware quirk handling. |
| 👤 **[User & CPO Manual](Manual/user_manual.md)** | Station Operators & CPOs | Complete UI guide covering fleet management, tariffs, invoicing, RFID, and mobile tools with screenshots. |
| ⚙️ **[Core Operations Manual](Manual/core_operations_manual.md)** | Daily Operations | Step-by-step procedures for asset hierarchy, ground plans, remote control, and live diagnostics. |
| 🛠️ **[Admin & Deployment Manual](Manual/admin_manual.md)** | DevOps & SysAdmins | Production deployment on Ubuntu/Google Cloud VMs (PM2, Nginx, PostgreSQL, Redis, Certbot SSL). |
| 💰 **[Financial & Roaming Manual](Manual/financial_roaming_manual.md)** | Finance & Roaming Managers | Invoicing ledger, SEPA Direct Debit (`pain.008`), Reimbursements (`pain.001`), Mollie, and OCPI/OICP. |
| ⚡ **[Smart Charging, EMS & V2G Guide](Manual/advanced_ems_smart_charging_guide.md)** | Energy Engineers | In-depth technical algorithms for dynamic EPEX tariffs, solar predictive balancing, and V2G discharging. |
| 🗺️ **[Parking Ground Plan Manual](Manual/ground_plan_manual.md)** | Facility Managers | Guide to building 2D station layouts and operating the real-time glassmorphism Live Monitor. |
| 💻 **[Developer & API Guide](Manual/DeveloperGuide.md)** | Software Engineers | REST API endpoints, JWT Bearer auth, Socket.IO real-time subscriptions, and custom quirk development. |

---

## Project Directory Structure

```
OCPP-CPMS/
├── Backend/                            # Express 5 + TypeScript 5.9 API & OCPP WebSocket Server
│   ├── prisma/
│   │   ├── schema.prisma               # PostgreSQL Prisma Schema
│   │   └── migrations/                 # Migration history
│   ├── src/
│   │   ├── api/                        # REST Controllers & Routes by Domain
│   │   │   ├── analytics/              # Aggregated kWh, revenue, and utilization reports
│   │   │   ├── audit/                  # Enterprise audit logging
│   │   │   ├── auth/                   # JWT Auth, 2FA TOTP, Password Reset, Email Verify
│   │   │   ├── chargeGroups/           # Load balancing group definitions
│   │   │   ├── chargers/               # Charger CRUD & Connector mappings
│   │   │   ├── companies/              # Multi-tenant corporate accounts
│   │   │   ├── config-profiles/        # Standardized OCPP config templates
│   │   │   ├── connectors/             # EVSE Connector CRUD
│   │   │   ├── dashboard/              # Metrics, live sessions, fleet capacity
│   │   │   ├── invoices/               # Facturen, line-item billing, and SEPA exports
│   │   │   ├── mail/                   # SMTP & HTML email templates
│   │   │   ├── media-campaigns/        # Charger screen video/image promotions
│   │   │   ├── ocpi/                   # OCPI 2.2.1 roaming endpoints
│   │   │   ├── ocpp/                   # OCPP REST triggers & live log history
│   │   │   ├── oicp/                   # Hubject OICP roaming endpoints
│   │   │   ├── payments/               # Mollie payment intents & webhooks
│   │   │   ├── quirk-profiles/         # Vendor-specific hardware compatibility quirks
│   │   │   ├── reimbursements/         # Employee home charging SEPA calculation
│   │   │   ├── reservations/           # Station connector reservation scheduling
│   │   │   ├── rfid/                   # RFID whitelist & tag management
│   │   │   ├── roaming/                # Roaming partner credentials & settlement
│   │   │   ├── security/               # PKI security profiles & certificate status
│   │   │   ├── settings/               # System settings (tariffs, hardware risk, mail)
│   │   │   ├── stations/               # Charging stations & Ground Plan maps
│   │   │   ├── tariffs/                # Tariff CRUD & dynamic pricing formulas
│   │   │   ├── transactions/           # Charging session history & active sessions
│   │   │   ├── users/                  # User accounts & roles
│   │   │   └── vehicles/               # Vehicle energy profiles & contract certificates
│   │   ├── config/                     # Environment, Database, and Redis instances
│   │   ├── cron/                       # Scheduled background jobs (autoHeal, balancing, reimbursement)
│   │   ├── middleware/                 # authenticateToken, requireAdmin, errorHandler, upload
│   │   ├── ocpp/                       # Dual OCPP 1.6 & 2.1 WebSocket Server & Handlers
│   │   │   ├── handlers/               # OCPP 1.6 JSON message handlers
│   │   │   ├── v201/                   # OCPP 2.0.1 / 2.1 message router
│   │   │   ├── logsWebSocket.ts        # Live log stream
│   │   │   ├── ocppServer.ts           # Central WebSocket router
│   │   │   ├── realtime.socket.ts      # Socket.IO event broadcaster
│   │   │   └── remoteControl.ts        # Remote control RPC helpers
│   │   ├── services/                   # Business logic services
│   │   │   ├── AnalyticsService.ts
│   │   │   ├── DynamicTariffService.ts
│   │   │   ├── EpexSpotService.ts
│   │   │   ├── FirmwareUpdateService.ts
│   │   │   ├── GeoLocationService.ts
│   │   │   ├── LoadManagementService.ts
│   │   │   ├── MailService.ts
│   │   │   ├── MeterValueService.ts
│   │   │   ├── MollieService.ts
│   │   │   ├── OcpiService.ts
│   │   │   ├── PredictiveBalancingService.ts
│   │   │   ├── ReimbursementService.ts
│   │   │   ├── SepaXmlService.ts
│   │   │   ├── TotpService.ts
│   │   │   └── V2GOrchestrationService.ts
│   │   ├── utils/                      # Validation, logger, config-profile helpers
│   │   ├── app.ts                      # Express App factory
│   │   └── server.ts                   # Process bootstrap entrypoint
│   └── package.json
│
├── Frontend/                           # Next.js 16+ App Router Admin Dashboard
│   ├── app/                            # Next.js App Router Pages
│   │   ├── (auth)/                     # Login, Register, Forgot Password, Verify Email
│   │   ├── charge-groups/              # Group load balancing management
│   │   ├── chargers/                   # Charger lists, detail, remote control, config
│   │   ├── config-profiles/            # Standard OCPP parameter templates
│   │   ├── connectors/                 # EVSE socket configuration
│   │   ├── dashboard/                  # KPI overview, map view, active sessions
│   │   ├── hardware-at-risk/           # Auto-heal & hardware maintenance alerts
│   │   ├── invoices/                   # Enterprise billing ledger & SEPA Direct Debit
│   │   ├── media-campaigns/            # Multimedia advertisement scheduler
│   │   ├── mobile/                     # Responsive driver companion interface
│   │   ├── ocpp/                       # Raw OCPP live log stream inspector
│   │   ├── payments/                   # Ad-hoc charging session checkout
│   │   ├── quirk-profiles/             # Hardware quirk overrides
│   │   ├── reimbursements/             # Home charger reimbursement ledger & SEPA
│   │   ├── reservations/               # Charger booking & reservation manager
│   │   ├── rfid/                       # RFID card whitelist management
│   │   ├── roaming/                    # OCPI / OICP partner connections & settlement
│   │   ├── settings/                   # Platform configurations, EPEX, PKI, mail, Mollie
│   │   ├── stations/                   # Stations & Ground Plan 2D builder
│   │   ├── tariffs/                    # Tariff definitions & dynamic spot rates
│   │   ├── transactions/               # Session records & active telemetry
│   │   ├── users/                      # User & client administration
│   │   ├── v2g/                        # V2G fleet battery orchestration
│   │   └── vehicle-identity-management/# ISO 15118 vehicle contract certificates
│   ├── components/                     # Modular UI Components (shadcn/ui + Tailwind)
│   ├── hooks/                          # Custom React hooks
│   ├── lib/                            # Axios API client, utils, logger
│   ├── locales/                        # en.json, nl.json (i18n)
│   └── package.json
│
├── Manual/                             # Specialized Technical & User Guides (8 Documents)
├── Screenshots/                        # 72 High-Resolution UI Screenshots
├── AGENTS.md                           # AI Agent & Pair Programmer Reference Manual
└── README.md                           # Project Overview & Quick Start
```

---

## Technology Stack

### Backend
| Component | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v24+ (ESM) | Modern asynchronous JavaScript runtime |
| **Language** | TypeScript | 5.9+ | Strongly typed application code |
| **Framework** | Express | 5.x | High-performance HTTP/REST API server |
| **Database & ORM**| PostgreSQL + Prisma | Postgres 15+ / Prisma 7.8 | Type-safe SQL migrations & queries |
| **Cache & Pub/Sub**| Redis + `ioredis` | Redis 7+ | Real-time state cache and multi-instance broker |
| **WebSocket** | `ws` (RFC 6455) | 8.x | Dual OCPP 1.6 & 2.1 server on port 9220 |
| **Realtime Stream**| Socket.IO | 4.x | Live dashboard event push via `/api/realtime` |
| **Cron Engine** | `node-cron` | 3.x | Scheduled balancing, auto-heal, and billing jobs |
| **Banking XML** | `fast-xml-parser` | 5.x | ISO 20022 SEPA XML (`pain.001` & `pain.008`) |
| **Payments** | `@mollie/api-client` | 4.x | Ad-hoc card/iDEAL PaymentIntents & webhooks |

### Frontend
| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 16+ (App Router) | React 19 server & client components with Turbopack |
| **Language** | TypeScript 5.x | Strict type safety across UI components |
| **Styling** | TailwindCSS | Modern dark-mode enterprise UI design tokens |
| **Component Kit** | Radix UI (shadcn/ui) | Accessible, unstyled primitives styled with Tailwind |
| **Drag & Drop** | `@dnd-kit/core` & `sortable`| Interactive 2D station ground plan canvas |
| **Mapping** | `leaflet` + `react-leaflet` | Geospatial charger and station fleet view |
| **Internationalization** | `react-i18next` | Multi-language switching (English / Dutch) |

---

## Quick Start

### Prerequisites
- **Node.js** 24.15.0 or higher
- **PostgreSQL** 15 or higher
- **Redis** 7 or higher

### 1. Backend Setup

```bash
# 1. Navigate to backend directory
cd Backend

# 2. Configure environment variables
cp .env.example .env
# Edit .env and verify DATABASE_URL, REDIS_URL, and JWT_SECRET

# 3. Install dependencies
npm install

# 4. Generate Prisma Client & push schema to PostgreSQL
npm run prisma:generate
npx prisma db push --accept-data-loss

# 5. Create initial Superadmin account
npm run create-superadmin -- "admin@example.com" "password123"

# 6. Start development server (Port 3000 REST, Port 9220 OCPP)
npm run dev
```

### 2. Frontend Setup

```bash
# 1. Navigate to frontend directory (in a new terminal)
cd Frontend

# 2. Configure environment variables
cat <<EOT >> .env.local
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
EOT

# 3. Install dependencies
npm install

# 4. Start Next.js development server (Port 3002)
npm run dev
```

### Service Port Map

| Service | Protocol | Default URL | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin Dashboard** | HTTP | `http://localhost:3002` | Next.js Frontend Dashboard |
| **REST API** | HTTP | `http://localhost:3000/api` | Express REST API backend |
| **OCPP WebSocket** | WS | `ws://localhost:9220/OCPP/...` | EV Charger WebSocket listener |
| **Live Telemetry Stream** | WS / Socket.IO | `ws://localhost:3000/api/realtime` | Socket.IO event broadcaster |
| **Raw Log Viewer** | WS | `ws://localhost:3001` | Live raw log packet inspector |

---

## Configuration Reference

### Key Backend Environment Variables (`Backend/.env`)

```ini
# PostgreSQL Database Connection String
DATABASE_URL="postgresql://cms_user:your_password@localhost:5432/ocpp_cms?schema=public"

# REST API Port
PORT=3000

# OCPP WebSocket Port (Charger connections)
OCPP_PORT=9220

# Raw Log WebSocket Port
OCPP_LOG_WS_PORT=3001

# Redis Connection URL
REDIS_URL="redis://localhost:6379"

# JWT Secret for Bearer Token Authentication
JWT_SECRET="your-very-strong-jwt-secret-key"

# Timezone (Europe/Brussels, Europe/Amsterdam, UTC)
TZ="Europe/Brussels"

# Optional: ENTSO-E API Key for European spot market ingestion
ENTSOE_API_KEY=""

# Optional: Mollie API Key for ad-hoc payment processing
MOLLIE_API_KEY=""
```

---

## Connecting Chargers

To connect any physical or simulated OCPP charger, configure the hardware's Central System URL:

### OCPP 1.6-J Chargers
```
ws://<your-server-host>:9220/OCPP/1.6/<chargerId>
```
*(In production with SSL: `wss://ocpp.yourdomain.com/OCPP/1.6/<chargerId>`)*

### OCPP 2.0.1 / 2.1 Chargers
```
ws://<your-server-host>:9220/OCPP/2.1/<chargerId>
```
*(In production with SSL: `wss://ocpp.yourdomain.com/OCPP/2.1/<chargerId>`)*

> **Important:** `<chargerId>` must correspond to a registered charger record or will enter the **Unrecognized Chargers Queue** (`/chargers/unrecognized`) for operator approval.

---

## Testing & Quality Assurance

### Running Backend Unit & Integration Tests
The Backend uses Jest with native Node.js ESM support:

```bash
cd Backend
NODE_OPTIONS=--experimental-vm-modules npm test
```

To run a specific test suite (e.g. V2G Orchestration or Sepa XML):
```bash
npx jest src/tests/services/V2GOrchestrationService.test.ts
```

### TypeScript Validation
Verify that both Backend and Frontend compile with zero TypeScript errors:

```bash
# Typecheck Backend
cd Backend
npx tsc --noEmit

# Typecheck Frontend
cd ../Frontend
npx tsc --noEmit
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
