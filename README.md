<h1 align="center">OCPP Charge Point Management System (CPMS)</h1>

<p align="center">
  An enterprise-grade, full-stack <strong>OCPP 1.6-J & 2.0.1/2.1 Charge Point Management System (CPMS)</strong> supporting multi-protocol EV charging hardware, straight-through proxy forwarding, dual-socket charger combining, real-time WebSockets, dynamic EPEX spot pricing, predictive solar load balancing, V2G battery orchestration, ISO 20022 SEPA banking exports, Stripe & Mollie payments, OCPI & Hubject roaming, interactive 2D ground plans with electrical topologies, and responsive driver mobile interfaces.
</p>

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16+-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Workers-FF5722?style=for-the-badge&logo=redis&logoColor=white)](https://bullmq.io/)
[![OCPP Protocol](https://img.shields.io/badge/OCPP-1.6--J%20%26%202.0.1%20%2F%202.1-FF6F00?style=for-the-badge&logo=socketdotio&logoColor=white)](https://openchargealliance.org/)
[![ISO 15118](https://img.shields.io/badge/ISO-15118%20PnC-800080?style=for-the-badge&logo=plugshare&logoColor=white)](https://www.iso.org/standard/77845.html)
[![SEPA Banking](https://img.shields.io/badge/SEPA-ISO%2020022-008080?style=for-the-badge&logo=europeanunion&logoColor=white)](https://www.europeanpaymentscouncil.eu/)
[![Payments](https://img.shields.io/badge/Payments-Stripe%20%26%20Mollie-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

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
- [Connecting Chargers & Proxy Setup](#connecting-chargers--proxy-setup)
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

The system operates across a decoupled multi-tier architecture:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             OCPP CPMS – System Architecture                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐           OCPP 1.6-J & 2.0.1/2.1 WebSocket          ┌──────────────────────────┐
  │   EV Chargers /  │ ◄──────────────────────────────────────────────────►│   OCPP WebSocket Server  │
  │   Charge Points  │       ws(s)://host:9220/OCPP/[1.6|2.1]/{id}         │   (Node.js / ws engine)  │
  └────────┬─────────┘                                                     └────────────┬─────────────┘
           │                                                                            │
           │ Straight-Through Proxy & Dual-Socket Combiner                              │ Internal Events
           ▼                                                                            ▼
  ┌──────────────────┐          HTTPS REST / Socket.IO                     ┌──────────────────────────┐
  │  Next.js Admin   │ ◄──────────────────────────────────────────────────►│   Express REST API       │
  │  Dashboard UI    │      http(s)://host:3000/api/v1/...                 │   (TypeScript 6+ / ESM)  │
  │  (Port 3002)     │ ◄──────────────────────────────────────────────────►│                          │
  └────────┬─────────┘      Socket.IO Stream (/api/realtime)               └────────────┬─────────────┘
           │ Stripe & Mollie Ad-Hoc                                                     │ ORM Queries
           ▼                                                                            ▼
  ┌──────────────────┐        Roaming Sync / Spot Pricing / SEPA           ┌──────────────────────────┐
  │ Stripe / Mollie  │ ◄──────────────────────────────────────────────────►│   PostgreSQL Database    │
  │ OCPI / OICP      │                                                     │   (via Prisma ORM 7.8)   │
  └──────────────────┘                                                     └────────────┬─────────────┘
                                                                                        │
                                                                                        │ Pub/Sub & Caching
                                                                                        ▼
                                                                           ┌──────────────────────────┐
                                                                           │   Redis 7 & BullMQ       │
                                                                           │   (Queues, State, Cache) │
                                                                           └──────────────────────────┘
```

```mermaid
flowchart TD
    CP["⚡ EV Charge Points\n(Physical Chargers)"]
    PROXY["🔄 Straight-Through Proxy\n& Charger Combiner"]
    OCPP["OCPP WebSocket Server\nws://:9220/OCPP/[1.6|2.1]/{id}"]
    API["Backend REST API\nExpress + TypeScript\nhttp://:3000"]
    DB[("PostgreSQL Database\n(via Prisma ORM)")]
    UI["🖥️ Admin Dashboard\nNext.js 16+ App Router\nhttp://:3002"]
    RT["📋 Live Real-Time Server\nSocket.IO Stream\n/api/realtime"]
    WORKER["⚙️ BullMQ Event Workers\n(Billing, Metering, Telemetry)"]
    V2G["🔄 V2G Orchestration\nService"]
    STRIPE["💳 Stripe API\n(Global Cards & Wallets)"]
    MOLLIE["💳 Mollie API\n(iDEAL / Bancontact)"]
    OCPI["🌍 OCPI 2.2.1 Partners"]
    OICP["🌐 Hubject OICP 2.3"]

    CP <-->|"OCPP 1.6 & 2.1/2.0.1 JSON\nWebSocket"| PROXY
    PROXY <--> OCPP
    PROXY <-->|"Upstream Forwarding"| EXT["3rd-Party CPO Backends"]
    OCPP -->|"Internal events\n& data writes"| API
    API <-->|"ORM queries\n& migrations"| DB
    API <-->|"Job queues"| WORKER
    WORKER <--> DB
    UI <-->|"HTTPS / REST"| API
    UI <-->|"Socket.IO stream"| RT
    OCPP -->|"Real-time\nlog broadcast"| RT
    OCPP <-->|"Pub/Sub\n& Caching"| REDIS[("Redis Cache & BullMQ")]
    API <-->|"Pub/Sub\n& Caching"| REDIS
    API -->|"Dynamic Power Limits"| LMS["Load Management Service"]
    LMS -->|"SetChargingProfile"| OCPP

    API <-->|"Roaming Sync"| OCPI
    API <-->|"Status & CDR Sync"| OICP
    UI -->|"Checkout / Intent"| STRIPE
    UI -->|"Checkout / Intent"| MOLLIE
    API <-->|"Stripe Webhooks"| STRIPE
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

### 🔄 Straight-Through Proxy & Dual-Socket Combiner Mode
- **Straight-Through Proxy:** Forward live OCPP traffic to 3rd-party CPO backends with transparent local packet inspection, telemetry caching, and card ID rewriting.
- **Dual-Socket Combiner:** Pair two single-socket physical charge points into a unified virtual dual-channel charger (Primary = Channel 1, Secondary = Channel 2), translating connector indices and synchronizing load balancing limits.

### 🖥️ Next.js 16+ Admin Dashboard
- Dark-mode executive analytics with real-time KPI tiles, power draw gauges, and revenue trends.
- Interactive geospatial station mapping using `react-leaflet` with clustered status indicators.
- Live active session monitor with continuous duration counters, energy metering, and dynamic charts.
- Full internationalization support (`react-i18next`) with English, Dutch, and French locale dictionaries.

### 🗺️ Interactive 2D Ground Plan Builder & Floor Monitor
- Visual drag-and-drop canvas powered by `@dnd-kit` for station parking bay layouts.
- Custom area drawing, boundary lines, 45-degree spot rotation, electrical feeder lines, and physical connector socket mapping.
- Real-time glassmorphism Live Monitor displaying live bay occupancy, charging wattage, delivered kWh, phase balance (L1/L2/L3), and driver tags.

### 🔄 Smart Charging, EPEX Spot Pricing & V2G Battery Orchestration
- **Dynamic Spot Pricing:** Automated daily ingestion of EPEX Day-Ahead hourly electricity prices (via EnergyZero, ENTSO-E, and Energy-Charts).
- **Predictive Solar Balancing:** 24-hour rolling schedule generation fusing Open-Meteo solar irradiance forecasts with spot prices to prioritize local green energy.
- **3-Phase Dynamic Load Management:** Phase current balancing (L1/L2/L3) and site capacity limits (Profile IDs 100 & 101) with automatic headroom restoration (<95%).
- **V2G Battery Orchestration:** Bidirectional energy routing commanded via Profile ID 300 negative amperage limits, enforcing configurable driver minimum SoC reserves.

### 🧾 Enterprise Invoicing ("Facturen") & ISO 20022 SEPA Direct Debit
- Comprehensive billing ledger (`/invoices`) aggregating completed charging sessions into monthly customer invoices.
- Line-item transaction breakdowns with meter timestamps, energy rates, idle fee penalties, and 21% VAT calculations.
- Integrated SEPA Mandate management (Unique Mandate Reference, debtor IBAN/BIC, signature validation).
- Banking-grade ISO 20022 SEPA Direct Debit XML export (`pain.008.001.02`) for direct corporate banking portal upload.

### 💸 Employee Home Reimbursements & SEPA Credit Transfer
- Automated split-billing engine for fleet drivers charging company vehicles at home.
- Monthly reimbursement contract ledgers mapping employee home meters, electricity rates, and IBANs.
- Banking-compliant ISO 20022 SEPA Credit Transfer XML export (`pain.001.001.03`).

### 💳 Stripe & Mollie Ad-Hoc Public Payments
- Seamless walk-in ad-hoc driver checkout via Stripe (Credit/Debit Cards, Apple Pay, Google Pay) and Mollie (iDEAL, Bancontact, EPS).
- Dedicated public checkout web page (`/payments`) with secure webhook callback validation (`/api/payments/webhook` and `/api/payments/webhook/stripe`).
- Centralized multi-gateway management console (`/settings/payments`) with sandbox testing, webhook helpers, and live credentials.

### 👥 Multi-Tenant Corporate Clients, Users & Granular RBAC
- Clear architectural separation between Corporate B2B Clients (legal business entities, VAT/KvK, assigned chargers, employee fleets) and User Accounts.
- 5-Tier role hierarchy (Superadmin, Admin, Operator / Technician, Client Admin, User / Driver).
- Interactive Roles & Capabilities Matrix across 6 operational modules.

### 🔑 Whitelist RFID & ISO 15118 Plug & Charge
- Central RFID whitelist management with instant remote activation, deactivation, and hardware cache flush.
- ISO 15118 Plug & Charge vehicle contract certificate management and vehicle energy profile pairing.

### 🌐 Roaming Hubs (OCPI 2.2.1 & OICP Hubject)
- Bidirectional CPO / MSP roaming integration for Locations, Tariffs, Sessions, Tokens, and CDRs.
- Hubject OICP 2.3 integration with asynchronous CDR reporting via BullMQ event workers.
- Roaming Settlement Visualizer and clearinghouse CSV report exporter tracking wholesale costs, retail billing, and partner net margins.

### 🛡️ Hardware Reliability: Auto-Heal & Quirk Normalizer
- **Hardware-at-Risk:** Automated heuristic scanner detecting silent disconnects, ground faults, and connector lock failures with configurable auto-heal recovery sequences.
- **Quirk Normalizer:** Runtime normalizer repairing vendor-specific OCPP non-compliance (missing power derivation, energy multipliers, power-to-energy integration).
- **Configuration Templates:** Standardized OCPP configuration profiles deployable across charger fleets with one click.

### 🔍 Live OCPP Packet Inspector Console
- Real-time unbuffered WebSocket JSON-RPC frame inspector (`CALL`, `CALLRESULT`, `CALLERROR`) with syntax highlighting, schema validation, and expandable tree view.

### 📱 Responsive Mobile Driver Companion
- Dedicated mobile web application (`/mobile`) optimized for smartphone screens, featuring nearby station discovery, interactive map routing, live charging controller, and driver account settings.

### 🔐 Enterprise Security & Auditability
- Role-Based Access Control (Superadmin, Admin, Operator, Client Admin, User) with tenant data isolation.
- Two-Factor Authentication (TOTP 2FA), email verification, and password reset flows.
- Cryptographic PKI Security Profiles (`/settings/security`) and immutable Enterprise Audit Trail logging (`/settings/audit`).

---

## Documentation & Manuals

### 📑 Publication-Ready PDF Manuals

| Manual | Format | Description |
| :--- | :---: | :--- |
| 📕 **[OCPP CPMS User & Operator Manual](Manual/OCPP_CPMS_User_Manual.pdf)** | **PDF** | Complete operational manual for CPOs, station managers, and EV drivers with high-res UI screenshots. |
| 📘 **[OCPP CPMS System Admin Manual](Manual/OCPP_CPMS_Admin_Manual.pdf)** | **PDF** | Comprehensive administrator guide for Multi-Tenancy, RBAC, PKI, EPEX Tariffs, Mail, Gateways, and Auto-Heal. |
| 📗 **[OCPP CPMS Installation & Deployment Manual](Manual/OCPP_CPMS_Installation_Manual.pdf)** | **PDF** | Complete DevOps guide for Ubuntu 24.04 VM deployment, Nginx, Let's Encrypt SSL, PostgreSQL, Redis, and PM2. |

### 📖 Online Markdown Documentation

| Document | Audience | Description |
| :--- | :--- | :--- |
| 👤 **[User & Operator Manual](Manual/user_manual.md)** | Station Operators & CPOs | Complete UI guide covering fleet management, ground plans, tariffs, invoicing, RFID, and mobile tools. |
| 👑 **[System Admin Manual](Manual/admin_manual.md)** | System & Enterprise Admins | Multi-tenant clients, RBAC matrix, PKI security, audit trails, EPEX configs, and hardware-at-risk rules. |
| 🛠️ **[Installation & Deployment Manual](Manual/installation_manual.md)** | DevOps & SysAdmins | Complete step-by-step installation, automated `install.sh`, interactive web wizard, Nginx WSS, and PM2. |
| ⚙️ **[Core Operations Manual](Manual/core_operations_manual.md)** | Daily Operations | Step-by-step procedures for asset hierarchy, ground plans, remote control, and live diagnostics. |
| 💰 **[Financial & Roaming Manual](Manual/financial_roaming_manual.md)** | Finance & Roaming Managers | Invoicing ledger, SEPA Direct Debit (`pain.008`), Reimbursements (`pain.001`), Stripe & Mollie, and OCPI/OICP. |
| ⚡ **[Smart Charging, EMS & V2G Guide](Manual/advanced_ems_smart_charging_guide.md)** | Energy Engineers | Technical algorithms for dynamic EPEX tariffs, solar predictive balancing, and V2G discharging. |
| 🗺️ **[Parking Ground Plan Manual](Manual/ground_plan_manual.md)** | Facility Managers | Guide to building 2D station layouts and operating the real-time glassmorphism Live Monitor. |
| 💻 **[Developer & API Guide](Manual/DeveloperGuide.md)** | Software Engineers | REST API endpoints, JWT Bearer auth, Socket.IO real-time subscriptions, and custom quirk development. |

---

## Project Directory Structure

```
OCPP-CPMS/
├── Backend/                            # Express 5 + TypeScript 6+ API & OCPP WebSocket Server
│   ├── prisma/
│   │   ├── schema.prisma               # PostgreSQL Prisma Schema
│   │   └── migrations/                 # Migration history
│   ├── src/
│   │   ├── api/                        # REST Controllers & Routes by Domain
│   │   │   ├── analytics/              # Aggregated kWh, revenue, and utilization reports
│   │   │   ├── audit/                  # Enterprise audit logging
│   │   │   ├── auth/                   # JWT Auth, 2FA TOTP, Password Reset, Email Verify
│   │   │   ├── chargeGroups/           # Load balancing group definitions
│   │   │   ├── chargers/               # Charger CRUD, Combiner & Connector mappings
│   │   │   ├── companies/              # Multi-tenant corporate client accounts
│   │   │   ├── config-profiles/        # Standardized OCPP config templates
│   │   │   ├── connectors/             # EVSE Connector CRUD
│   │   │   ├── dashboard/              # Metrics, live sessions, fleet capacity
│   │   │   ├── invoices/               # Facturen, line-item billing, and SEPA exports
│   │   │   ├── mail/                   # SMTP & HTML email templates
│   │   │   ├── media-campaigns/        # Charger screen video/image promotions
│   │   │   ├── ocpi/                   # OCPI 2.2.1 roaming endpoints
│   │   │   ├── ocpp/                   # OCPP REST triggers & live log history
│   │   │   ├── oicp/                   # Hubject OICP roaming endpoints
│   │   │   ├── payments/               # Stripe & Mollie payment intents & webhooks
│   │   │   ├── quirk-profiles/         # Vendor-specific hardware compatibility quirks
│   │   │   ├── reimbursements/         # Employee home charging SEPA calculation
│   │   │   ├── reservations/           # Station connector reservation scheduling
│   │   │   ├── rfid/                   # RFID card whitelist management
│   │   │   ├── roaming/                # Roaming partner credentials & settlement
│   │   │   ├── security/               # PKI security profiles & certificate status
│   │   │   ├── settings/               # System settings (tariffs, hardware risk, mail, payments)
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
│   │   │   ├── proxyRouter.ts          # Straight-through proxy & combiner logic
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
│   │   │   ├── OicpService.ts
│   │   │   ├── PredictiveBalancingService.ts
│   │   │   ├── ReimbursementService.ts
│   │   │   ├── SepaXmlService.ts
│   │   │   ├── StripeService.ts
│   │   │   ├── TotpService.ts
│   │   │   └── V2GOrchestrationService.ts
│   │   ├── workers/                    # BullMQ asynchronous background workers
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
│   │   ├── connectors/                 # EVSE connector lists & specs
│   │   ├── dashboard/                  # KPI overview, map view, active sessions
│   │   ├── hardware-at-risk/           # Auto-heal & hardware maintenance alerts
│   │   ├── invoices/                   # Enterprise billing ledger & SEPA Direct Debit
│   │   ├── media-campaigns/            # Multimedia advertisement scheduler
│   │   ├── mobile/                     # Responsive driver companion interface
│   │   ├── ocpp/                       # Raw OCPP live log stream inspector
│   │   ├── payments/                   # Ad-hoc charging session checkout (Stripe & Mollie)
│   │   ├── quirk-profiles/             # Hardware quirk overrides
│   │   ├── reimbursements/             # Home charger reimbursement ledger & SEPA
│   │   ├── reservations/               # Connector reservation scheduler
│   │   ├── rfid/                       # RFID card management
│   │   ├── roaming/                    # OCPI / OICP partner connections & settlement
│   │   ├── settings/                   # Platform configurations (Stripe, Mollie, PKI, EPEX)
│   │   ├── stations/                   # Stations & Ground Plan builder
│   │   ├── tariffs/                    # Tariff definitions & dynamic spot rates
│   │   ├── transactions/               # Session records
│   │   ├── users/                      # User & corporate client administration
│   │   ├── v2g/                        # V2G fleet battery orchestration
│   │   └── vehicle-identity-management/# ISO 15118 vehicle contract certificates
│   ├── components/                     # Modular UI Components (shadcn/ui + Tailwind)
│   ├── hooks/                          # React hooks (useAuth, useToast, etc.)
│   ├── lib/                            # Axios API client, utils, logger
│   ├── locales/                        # en.json, nl.json, fr.json (i18n)
│   └── package.json
│
├── Manual/                             # Comprehensive Technical & Operational Manuals
├── Screenshots/                        # Visual Interface Assets & Tour Gallery
├── AGENTS.md                           # Autonomous AI Agent Operating Manual
├── proposals.md                        # Architectural proposals
└── README.md                           # This document
```

---

## Technology Stack

| Component | Technology / Library | Description |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v22 - v24) | Modern JavaScript / ESM |
| **Backend Framework** | Express 5 + TypeScript 6+ | Typed REST API Server |
| **Database & ORM** | PostgreSQL 15+ + Prisma ORM 7.8 | Type-safe SQL migrations & queries |
| **Cache & Message Broker** | Redis 7 + `ioredis` | Telemetry cache & pub/sub clustering |
| **Async Background Queues** | BullMQ | Decoupled event & billing job workers |
| **OCPP WebSocket Engine** | `ws` (RFC 6455) | Native low-level WebSocket server on port 9220 |
| **Realtime Events** | Socket.IO 4 | WebSocket event broadcast to dashboard |
| **Payment Gateways** | `stripe` & `@mollie/api-client` | Card/Apple Pay/Google Pay & iDEAL payments |
| **Banking XML Standard** | `fast-xml-parser` | ISO 20022 SEPA XML generation (`pain.001` & `pain.008`) |
| **Frontend Framework** | Next.js 16 (App Router + Turbopack) | React 19 server/client components |
| **UI Design System** | TailwindCSS + Radix UI (shadcn/ui) | Modern dark-mode enterprise UI |
| **Drag & Drop Canvas** | `@dnd-kit/core` & `@dnd-kit/sortable` | Station ground plan interactive 2D builder |
| **Geospatial Mapping** | `leaflet` + `react-leaflet` | Geospatial charger & station map views |
| **Internationalization** | `react-i18next` | Multi-language (English / Dutch / French) |

---

## Quick Start

### 🚀 Automated 1-Click Production Deployment
Open [`interactive-setup.html`](interactive-setup.html) in any web browser to customize your domain names, passwords, and generate your 1-click deployment command or custom `install.sh` script.

Alternatively, execute the unattended production installer directly on your Ubuntu 22.04/24.04 VM:
```bash
sudo bash install.sh --frontend-domain "ui.yourdomain.com" --backend-domain "ocpp.yourdomain.com" -y
```

---

### 💻 Local Development Quickstart

### 1. Prerequisites
- **Node.js:** 22+ or 24+ LTS
- **PostgreSQL:** 15+
- **Redis:** 7+

### 2. Backend Setup
```bash
cd Backend
npm install
cp .env.example .env
# Edit .env to set your DATABASE_URL, REDIS_URL, and JWT_SECRET

# Sync schema and generate Prisma client
npx prisma generate
npx prisma db push --accept-data-loss

# Create the initial Superadmin account
npm run create-superadmin -- "admin@example.com" "SuperSecurePassword123!"

# Start Backend development server
npm run dev
```

### 3. Frontend Setup
```bash
cd ../Frontend
npm install
npm run dev
```
Open [http://localhost:3002](http://localhost:3002) in your browser and log in with your Superadmin credentials.

---

## Configuration Reference

### Key Backend Environment Variables (`Backend/.env`)

```env
# Database & Network
DATABASE_URL="postgresql://user:password@localhost:5432/ocpp_cms?schema=public"
PORT=3000
OCPP_PORT=9220
OCPP_LOG_WS_PORT=3001
REDIS_URL="redis://localhost:6379"
JWT_SECRET="generate_a_random_32_byte_hex_secret"

# Payment Gateways (Optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
MOLLIE_API_KEY="test_..."

# Smart Charging & EPEX Spot Rates
ENTSOE_API_KEY=""

# Transactional SMTP Mail
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="postmaster@yourdomain.com"
SMTP_PASS="your_smtp_password"
SMTP_FROM="Mobility Pulse <no-reply@mobilitypulse.com>"
```

---

## Connecting Chargers & Proxy Setup

Point physical or simulated OCPP chargers to the WebSocket server:

* **OCPP 1.6-J Endpoint:**
  ```text
  ws://<YOUR_IP_OR_DOMAIN>:9220/OCPP/1.6/<CHARGER_ID>
  ```
* **OCPP 2.0.1 / 2.1 Endpoint:**
  ```text
  ws://<YOUR_IP_OR_DOMAIN>:9220/OCPP/2.1/<CHARGER_ID>
  ```
* **Straight-Through Proxying:**
  Configure the upstream URL in charger settings. The CPMS will forward messages transparently while caching telemetry and inspecting packets.

---

## Testing & Quality Assurance

```bash
# Run Backend Unit & Integration Tests
cd Backend
npm test

# Run Frontend Typecheck
cd ../Frontend
npx tsc --noEmit

# Run Backend Typecheck
cd ../Backend
npx tsc --noEmit
```

---

*Authored with precision for enterprise EV infrastructure — webdotpulse/GRID-OCPP-CPMS.*
