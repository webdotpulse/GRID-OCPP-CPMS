<h1 align="center">🖥️ OCPP-CPMS Frontend Dashboard</h1>

<p align="center">
  Enterprise Next.js 16+ App Router & React 19 administrative dashboard for the <strong>OCPP Charge Point Management System (CPMS)</strong>. Features a bespoke dark-mode design system, interactive 2D drag-and-drop ground plans, real-time WebSocket telemetry streams, granular RBAC management, and responsive mobile driver interfaces.
</p>

---

## 📑 Table of Contents

1. [Architecture & Framework](#1-architecture--framework)
2. [Design System & UI Tokens](#2-design-system--ui-tokens)
3. [Page Routes & Navigation Catalog](#3-page-routes--navigation-catalog)
4. [Interactive Features & Components](#4-interactive-features--components)
5. [Automated Visual Screenshot & PDF Generator](#5-automated-visual-screenshot--pdf-generator)
6. [Developer Setup & Commands](#6-developer-setup--commands)

---

## 1. Architecture & Framework

The frontend is constructed using the modern **Next.js 16+ App Router** with **React 19 Server & Client Components** and **Turbopack**:

- **App Router (`app/`)**: File-system based nested layouts and route groups.
- **Client State & API Client**: Custom `useAuth` hook and Axios instance with automated Bearer token injection and 401 interceptors.
- **Real-Time Telemetry Streaming**: Socket.IO client listening to `/api/realtime` for sub-second connector state updates, active power curves, and charger online events.
- **Drag & Drop Engine**: `@dnd-kit/core` and `@dnd-kit/sortable` driving the 2D Station Ground Plan canvas.
- **Geospatial Visualizations**: Leaflet and React-Leaflet with custom EVSE status marker pins.

---

## 2. Design System & UI Tokens

The user interface follows an enterprise dark-mode aesthetic utilizing strict design tokens:

```css
/* Core Brand Tokens */
--color-bg-base: #1e2228;        /* Deep midnight carbon foundation */
--color-primary: #54a8c7;        /* Soft cyan accent for primary actions */
--color-secondary: #3f78e0;      /* Royal blue for navigation and badges */
--color-success: #45c4a0;        /* Mint emerald for active sessions and available pins */
--color-warning: #fab758;        /* Amber yellow for preparing and warning alerts */
--color-danger: #e2626b;         /* Coral red for faulted connectors and danger states */
--color-purple: #8b5cf6;         /* Violet for superadmin scopes and PKI certificates */
```

UI components are built on top of **Radix UI** primitives and styled with **Tailwind CSS** in `@/components/ui/`:
- Dialog, Sheet, Popover, DropdownMenu, Tabs, Accordion, Tooltip, Table, Badge, Button, Input, Slider, Select.

---

## 3. Page Routes & Navigation Catalog

```
Frontend/app/
├── (auth)/                             # Authentication Flow
│   ├── login/                          # Email/Password + 2FA Login Form
│   ├── register/                       # Corporate / Private Driver Sign Up
│   ├── forgot-password/                # Password Reset Request
│   ├── reset-password/                 # New Password Submission
│   └── verify-email/                   # Email Verification Confirmation
├── analytics/                          # Fleet KPI Graphs, kWh Reports & CSV Export
├── auto-heal-playbooks/                # Automated Hardware Remediation Workflows
├── charge-groups/                      # Dynamic Load Balancing Groups & Phase Allocations
│   ├── [id]/                          # Charge Group Detail View with Phase Meters
│   └── new/                            # Create New Load Balancing Cluster
├── chargers/                           # EVSE Hardware Fleet Directory
│   ├── [id]/                          # Charger Detail View (Connectors, Remote RPC, Profiles)
│   ├── register/                       # Provision New Charge Point
│   └── unrecognized/                   # Unclaimed Hardware Onboarding Queue
├── config-profiles/                    # Standardized OCPP Configuration Parameter Templates
├── dashboard/                          # Executive Overview, Geospatial Map & Live Sessions
├── hardware-at-risk/                   # Diagnostic Anomaly Flags & Fault Counters
├── invoices/                           # Invoicing Ledger, PDF Facturen & SEPA Export
├── media-campaigns/                    # Multimedia Screen Promotional Ads Scheduler
├── mobile/                             # Responsive Smartphone Driver Companion
│   ├── dashboard/                      # Mobile Personal Charging Summary
│   ├── chargers/                       # Mobile Nearby Chargers & Detail Controller
│   ├── map/                            # Mobile Station Map Finder
│   └── settings/                       # Driver Account Preferences
├── ocpp/                               # Raw Live WebSocket Packet Inspector Console
├── payments/                           # Ad-Hoc Public Session Checkout (Stripe & Mollie)
├── quirk-profiles/                     # Hardware Manufacturer Quirk Overrides
├── reimbursements/                     # Employee Home Charging SEPA Split-Billing Ledger
├── reservations/                       # Connector Booking & Scheduled Reservation Manager
├── rfid/                               # RFID Tag Whitelist & Card Assignment
├── roaming/                            # OCPI 2.2.1 / OICP 2.3 Partner Hubs & Test Suite
├── scheduled-charging/                 # Time-of-Use Off-Peak Charging Calendar
├── settings/                           # Global Settings Suite
│   ├── account/                        # Account Security & 2FA Setup
│   ├── audit/                          # Enterprise Audit Trail
│   ├── firmware/                       # Binary Upload & Over-the-Air (OTA) Updates
│   ├── mail/                           # SMTP Server Credentials
│   ├── payments/                       # Stripe & Mollie API Keys & Webhook Secrets
│   ├── products/                       # Subscription Plans & Charging Subscriptions
│   ├── roles/                          # Custom Roles & Capability Matrix (RBAC)
│   ├── security/                       # PKI TLS Certificates & Security Profiles
│   ├── tariffs/                        # EPEX Spot Formulas & Day-Ahead Tariffs
│   ├── templates/                      # Transactional HTML Email Template Editor
│   └── webhooks/                       # Outbound Event Webhooks
├── simulator/                          # Digital Twin EV Charger Simulator Studio
├── stations/                           # Charging Stations Directory & 2D Ground Plan Canvas
│   ├── [id]/                          # Station Overview & Bay Layout Editor
│   └── new/                            # Register New Station
├── tariffs/                            # Dynamic & Fixed Tariff Price Matrix
├── transactions/                       # Historical Session Records & Active Telemetry
├── users/                              # User Accounts & Corporate Client Management
└── vehicle-identity-management/        # ISO 15118 Plug & Charge Contract Certificates
```

---

## 4. Interactive Features & Components

### 1. Interactive 2D Ground Plan Builder (`app/stations/[id]/page.tsx`)
- Canvas supporting pan, zoom, grid-snapping, and background architectural schematic uploads.
- Drag-and-drop bay placers with adjustable rotation (0° to 360°), connector socket binding, and vehicle icon markers.
- Live floor plan monitor (`Screenshots/22_Station_Live_FloorPlan_Monitor.png`) displaying real-time connector occupancy and charging wattage.

### 2. Live OCPP Packet Inspector (`app/ocpp/page.tsx`)
- Sub-second streaming console capturing all inbound and outbound WebSocket frames.
- Search filter by charger ID, action name (`BootNotification`, `MeterValues`, `StatusNotification`), and message type (`Call`, `CallResult`, `CallError`).
- Formatted JSON payload viewer with syntax highlighting and copy-to-clipboard actions.

### 3. Corporate Clients & Multi-Role RBAC Hub (`app/users/page.tsx`)
- Three-tab management console:
  1. **Users Directory**: Individual credentials, 2FA status, role badges, and direct password resets.
  2. **Clients & Accounts**: B2B corporate organizations with VAT/KvK, linked employee drivers, and assigned hardware.
  3. **Roles & Permissions Matrix**: Visual capability grid showing allowed actions across 5 role tiers.

---

## 5. Automated Visual Screenshot & PDF Generator

The frontend contains an automated testing and asset generation engine using **Playwright** and **Chromium**:

```bash
# Generate complete 75-screen platform visual showcase
node scripts/generate_all_screenshots.mjs

# Compile high-resolution technical manuals to PDF
node scripts/generate_manual_pdfs.mjs
```

The generator launches a local Next.js production instance, injects mock authentication states, navigates through every administrative view, captures pixel-perfect high-DPI screenshots, and compiles the master user manuals.

---

## 6. Developer Setup & Commands

### Prerequisites
- Node.js 24+ LTS
- Google Chrome (installed at `/usr/bin/google-chrome` for headless generation)

### Commands
```bash
# Install dependencies
npm install

# Run development server (with Turbopack)
npm run dev

# Check TypeScript types (Must exit code 0)
npx tsc --noEmit

# Build production bundle
npm run build

# Start production server
npm run start
```

---

*Authored for enterprise EV charging infrastructure — webdotpulse/GRID-OCPP-CPMS.*
