# Platform Overview & System Architecture

## 1. Executive Summary

The **OCPP Central Processing Management System (CPMS)** is an enterprise-grade platform engineered to manage, monitor, and optimize Electric Vehicle (EV) charging infrastructure at scale. Built for high concurrency and operational reliability, the system leverages a modern technology stack:

* **Backend Runtime:** Node.js 24+ (ESM) with TypeScript 5.9 and Express 5.
* **Database & ORM:** PostgreSQL 15+ managed with Prisma ORM 7.8.
* **Caching & Broker:** Redis 7 (`ioredis`) for multi-instance WebSocket pub/sub clustering, telemetry caching, and rate limiting.
* **Frontend Dashboard:** Next.js 16+ App Router (React 19) with TailwindCSS and Radix UI (shadcn/ui).
* **Dual-Protocol WebSocket:** Native `ws` engine handling both **OCPP 1.6-J** and **OCPP 2.0.1/2.1** on port `9220`.

```mermaid
flowchart TD
    CP["⚡ EV Charge Points\n(Physical Chargers)"]
    OCPP["OCPP WebSocket Server\nws://:9220/OCPP/[1.6|2.1]/{id}"]
    API["Backend REST API\nExpress + TypeScript\nhttp://:3000"]
    DB[("PostgreSQL Database\n(via Prisma ORM)")]
    UI["🖥️ Admin Dashboard\nNext.js 16+ App Router\nhttp://:3002"]
    RT["📋 Live Real-Time Server\nSocket.IO Stream\n/api/realtime"]
    V2G["🔄 V2G Orchestration\nService"]
    STRIPE["💳 Stripe API\n(Global Cards/Wallets)"]
    MOLLIE["💳 Mollie API\n(iDEAL / Bancontact)"]
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
    UI -->|"Checkout / Intent"| STRIPE
    UI -->|"Checkout / Intent"| MOLLIE
    API <-->|"Stripe Webhooks"| STRIPE
    API <-->|"Mollie Webhooks"| MOLLIE
    V2G -->|"Discharge Limits\n& Pricing"| API
```

---

## 2. Real-Time Telemetry Sequence

The following sequence illustrates the flow of real-time telemetry, transaction writes, and remote control commands between hardware units, backend services, and administrative interfaces:

```mermaid
sequenceDiagram
    participant CP as ⚡ EV Charge Point
    participant OCPP as OCPP Server (ws://:9220)
    participant Redis as Redis (Pub/Sub & Cache)
    participant API as REST API (Express)
    participant DB as PostgreSQL (Prisma)
    participant UI as Dashboard UI (Next.js)

    CP->>OCPP: WebSocket Handshake (/OCPP/1.6 or /OCPP/2.1)
    activate OCPP
    OCPP->>DB: Upsert Charger Connection & Online Status
    OCPP->>Redis: Publish Charger Online Event
    Redis-->>UI: Broadcast via Socket.IO (/api/realtime)

    rect rgb(240, 248, 255)
    Note over CP,OCPP: Transaction & MeterValues Telemetry
    CP->>OCPP: StartTransaction [2, "<id>", "StartTransaction", {...}]
    OCPP->>API: Process Transaction Record
    API->>DB: Persist Active Session
    API->>Redis: Cache Active Telemetry
    CP->>OCPP: MeterValues (Current, Voltage, SoC, Power)
    OCPP->>Redis: Update Realtime Gauges & Floor Plan
    Redis-->>UI: Push Live Metering Telemetry
    end

    rect rgb(255, 245, 238)
    Note over UI,CP: Remote Control & Smart Charging Dispatch
    UI->>API: HTTP POST /api/ocpp/remote-start
    API->>Redis: Publish remote_command channel
    Redis->>OCPP: Relay RPC to active WebSocket connection
    OCPP->>CP: OCPP CALL [2, "<msgId>", "RemoteStartTransaction", {...}]
    CP-->>OCPP: CALLRESULT [3, "<msgId>", {"status": "Accepted"}]
    OCPP-->>API: Resolve Redis Promise
    API-->>UI: HTTP 200 {"status": "Accepted"}
    end
    deactivate OCPP
```

---

## 3. Hardware Interoperability, Auto-Heal & Quirks Engine

Due to fragmentation across charging station manufacturers, various brands implement OCPP specifications with minor non-conformances. The platform addresses hardware reliability through two core subsystems:

### 3.1 The Quirk Normalizer Engine (`quirkNormalizer.ts`)
Located at `Backend/src/ocpp/quirkNormalizer.ts`, this service intercepts incoming `MeterValues` payloads before persistence. It applies brand-specific rules configured in **Quirk Profiles** (`/quirk-profiles`):

* **Power Calculation:** If a charger fails to report active power (`powerValue`), the engine computes it using 3-phase $(V_{L1} \cdot I_{L1} + V_{L2} \cdot I_{L2} + V_{L3} \cdot I_{L3})$ or single-phase $(V \cdot I)$ formulas.
* **Energy Unit Scaling:** Automatically scales Wh to kWh or applies integer scaling factors if hardware sends raw counters.
* **Energy Integration:** If hardware streams instantaneous Power (W) but fails to aggregate total Energy (Wh), Redis tracks time deltas to integrate energy numerically ($P \cdot \Delta t$).

![Quirk Profiles Hardware Overrides](../Screenshots/59_QuirkProfiles_HardwareOverrides.png)

### 3.2 Hardware-at-Risk & Auto-Heal (`/hardware-at-risk`)
A background heuristic worker continually evaluates charger health metrics (e.g. repeated transaction rejections, cable lock timeouts, silent heartbeats):
* Automatically classifies chargers as **Healthy**, **Warning**, or **Critical Risk**.
* Triggers automated recovery sequences (e.g., automated Soft Reset, connector unlock, and availability toggles).

![Hardware at Risk Auto-Heal](../Screenshots/54_HardwareAtRisk_AutoHeal.png)

### 3.3 Live Packet Inspector Console (`/ocpp`)
Engineers can inspect live unbuffered WebSocket frames to debug protocol exchanges in real-time.

![OCPP Packet Inspector Console](../Screenshots/55_OCPP_PacketInspector_Console.png)