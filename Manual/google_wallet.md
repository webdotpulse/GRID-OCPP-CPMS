# OCPP-CPMS Google Wallet & NFC Digital Pass Integration Guide

This guide documents the setup, configuration, and operational workflow for **Google Wallet Passes** and **Contactless NFC SmartTap** authorization within the **OCPP-CPMS (Charge Point Management System)**.

---

## 1. Overview & Architecture

OCPP-CPMS enables electric vehicle drivers to add their virtual and physical RFID charging cards directly to **Google Wallet** (Android / WearOS) and **Apple Wallet** (iOS / watchOS). 

When a driver approaches an authorized charging station, they can authenticate by holding their smartphone or smartwatch against the station's RFID/NFC reader, or by scanning the pass's dynamic QR code.

```mermaid
flowchart TD
    subgraph Drivers["📱 Driver Experience"]
        WEB["Admin Dashboard\n(/rfid & /rfid/:id)"]
        MOB["Driver Companion UI\n(/mobile/settings)"]
    end

    subgraph Backend["⚡ CPMS Backend Subsystems"]
        WPS["WalletPassService\n(Backend/src/services/WalletPassService.ts)"]
        WCTRL["Wallet Controller\n(GET /api/rfid/:id/google-wallet)"]
        JWT["RS256 JWT Token Signer\n(Google Service Account PEM)"]
    end

    subgraph Google["☁️ Google Infrastructure"]
        GAPI["Google Wallet API\n(Generic Pass Objects)"]
        GWALLET["Google Pay & Wallet Console\n(Issuer ID: 3388...)"]
        APP["Google Wallet App\n(Android / WearOS)"]
    end

    subgraph Hardware["⚡ EV Charging Station"]
        NFC["NFC / RFID Reader\n(ISO 14443 / SmartTap)"]
        OCPP["OCPP WebSocket Server\n(Authorize.req [idTag])"]
    end

    WEB & MOB -->|"Request Pass Details"| WCTRL
    WCTRL --> WPS
    WPS --> JWT
    JWT -->|"Generate Signed Save URL\nhttps://pay.google.com/gp/v/save/:jwt"| WCTRL
    WCTRL -->|"Return Save URL + QR Code"| WEB & MOB
    WEB & MOB -->|"1-Click Save or Camera Scan"| APP
    APP <-->|"Sync Pass & SmartTap Payload"| GAPI
    APP -->|"Contactless NFC Tap"| NFC
    NFC -->|"Transmit RFID idTag"| OCPP
```

---

## 2. Prerequisites & Google Cloud Setup

To sign and issue official Google Wallet passes in production, you need a **Google Cloud Project** and a **Google Pay & Wallet Business Console** account.

### Step 1: Create a Google Cloud Service Account
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your Google Cloud project (e.g. `grid-ev-charging-cpms`).
3. Navigate to **APIs & Services > Library** and search for **Google Wallet API**. Click **Enable**.
4. Navigate to **IAM & Admin > Service Accounts** and click **Create Service Account**:
   - **Name**: `google-wallet-pass-issuer`
   - **Description**: Service account for signing GRID CPMS digital RFID passes.
5. Once created, click on the service account, go to the **Keys** tab, click **Add Key > Create new key**, and select **JSON**.
6. A JSON key file will be downloaded to your computer. Keep this file secure.

### Step 2: Register in Google Pay & Wallet Business Console
1. Navigate to the [Google Pay & Wallet Business Console](https://pay.google.com/business/console).
2. Complete business verification and accept the terms of service.
3. In the left navigation, open **Google Wallet API**.
4. Note your **Issuer ID** (a numeric string, e.g. `3388000000022334455`).
5. Under **Users & Permissions / Service Accounts**, add your Google Cloud Service Account email address (`client_email` from your JSON key file) and grant it **Admin** or **Developer** permissions.

---

## 3. Environment Variables Configuration

Add the following environment variables to your backend `.env` file (located at `Backend/.env`):

```env
# ==============================================================================
# Google Wallet Passes & NFC SmartTap Configuration
# ==============================================================================
GOOGLE_WALLET_ISSUER_ID="3388000000022334455"
GOOGLE_WALLET_CLIENT_EMAIL="google-wallet-pass-issuer@grid-ev-charging.iam.gserviceaccount.com"
GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Base URL used for pass logos and verification links
APP_URL="https://cpo.thechargegrid.com"
```

### Formatting the Private Key (`GOOGLE_WALLET_PRIVATE_KEY`)
Open the JSON key file downloaded in Step 1. Copy the `private_key` string into `GOOGLE_WALLET_PRIVATE_KEY`:
- Keep the quotation marks `"..."`.
- Keep literal `\n` characters for line breaks. The backend automatically replaces `\\n` with standard newline characters during runtime.

---

## 4. Google Wallet Pass Structure & Claims

The backend generates a **Generic Object Pass** conforming to Google's standard Pass Class specifications:

```json
{
  "iss": "google-wallet-pass-issuer@grid-ev-charging.iam.gserviceaccount.com",
  "aud": "google",
  "origins": ["https://cpo.thechargegrid.com"],
  "typ": "savetowallet",
  "payload": {
    "genericObjects": [
      {
        "id": "3388000000022334455.RFID_NL_GRID_998877",
        "classId": "3388000000022334455.GRID_RFID_PASS_CLASS",
        "logo": {
          "sourceUri": {
            "uri": "https://cpo.thechargegrid.com/icons/icon-192x192.png"
          },
          "contentDescription": {
            "defaultValue": { "language": "en-US", "value": "GRID EV Charging Logo" }
          }
        },
        "cardTitle": {
          "defaultValue": { "language": "en-US", "value": "GRID EV Digital RFID Card" }
        },
        "subheader": {
          "defaultValue": { "language": "en-US", "value": "Driver" }
        },
        "header": {
          "defaultValue": { "language": "en-US", "value": "Alex Driver" }
        },
        "barcode": {
          "type": "QR_CODE",
          "value": "NL-GRID-998877",
          "alternateText": "NL-GRID-998877"
        },
        "smartTap": {
          "merchantId": "3388000000022334455",
          "value": "NL-GRID-998877"
        },
        "hexBackgroundColor": "#1e2228"
      }
    ]
  }
}
```

### Key Properties
- **`barcode`**: Formatted as high-density `QR_CODE` containing the driver's unique RFID `idTag`.
- **`smartTap`**: Configures contactless SmartTap 2.0 payload transmitting the RFID tag string directly over NFC to physical EV chargers.
- **`hexBackgroundColor`**: `#1e2228` (Enterprise dark mode palette matching the CPMS brand).

---

## 5. User & Operator Experience

### 1. In Admin Web Dashboard (`/rfid` & `/rfid/:id`)
1. Operators can view the RFID whitelist table at `/rfid`.
2. Clicking the **💳 Google Wallet** button opens the interactive **Google Wallet & NFC Pass Modal**:
   - Shows a live preview of the digital pass card.
   - Generates a dynamic QR code for instant scanning with an Android phone camera.
   - Provides a **Save to Google Wallet** direct button.
   - Provides a **Copy Pass URL** button to share with drivers via email or chat.
   - Includes cross-platform download for Apple Wallet (`.pkpass`).

### 2. In Driver Mobile Companion (`/mobile/settings`)
1. Drivers can view their assigned RFID passes under **Digital Wallet Passes**.
2. Tapping **💳 Google Wallet** opens the pass dialog or redirects straight to Google Wallet.

### 3. Contactless Charging Station Authentication
1. The driver taps their unlocked phone against the charger's RFID reader.
2. The charger reads the token payload via NFC SmartTap / ISO 14443.
3. The charger sends an OCPP `[2, "<id>", "Authorize", { "idTag": "NL-GRID-998877" }]` request to the CPMS server (`ws://:9220/OCPP/1.6/:chargerId`).
4. The CPMS validates the whitelist tag and responds with `[3, "<id>", { "idTagInfo": { "status": "Accepted" } }]`.

---

## 6. Testing & Development Fallback

For local development or staging environments without Google Cloud Service Account keys:
- The backend automatically uses a standard cryptographic signing fallback (`HS256`).
- The frontend pass dialog generates a real-time high-resolution QR code (`data:image/png;base64,...`) containing the exact RFID tag.
- Any mobile phone camera or QR scanner can scan and read the RFID tag directly from the screen to verify authentication.

---

## 7. Troubleshooting & FAQs

### Error: `Invalid JWT signature` or `400 Bad Request` in Google Wallet
- Ensure `GOOGLE_WALLET_PRIVATE_KEY` contains the exact PEM private key from your Google Cloud JSON key file.
- Confirm `GOOGLE_WALLET_CLIENT_EMAIL` matches the service account authorized in the Google Pay & Wallet Business Console.
- Ensure the Service Account has been granted **Developer** or **Admin** role in the Google Pay Console.

### Error: `Issuer ID not found`
- Verify that `GOOGLE_WALLET_ISSUER_ID` matches the numeric Issuer ID displayed in your Google Pay & Wallet Console.

### How do I customize the logo on the pass?
- Update `APP_URL` in your `.env` to point to your public domain, ensuring `/icons/icon-192x192.png` is publicly accessible over HTTPS.
