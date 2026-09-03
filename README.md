<h1 align="center">⚡ OCPP Charge Point Management System (CPMS)</h1>

<p align="center">
  An enterprise-grade, mission-critical <strong>OCPP 1.6-J & 2.0.1/2.1 Charge Point Management System (CPMS)</strong> supporting multi-protocol EV charging hardware, straight-through proxy routing, dual-socket charger combining, real-time WebSockets, dynamic EPEX spot pricing, predictive solar load balancing, V2G battery orchestration, ISO 20022 SEPA banking exports, Stripe & Mollie payments, OCPI & Hubject roaming, interactive 2D ground plans with electrical topologies, and responsive driver mobile interfaces.
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

## 📑 Table of Contents

1. [Executive Overview & Visual Showcase](#1-executive-overview--visual-showcase)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Core Capabilities & Enterprise Modules](#3-core-capabilities--enterprise-modules)
4. [OCPP Dual-Pipeline Engine (1.6-J & 2.0.1/2.1)](#4-ocpp-dual-pipeline-engine-16-j--20121)
5. [Smart Energy Routing & EPEX Spot Mathematics](#5-smart-energy-routing--epex-spot-mathematics)
6. [Roaming & Interoperability Hub (OCPI 2.2.1 & OICP 2.3)](#6-roaming--interoperability-hub-ocpi-221--oicp-23)
7. [Invoicing, Facturen & ISO 20022 SEPA Engine](#7-invoicing-facturen--iso-20022-sepa-engine)
8. [Hardware Auto-Heal & Quirk Mitigation](#8-hardware-auto-heal--quirk-mitigation)
9. [Mobile Driver Companion Application](#9-mobile-driver-companion-application)
10. [Repository Directory Layout](#10-repository-directory-layout)
11. [Technology Stack Matrix](#11-technology-stack-matrix)
12. [Installation & Deployment Guide](#12-installation--deployment-guide)
13. [Configuration Reference](#13-configuration-reference)
14. [Testing & Quality Assurance](#14-testing--quality-assurance)

---

## 1. Executive Overview & Visual Showcase

The **OCPP-CPMS** platform provides Charge Point Operators (CPOs), e-Mobility Service Providers (eMSPs), and commercial fleet managers with a sovereign, high-throughput operating system for electric vehicle charging assets.

### Platform Visual Tour

| Executive Dashboard Overview | Interactive 2D Ground Plan Builder |
| :---: | :---: |
| ![Executive Dashboard](Screenshots/06_Dashboard_Executive_Overview.png) | ![Ground Plan Builder](Screenshots/21_Station_GroundPlan_2D_Builder.png) |
| *Real-time fleet power, active transactions, revenue, and geospatial station map.* | *Drag-and-drop parking bays, line drawing, socket mapping, and live bay occupancy.* |

| Dynamic Load Balancing & Phase Groups | Charge Group Load Detail & Phase Limits |
| :---: | :---: |
| ![Dynamic Load Balancing](Screenshots/26_ChargeGroups_DynamicLoadBalancing.png) | ![Charge Group Detail](Screenshots/28b_ChargeGroup_Detail_View.png) |
| *Real-time site capacity monitoring, phase unbalance limits, and fail-safe currents.* | *Granular phase allocation (L1, L2, L3), active curtailment, and assigned chargers.* |

| Users Directory & Access Control | Corporate B2B Clients & Fleets |
| :---: | :---: |
| ![Users Directory](Screenshots/51_Users_Accounts_Directory.png) | ![Corporate Clients](Screenshots/51a_Corporate_Clients_Directory.png) |
| *Multi-tenant user registry, 2FA security indicators, and individual driver accounts.* | *Corporate client accounts with VAT/KvK, linked employee drivers, and assigned chargers.* |

| Roles & Capabilities Matrix (RBAC) | Invoicing & Facturen Ledger |
| :---: | :---: |
| ![Roles Matrix](Screenshots/51b_Roles_Permissions_Matrix.png) | ![Invoicing Ledger](Screenshots/39_Invoices_Billing_Ledger.png) |
| *Granular RBAC matrix across 6 operational modules and 5 system role tiers.* | *Automated monthly billing runs, VAT breakdown, and ISO 20022 Direct Debit export.* |

| Roaming & Interoperability Hub | Roaming Conformance Test Suite |
| :---: | :---: |
| ![Roaming Hubs](Screenshots/48_Roaming_OCPI_Hubs.png) | ![Roaming Test Suite](Screenshots/50b_Roaming_TestSuite.png) |
| *OCPI 2.2.1 and Hubject OICP 2.3 partner connections with token synchronization.* | *Automated CPO & eMSP endpoint conformance testing with synthetic telemetry.* |

| V2G Fleet Battery Orchestration | Raw OCPP Packet Inspector Console |
| :---: | :---: |
| ![V2G Orchestration](Screenshots/29_V2G_Battery_Orchestration.png) | ![OCPP Packet Inspector](Screenshots/55_OCPP_PacketInspector_Console.png) |
| *Bidirectional discharge controls, minimum SoC reserves, and fleet battery stats.* | *Real-time WebSocket JSON-RPC frame debugger with payload parsing and filtering.* |

| Hardware Reliability & Auto-Heal | Automated Recovery Playbooks |
| :---: | :---: |
| ![Hardware at Risk](Screenshots/54_HardwareAtRisk_AutoHeal.png) | ![Auto-Heal Playbooks](Screenshots/54b_AutoHeal_Playbooks.png) |
| *Automated fault detection, connector lock failures, and self-healing restart routines.* | *Visual workflow triggers for Soft/Hard reset, connector unlock, and power curtailment.* |

| Scheduled Smart Charging Calendar | Charger Simulator Studio |
| :---: | :---: |
| ![Scheduled Charging](Screenshots/56_ScheduledCharging_Calendar.png) | ![Simulator Studio](Screenshots/57_Charger_Simulator_Studio.png) |
| *Time-of-use energy allocation, off-peak solar alignment, and recurring profiles.* | *Interactive digital twins for stress-testing OCPP 1.6-J and 2.0.1/2.1 workflows.* |

---

## 2. End-to-End System Architecture

The system operates across a decoupled multi-tier architecture designed for horizontal scalability, high fault tolerance, and sub-second telemetry ingestion:

```mermaid
flowchart TD
    subgraph EVSE["⚡ Physical & Simulated Hardware"]
        CP1["Alfen Eve Double Pro\n(OCPP 1.6-J)"]
        CP2["ABB Terra 54 / 184\n(OCPP 2.0.1)"]
        CP3["EVBox Troniq / Mennekes\n(OCPP 2.1 Draft)"]
    end

    subgraph PROXY_LAYER["🔄 Reverse Proxy & Combiner"]
        PROXY["Straight-Through Proxy & Dual-Socket Combiner\nws://:9220/OCPP/[1.6|2.1]/{id}"]
    end

    subgraph CORE_SERVERS["🖥️ Backend Infrastructure (Node 24 / Express 5)"]
        WS_SERVER["Unified OCPP WebSocket Engine\n(RFC 6455 ws Server)"]
        REST_API["RESTful API Gateway\nhttp://:3000/api/v1"]
        SOCKET_IO["Live Telemetry Streamer\nSocket.IO /api/realtime"]
    end

    subgraph SERVICES["⚙️ Microservices & Logic Engines"]
        LMS["Dynamic Load Management (LMS)"]
        EPEX["Dynamic Tariff & EPEX Spot Service"]
        V2G_ENG["V2G Battery Orchestration Engine"]
        SEPA_ENG["ISO 20022 SEPA Banking Engine"]
        HEAL_ENG["Hardware Risk & Auto-Heal Engine"]
        ROAM_ENG["OCPI 2.2.1 / OICP 2.3 Roaming Hub"]
    end

    subgraph STORAGE["🗄️ Persistence & Distributed Cache"]
        DB[("PostgreSQL 15+\n(Prisma ORM 7.8)")]
        REDIS[("Redis 7 Cluster\n(Cache & BullMQ)")]
    end

    subgraph CLIENTS["📱 Client Interfaces"]
        DASHBOARD["Admin Dashboard\nNext.js 16+ (Port 3002)"]
        MOBILE["Mobile Driver Companion\n(Responsive PWA)"]
        PUBLIC_PAY["Ad-Hoc Session Checkout\n(Stripe & Mollie)"]
    end

    CP1 & CP2 & CP3 <--> PROXY
    PROXY <--> WS_SERVER
    WS_SERVER --> REST_API
    REST_API <--> DB
    WS_SERVER <--> REDIS
    REST_API <--> REDIS
    REST_API --> SOCKET_IO
    SOCKET_IO --> DASHBOARD & MOBILE
    REST_API <--> LMS & EPEX & V2G_ENG & SEPA_ENG & HEAL_ENG & ROAM_ENG
    DASHBOARD & MOBILE & PUBLIC_PAY <--> REST_API
```

---

## 3. Core Capabilities & Enterprise Modules

### 1. Multi-Protocol OCPP Engine
- Seamless dual-protocol handling supporting OCPP 1.6-J (JSON over WebSocket) and OCPP 2.0.1 / 2.1 draft.
- Real-time packet inspection console (`55_OCPP_PacketInspector_Console.png`) capturing raw JSON-RPC frames (`CALL`, `CALLRESULT`, `CALLERROR`) with microsecond timestamp precision.
- Remote control execution: `RemoteStartTransaction`, `RemoteStopTransaction`, `Reset (Soft/Hard)`, `UnlockConnector`, `ChangeAvailability`, `SetChargingProfile`, `TriggerMessage`, and `UpdateFirmware`.

### 2. Interactive 2D Ground Plan Canvas
- Visual site layout designer with drag-and-drop parking bays, entry barriers, transformer substations, and cable runs.
- Real-time connector occupancy status overlay (`Available`, `Preparing`, `Charging`, `SuspendedEVSE`, `Faulted`).
- Electrical topology mapping: Connect bays to site transformers to visualize real-time power bottlenecks.

### 3. Dynamic Load Balancing (LMS) & Phase Optimization
- Station and cluster-level load management preventing transformer overloads.
- Dynamic phase unbalance limitation (prevents exceeding 16A/32A difference across L1, L2, L3).
- Automated fail-safe fallback current allocation during network dropouts.

### 4. V2G Smart Grid & Battery Orchestration
- Bidirectional power routing compliant with ISO 15118-20.
- Peak shaving algorithms that discharge connected vehicle batteries during maximum local grid demand.
- Minimum state-of-charge (SoC) floor guard protecting vehicle range for driver departures.

### 5. Automated Facturen Ledger & ISO 20022 SEPA Banking
- Complete billing engine supporting corporate B2B multi-tenancy, VAT taxation (EU split rules), and ad-hoc payments.
- Native generator for ISO 20022 `pain.008.001.02` Direct Debit XML batches and `pain.001.001.03` Credit Transfers.
- Employee home charging reimbursement calculations with automated SEPA payroll export.

### 6. Hardware Reliability & Auto-Heal Playbooks
- Background anomaly detection evaluating heartbeat jitter, recurring connector lock errors, and communication drops.
- Automated multi-step remediation playbooks: Unlock connector actuator -> Soft reset -> Hard reset -> Alert dispatch.

---

## 4. OCPP Dual-Pipeline Engine (1.6-J & 2.0.1/2.1)

### Dual-Protocol Routing Architecture
The system listens on port **9220** (configurable via `OCPP_PORT`) and routes connections according to the requested subprotocol and URL path:
- `ws://<host>:9220/OCPP/<chargerId>`: Unified routing based on `Sec-WebSocket-Protocol` (`ocpp1.6`, `ocpp2.0.1`, `ocpp2.1`).
- `ws://<host>:9220/OCPP/1.6/<chargerId>`: Handled by the dedicated OCPP 1.6-J pipeline (`Backend/src/ocpp/handlers/`).
- `ws://<host>:9220/OCPP/2.1/<chargerId>`: Handled by the modern OCPP 2.0.1 / 2.1 pipeline (`Backend/src/ocpp/v201/`).

### Protocol Sequence Diagram: Charging Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant EV as Electric Vehicle
    participant CP as Charge Point (EVSE)
    participant CPMS as CPMS WebSocket Server (:9220)
    participant DB as PostgreSQL Database

    Note over CP,CPMS: Hardware Bootstrapping
    CP->>CPMS: [2, "msg-01", "BootNotification", {"chargePointModel": "Eve Double Pro", "chargePointVendor": "Alfen ICU"}]
    CPMS->>DB: Record charger model, firmware version, and IP
    CPMS-->>CP: [3, "msg-01", {"status": "Accepted", "currentTime": "2026-03-03T19:00:00Z", "interval": 60}]

    Note over CP,CPMS: RFID / ISO 15118 Authorization
    CP->>CPMS: [2, "msg-02", "Authorize", {"idTag": "04A1B2C3D4"}]
    CPMS->>DB: Query RfidUser whitelist & check active contracts
    CPMS-->>CP: [3, "msg-02", {"idTagInfo": {"status": "Accepted", "expiryDate": "2028-12-31T23:59:59Z"}}]

    Note over CP,CPMS: Transaction Initiation
    EV->>CP: Plug cable in
    CP->>CPMS: [2, "msg-03", "StatusNotification", {"connectorId": 1, "status": "Preparing"}]
    CPMS-->>CP: [3, "msg-03", {}]
    CP->>CPMS: [2, "msg-04", "StartTransaction", {"connectorId": 1, "idTag": "04A1B2C3D4", "meterStart": 14250, "timestamp": "2026-03-03T19:01:00Z"}]
    CPMS->>DB: Create Transaction record (status: Active)
    CPMS-->>CP: [3, "msg-04", {"transactionId": 8912, "idTagInfo": {"status": "Accepted"}}]

    Note over CP,CPMS: Periodic Telemetry & Dynamic Curtailment
    CP->>CPMS: [2, "msg-05", "MeterValues", {"connectorId": 1, "transactionId": 8912, "meterValue": [{"timestamp": "2026-03-03T19:05:00Z", "sampledValue": [{"value": "21800", "measurand": "Power.Active.Import", "unit": "W"}, {"value": "68", "measurand": "SoC", "unit": "Percent"}]}]}]
    CPMS->>DB: Ingest time-series MeterValue record
    CPMS-->>CP: [3, "msg-05", {}]

    Note over CP,CPMS: Transaction Finalization
    EV->>CP: Unplug cable / RFID swipe
    CP->>CPMS: [2, "msg-06", "StopTransaction", {"transactionId": 8912, "meterStop": 29850, "timestamp": "2026-03-03T19:45:00Z", "reason": "EVDisconnected"}]
    CPMS->>DB: Finalize session, calculate energy consumed (15.60 kWh), compute cost via DynamicTariffService
    CPMS-->>CP: [3, "msg-06", {"idTagInfo": {"status": "Accepted"}}]
```

---

## 5. Smart Energy Routing & EPEX Spot Mathematics

The CPMS incorporates a native Energy Management System (EMS) engine that optimizes charging speeds based on day-ahead wholesale electricity spot rates and local solar PV yields.

### Mathematical Formulation

#### 1. Dynamic Tariff Energy Cost Calculation
For a session spanning time interval $[t_0, t_f]$, the total financial cost $C_{\text{total}}$ is computed by:

$$C_{\text{total}} = F_{\text{conn}} + \int_{t_0}^{t_f} \left[ P_{\text{grid}}(t) \cdot \left( \lambda_{\text{EPEX}}(t) + \mu_{\text{markup}} \right) + P_{\text{solar}}(t) \cdot \lambda_{\text{solar}} \right] dt + \Delta t_{\text{idle}} \cdot F_{\text{idle}}$$

Where:
- $F_{\text{conn}}$: Fixed session connection fee (€).
- $P_{\text{grid}}(t)$: Net active power imported from the electrical grid (kW).
- $\lambda_{\text{EPEX}}(t)$: Hourly EPEX day-ahead spot market price (€/kWh).
- $\mu_{\text{markup}}$: CPO margin markup and grid tax surcharge (€/kWh).
- $P_{\text{solar}}(t)$: Power supplied by co-located onsite photovoltaic installation (kW).
- $\lambda_{\text{solar}}$: Preferential solar energy rate (€/kWh).
- $\Delta t_{\text{idle}}$: Grace period exceeded parking duration (minutes).
- $F_{\text{idle}}$: Penalty fee per idle minute (€/min).

#### 2. Phase-Balancing Current Allocation
For a charge group with $N$ connectors and a maximum safe site current $I_{\text{max}}$, the current allocation vector $\vec{I} = [I_1, I_2, \dots, I_N]^T$ subject to phase unbalance threshold $\Delta I_{\text{unbalance}}$ is given by:

$$\max_{\vec{I}} \sum_{k=1}^N I_k \quad \text{subject to} \quad \begin{cases} \sum_{k \in \Phi_p} I_k \le I_{\text{max}, p} & \forall p \in \{L1, L2, L3\} \\ |I_{L_a} - I_{L_b}| \le \Delta I_{\text{unbalance}} & \forall a, b \in \{1, 2, 3\}, a \ne b \\ I_{\text{min}} \le I_k \le I_{\text{cable}, k} & \forall k \in \{1, \dots, N\} \end{cases}$$

---

## 6. Roaming & Interoperability Hub (OCPI 2.2.1 & OICP 2.3)

The CPMS functions as a certified CPO and eMSP roaming hub:

```mermaid
flowchart LR
    CPMS["⚡ CPMS Platform"]
    
    subgraph OCPI["OCPI 2.2.1 Hub"]
        OCPI_LOC["Locations Module\n(EVSEs, Connectors, Tariffs)"]
        OCPI_SESS["Sessions Module\n(Live CDR Stream)"]
        OCPI_CDRS["CDRs Module\n(Financial Invoicing)"]
        OCPI_TOKS["Tokens Module\n(RFID / eMAID Whitelist)"]
    end

    subgraph OICP["Hubject OICP 2.3"]
        OICP_EVSE["eMobility EVSE Data\n(Push / Pull Status)"]
        OICP_AUTH["eMobility Authorize\n(Real-time Clearing)"]
        OICP_CDR["eMobility CDR\n(Settlement Engine)"]
    end

    CPMS <-->|"REST / JSON"| OCPI
    CPMS <-->|"SOAP / XML & REST"| OICP
```

- **Locations Synchronization**: Real-time push of connector status changes (`Available` / `Occupied` / `Faulted`) to navigation apps (Google Maps, Apple Maps, Plugshare).
- **Automated CDR Generation**: Charge Detail Records generated at session close and dispatched via OCPI 2.2.1 and Hubject OICP.
- **Roaming Conformance Test Suite**: Built-in test harness (`50b_Roaming_TestSuite.png`) validating eMSP authorization requests against synthetic CDR benchmarks.

---

## 7. Invoicing, Facturen & ISO 20022 SEPA Engine

The billing engine manages end-to-end financial workflows for both B2C ad-hoc drivers and corporate B2B client fleets:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ISO 20022 SEPA Direct Debit Engine                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [Transactions] ──► [Monthly Billing Run] ──► [PDF Factuur Generator]│
│                                │                                       │
│                                ▼                                       │
│                     [SEPA Mandate Registry]                            │
│                                │                                       │
│                                ▼                                       │
│                [pain.008.001.02 Direct Debit XML]                      │
│                                │                                       │
│                                ▼                                       │
│                [European Banking Network (ABN / ING / BNP)]            │
└────────────────────────────────────────────────────────────────────────┘
```

### Supported Banking Artifacts
1. **`pain.008.001.02`**: Customer Direct Debit Initiation (SEPA CORE & B2B schemes) with mandate reference verification.
2. **`pain.001.001.03`**: Customer Credit Transfer for automated employee home charging reimbursement payouts.
3. **Vector PDF Invoices**: Facturen generated with EU VAT compliance, reverse charge annotations, and per-session itemized kWh breakdowns.

---

## 8. Hardware Auto-Heal & Quirk Mitigation

Commercial EVSE hardware exhibits vendor-specific idiosyncrasies and mechanical wear. The CPMS includes native mitigation profiles:

| Hardware Vendor | Common Quirk / Hardware Failure Mode | CPMS Auto-Mitigation Routine |
| :--- | :--- | :--- |
| **Alfen ICU B.V.** | `ConnectorLockFailure` due to mechanical pin resistance | Executes `UnlockConnector` sequence up to 3 times before triggering soft reboot. |
| **ABB E-Mobility** | Session hang when vehicle stops draw without unplugging | Sends `SetChargingProfile` curtailing current to 0A followed by remote stop. |
| **EVBox** | Heartbeat timestamp drift leading to false offline flags | Auto-adjusts drift tolerance window in `HeartbeatInterval` response. |
| **Mennekes** | Missing `StopTransaction.req` on abrupt cable release | Synthesizes transaction closure using last known `MeterValues` timestamp. |
| **Zaptec** | Dynamic phase switching dropouts | Enforces 120-second delay between 1-phase and 3-phase reallocations. |

---

## 9. Mobile Driver Companion Application

Designed as a modern responsive web application (PWA) tailored for drivers on smartphone screens:

| Mobile Dashboard | Mobile Controller | Station Live Map |
| :---: | :---: | :---: |
| ![Mobile Dashboard](Screenshots/71_Mobile_Dashboard.png) | ![Mobile Controller](Screenshots/73_Mobile_Charger_Detail_Controller.png) | ![Mobile Map](Screenshots/74_Mobile_Station_Map.png) |
| *Personal charging stats, recent sessions, and active vehicle battery SoC.* | *Real-time session control, live kW curve, and one-tap connector unlock.* | *Geospatial station finder with real-time socket availability and directions.* |

---

## 10. Repository Directory Layout

```
OCPP-CPMS/
├── Backend/                            # Express 5 + TypeScript 6+ API & OCPP Server
│   ├── prisma/
│   │   ├── schema.prisma               # PostgreSQL Prisma Schema
│   │   └── migrations/                 # Migration history
│   ├── src/
│   │   ├── api/                        # Domain-Driven REST Controllers
│   │   │   ├── analytics/              # Aggregated kWh, revenue, and utilization reports
│   │   │   ├── auth/                   # JWT Auth, 2FA TOTP, Password Reset
│   │   │   ├── chargeGroups/           # Dynamic load balancing groups
│   │   │   ├── chargers/               # Charger CRUD & Connector mapping
│   │   │   ├── companies/              # Multi-tenant corporate accounts
│   │   │   ├── config-profiles/        # Standardized OCPP config templates
│   │   │   ├── dashboard/              # Metrics, live sessions, fleet capacity
│   │   │   ├── invoices/               # Invoicing & Facturen ledger
│   │   │   ├── media-campaigns/        # Charger screen multimedia advertisements
│   │   │   ├── ocpi/                   # OCPI 2.2.1 roaming endpoints
│   │   │   ├── ocpp/                   # OCPP REST triggers & live log stream
│   │   │   ├── payments/               # Stripe & Mollie checkout webhooks
│   │   │   ├── quirk-profiles/         # Vendor hardware quirk overrides
│   │   │   ├── reimbursements/         # Home charging reimbursement & SEPA
│   │   │   ├── rfid/                   # RFID whitelist & tag management
│   │   │   ├── stations/               # Charging stations & Ground Plan maps
│   │   │   ├── tariffs/                # Tariff CRUD & dynamic pricing formulas
│   │   │   └── users/                  # User accounts & RBAC matrix
│   │   ├── ocpp/                       # Dual OCPP 1.6 & 2.1 WebSocket Server
│   │   │   ├── handlers/               # OCPP 1.6 JSON message handlers
│   │   │   ├── ocppServer.ts           # Central WebSocket router
│   │   │   ├── realtime.socket.ts      # Socket.IO live broadcaster
│   │   │   └── remoteControl.ts        # Remote control RPC triggers
│   │   ├── services/                   # Business Logic Services
│   │   └── server.ts                   # Process bootstrap entrypoint
│   └── package.json
│
├── Frontend/                           # Next.js 16+ App Router Admin Dashboard
│   ├── app/                            # Next.js App Router Pages
│   │   ├── (auth)/                     # Login, Register, Forgot Password
│   │   ├── charge-groups/              # Dynamic load balancing
│   │   ├── chargers/                   # Fleet management & remote controls
│   │   ├── dashboard/                  # Executive KPI dashboard
│   │   ├── invoices/                   # Invoicing & SEPA Direct Debit export
│   │   ├── mobile/                     # Responsive driver companion interface
│   │   ├── ocpp/                       # Raw WebSocket log packet inspector
│   │   ├── roaming/                    # OCPI 2.2.1 / OICP 2.3 Hubs & Test Suite
│   │   ├── stations/                   # Stations & 2D Ground Plan builder
│   │   └── users/                      # Users & corporate client directory
│   ├── components/                     # Radix UI + Tailwind Design System
│   └── package.json
│
├── Manual/                             # 14 Detailed Technical Guides & PDFs
├── Screenshots/                        # Complete Platform Screenshot Suite
└── README.md                           # Master Documentation Overview
```

---

## 11. Technology Stack Matrix

| Component | Framework / Library | Version | Technical Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Node.js | v24+ LTS | High-concurrency asynchronous runtime |
| **Backend Engine** | Express + TypeScript | Express 5 / TS 6+ | Type-safe REST API server |
| **Database & ORM** | PostgreSQL + Prisma | Postgres 15+ / Prisma 7.8 | Relational SQL schema with strict types |
| **Distributed Cache** | Redis + `ioredis` | Redis 7+ | Distributed session state & rate limiting |
| **Background Queues** | BullMQ | v5+ | High-throughput asynchronous job workers |
| **OCPP WebSocket** | `ws` (RFC 6455) | v8+ | Sub-millisecond JSON-RPC WebSocket server |
| **Realtime Push** | Socket.IO | v4+ | Live telemetry broadcast to web dashboards |
| **Ad-Hoc Payments** | Stripe & Mollie | Latest SDKs | Credit card, Apple Pay, Google Pay, iDEAL |
| **Banking Standards** | `fast-xml-parser` | v4+ | ISO 20022 `pain.008` & `pain.001` XML generation |
| **Frontend Framework**| Next.js App Router | Next.js 16+ / React 19 | Server and client components with Turbopack |
| **Design System** | Tailwind CSS + Radix UI | Tailwind v3.4+ / shadcn | Dark-mode enterprise UI design tokens |
| **Canvas Drag & Drop** | `@dnd-kit/core` | Latest | 2D Station Ground Plan visual editor |
| **Geospatial Maps** | Leaflet + React-Leaflet | Leaflet v1.9+ | Interactive station location maps |

---

## 12. Installation & Deployment Guide

### Prerequisites
- **Node.js**: 22+ or 24+ LTS
- **PostgreSQL**: 15+
- **Redis**: 7+
- **Google Chrome**: (Optional, required for PDF manual compilation and screenshot suites)

### Step 1: Clone Repository
```bash
git clone https://github.com/webdotpulse/GRID-OCPP-CPMS.git
cd GRID-OCPP-CPMS
```

### Step 2: Backend Setup
```bash
cd Backend
npm install

# Configure environment variables
cp .env.example .env
# Ensure DATABASE_URL, REDIS_URL, and JWT_SECRET are populated

# Push schema and generate Prisma client
npx prisma generate
npx prisma db push --accept-data-loss

# Create initial Superadmin account
npm run create-superadmin -- "admin@example.com" "SuperSecurePassword123!"

# Start Backend development server
npm run dev
```

### Step 3: Frontend Setup
```bash
cd ../Frontend
npm install

# Start Next.js development server
npm run dev
```

The CPMS dashboard will be available at [http://localhost:3002](http://localhost:3002).

---

## 13. Configuration Reference

### Key Backend Environment Variables (`Backend/.env`)

```env
# Server Network Settings
PORT=3000
OCPP_PORT=9220
OCPP_LOG_WS_PORT=3001
NODE_ENV="development"

# Relational Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ocpp_cpms?schema=public"

# Redis Cache & Pub/Sub
REDIS_URL="redis://localhost:6379"

# Security & Authentication
JWT_SECRET="replace_with_a_secure_random_64_character_hex_string"
JWT_EXPIRES_IN="7d"

# Payment Gateways (Optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
MOLLIE_API_KEY="test_..."

# Wholesale Electricity Rates (EPEX Spot)
ENTSOE_API_KEY=""

# SMTP Transactional Mail Configuration
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="postmaster@yourdomain.com"
SMTP_PASS="your_smtp_password"
SMTP_FROM="Mobility Pulse <no-reply@mobilitypulse.com>"
```

---

## 14. Testing & Quality Assurance

```bash
# Run Backend Unit & Integration Tests
cd Backend
npm test

# Run Specific Service Test
npx jest src/tests/services/V2GOrchestrationService.test.ts

# Verify Zero Backend TypeScript Errors
cd ../Backend
npx tsc --noEmit

# Verify Zero Frontend TypeScript Errors
cd ../Frontend
npx tsc --noEmit

# Regenerate Entire Visual Screenshot Suite
cd ../Frontend
node scripts/generate_all_screenshots.mjs

# Recompile All Master PDF Manuals
node scripts/generate_manual_pdfs.mjs
```

---

*Authored with engineering excellence for enterprise EV charging infrastructure — webdotpulse/GRID-OCPP-CPMS.*
