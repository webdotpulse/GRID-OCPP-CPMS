# Developer Integration & API Guide

Welcome to the **Developer Integration & API Guide** for the OCPP Central Processing Management System (CPMS). This guide provides software engineers, systems integrators, and third-party developers with everything required to interact with our REST API, subscribe to real-time WebSocket events, customize hardware quirk profiles, and extend the platform.

---

## 1. Authentication & Security

All private endpoints (`/api/*`) enforce JSON Web Token (JWT) Bearer authentication.

### 1.1 Obtaining an Access Token

**Endpoint:** `POST /api/auth/login` (or `POST /api/auth/register`)

**Request Payload:**
```json
{
  "email": "developer@mobilitypulse.com",
  "password": "YourSecurePassword123!"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"developer@mobilitypulse.com", "password":"YourSecurePassword123!"}'
```

**Response Payload:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "developer@mobilitypulse.com",
      "role": "admin",
      "company_id": 1
    }
  }
}
```

### 1.2 Using the Bearer Token
Include the token in the `Authorization` header for all subsequent API requests:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. Core REST API Endpoints

### 2.1 Connected Chargers
Retrieve all currently online charging stations and their active protocol version.

**Endpoint:** `GET /api/ocpp/connected`  
**Auth:** Bearer Token

```bash
curl -X GET http://localhost:3000/api/ocpp/connected \
  -H "Authorization: Bearer <TOKEN>"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "chargerId": "CP-ALFEN-01",
      "protocol": "ocpp1.6",
      "connectedSince": "2026-08-27T10:00:00.000Z",
      "remoteAddress": "192.168.1.105"
    }
  ],
  "count": 1
}
```

---

### 2.2 Triggering Remote Start Transaction
Initiates a charging session remotely on a specific EVSE socket.

**Endpoint:** `POST /api/ocpp/remote-start`  
**Auth:** Bearer Token (Admin / Superadmin)

```typescript
interface RemoteStartRequest {
  chargerId: number | string;
  connectorId: number;
  idTag: string;
}
```

```bash
curl -X POST http://localhost:3000/api/ocpp/remote-start \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"chargerId": "CP-ALFEN-01", "connectorId": 1, "idTag": "TAG_RFID_001"}'
```

**Response:**
```json
{
  "success": true,
  "status": "Accepted"
}
```

---

### 2.3 Triggering Remote Stop Transaction
Terminates an active charging session gracefully.

**Endpoint:** `POST /api/ocpp/remote-stop`  
**Auth:** Bearer Token (Admin / Superadmin)

```bash
curl -X POST http://localhost:3000/api/ocpp/remote-stop \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"chargerId": "CP-ALFEN-01", "transactionId": 12054}'
```

---

### 2.4 Setting Smart Charging & V2G Profiles
Dispatches an OCPP `SetChargingProfile` to enforce site power limits, solar schedules, or V2G bidirectional discharge.

**Endpoint:** `POST /api/ocpp/set-charging-profile`  
**Auth:** Bearer Token (Admin)

```json
{
  "chargerId": "CP-ALFEN-01",
  "connectorId": 1,
  "csChargingProfiles": {
    "chargingProfileId": 100,
    "stackLevel": 1,
    "chargingProfilePurpose": "TxProfile",
    "chargingProfileKind": "Absolute",
    "chargingSchedule": {
      "chargingRateUnit": "A",
      "chargingSchedulePeriod": [
        {
          "startPeriod": 0,
          "limit": 16.0
        }
      ]
    }
  }
}
```

---

### 2.5 Querying Historical Transactions
Retrieve paginated session records with filter parameters.

**Endpoint:** `GET /api/transactions?page=1&limit=20&status=completed`

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 12054,
        "transactionId": "12054",
        "charger_id": 4,
        "connectorId": 1,
        "idTag": "TAG_RFID_001",
        "meterStart": 1420500,
        "meterStop": 1452100,
        "totalKwh": 31.6,
        "totalCost": 9.48,
        "status": "completed",
        "startTime": "2026-08-27T08:15:00.000Z",
        "stopTime": "2026-08-27T09:45:00.000Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 3. Real-Time WebSocket Subscriptions (Socket.IO)

Clients, mobile applications, and third-party dashboards can subscribe to live telemetry via Socket.IO:

* **Endpoint:** `http(s)://<your-server-host>/api/realtime`
* **Path:** `/api/realtime`

### Client Implementation Example (TypeScript / JavaScript):

```javascript
import { io } from "socket.io-client";

const socket = io("https://ocpp.mobilitypulse.com", {
  path: "/api/realtime",
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("Connected to CPMS Realtime Stream:", socket.id);
});

// Charger state updates (Available, Charging, Faulted)
socket.on("CHARGER_STATUS_UPDATE", (data) => {
  console.log("Status Notification:", data);
  // data: { chargerId: "CP-01", connectorId: 1, status: "Charging", errorCode: "NoError" }
});

// Live active meter values
socket.on("METER_VALUES_RECEIVED", (data) => {
  console.log("Live Telemetry:", data);
  // data: { transactionId: 12054, powerW: 11000, currentL1: 16, soc: 68 }
});

// Interactive ground plan update events
socket.on("GROUND_PLAN_UPDATE", (data) => {
  console.log("Ground Plan Update:", data);
});
```

---

## 4. Live Packet Inspector Console (`/ocpp`)

Engineers debugging hardware integrations can monitor raw JSON-RPC WebSocket frames in real-time.

![OCPP Packet Inspector Console](../Screenshots/55_OCPP_PacketInspector_Console.png)

---

## 5. Hardware Quirk Normalization (`quirkNormalizer.ts`)

To normalize non-standard vendor behavior, define rules in **Quirk Profiles** (`/quirk-profiles`):

![Quirk Profiles Hardware Overrides](../Screenshots/59_QuirkProfiles_HardwareOverrides.png)

### Quirk Engine Capabilities:
* `calculatePowerFromVoltageAndCurrent`: Automatically computes active power from phase voltages and currents if missing from `MeterValues`.
* `energyMultiplier`: Scales raw meter units (e.g. converting raw pulses or Wh to kWh).
* `estimateEnergyFromPower`: Dynamically calculates cumulative energy ($P \cdot \Delta t$) when chargers report power but omit energy registers.

### Creating a Quirk Profile via API:

```bash
curl -X POST http://localhost:3000/api/quirk-profiles \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vendor-X Power Synthesizer",
    "brand": "VendorX",
    "rules": {
      "calculatePowerFromVoltageAndCurrent": true,
      "energyMultiplier": 0.001
    }
  }'
```

---

## 6. Standardized Configuration Profiles (`/config-profiles`)

Deploy baseline OCPP parameter sets across charger models in a single operation.

![Config Profiles Templates](../Screenshots/58_ConfigProfiles_Templates.png)

---

## 7. Users, Corporate Clients & RBAC Architecture

The platform provides a strictly decoupled domain model for multi-tenant organizations:

### 7.1 Entity Distinction: Clients vs. Users
* **`Company` (Client)**: The legal B2B entity, billing account, and infrastructure owner (holding VAT, KvK, billing address, payment terms, and assigned charging stations).
* **`User` (Individual Identity)**: The authenticated human login (with credentials, 2FA, email verification) assigned a specific system role.

### 7.2 System Roles & Capabilities Matrix (`GET /api/roles`)
* `superadmin`: Global platform administrator (unrestricted cross-tenant access).
* `admin`: Platform / CPO Administrator (manages chargers, stations, tariffs, clients, users).
* `operator`: Operations & field technician (hardware diagnostics, remote commands, live monitoring).
* `client_admin`: Corporate fleet manager (manages company drivers, assigned chargers, invoices).
* `user`: EV Driver / End-user (personal charging sessions, RFID tags, vehicle profiles).

```bash
# Retrieve full system roles and capabilities matrix
curl -X GET http://localhost:3000/api/roles \
  -H "Authorization: Bearer <TOKEN>"
```

### 7.3 Managing Corporate Clients (`/api/companies`)
```bash
# Create a new B2B corporate client
curl -X POST http://localhost:3000/api/companies \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amsterdam Fleet Logistics BV",
    "clientNumber": "CLI-1001",
    "contactName": "Jan de Vries",
    "contactEmail": "jan@fleet.nl",
    "taxNumber": "NL123456789B01",
    "kvkNumber": "87654321",
    "city": "Amsterdam"
  }'
```
