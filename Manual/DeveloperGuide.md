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

```bash
curl -X POST http://localhost:3000/api/ocpp/remote-start \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"chargerId": "CP-ALFEN-01", "connectorId": 1, "idTag": "TAG_RFID_001"}'
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

### 2.5 Combining & Uncombining Dual-Socket Chargers
Pair two single-socket chargers of identical brand and model into a single dual-channel virtual charger:

**Combine Endpoint:** `POST /api/chargers/combine`  
**Request Payload:**
```json
{
  "primaryChargerId": 101,
  "secondaryChargerId": 102
}
```

**Uncombine Endpoint:** `POST /api/chargers/uncombine`  
**Request Payload:**
```json
{
  "chargerId": 101
}
```

---

### 2.6 Invoicing & SEPA Direct Debit API
Generate monthly invoices and export ISO 20022 SEPA Direct Debit XML batches:

* `GET /api/invoices` - List invoices with status, customer, and date filtering.
* `POST /api/invoices/generate` - Consolidate unbilled transactions for a month (`{ month: "2026-08", clientId?: 42 }`).
* `GET /api/invoices/:id/pdf` - Download generated tax invoice PDF.
* `POST /api/invoices/sepa-export` - Export validated ISO 20022 `pain.008.001.02` direct debit XML batch.

---

## 3. Real-Time WebSocket & Socket.IO Subscriptions

### 3.1 Live Telemetry Stream (`/api/realtime`)
Connect via Socket.IO client to receive real-time station metrics and active transaction updates:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  path: "/api/realtime",
  auth: { token: "YOUR_JWT_TOKEN" }
});

socket.on("connect", () => {
  console.log("Connected to Realtime Telemetry Hub");
});

socket.on("charger_status_change", (data) => {
  console.log("Charger status changed:", data);
});

socket.on("meter_values_update", (telemetry) => {
  console.log("Live meter value:", telemetry);
});
```

---

### 3.2 Unbuffered OCPP Live Packet Inspector Stream (`/api/ocpp/logs`)
Connect via native WebSocket to stream raw unbuffered JSON-RPC frames:

```javascript
const ws = new WebSocket("ws://localhost:3001/api/ocpp/logs");

ws.onmessage = (event) => {
  const packet = JSON.parse(event.data);
  console.log(`[${packet.direction}] Charger ${packet.chargerId}: ${packet.action}`, packet.payload);
};
```

---

## 4. BullMQ Asynchronous Worker Queues

The platform offloads compute-heavy tasks to BullMQ workers connected to Redis:

| Queue Name | Job Description | Frequency / Trigger |
| :--- | :--- | :--- |
| `billing-queue` | Computes monthly session aggregations & invoice generation | Monthly cron / Manual trigger |
| `metering-queue` | Batch processes high-frequency time-series telemetry data | Near real-time buffer flush |
| `oicp-sync-queue` | Submits Charge Detail Records (CDRs) to Hubject OICP | On transaction stop |
| `predictive-balancing` | Calculates 24h solar & spot price schedules | Hourly cron |
