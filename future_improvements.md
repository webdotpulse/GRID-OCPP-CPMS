# Future Improvements & Architectural Roadmap

This document outlines strategic enhancements, next-generation capabilities, and future backlog items for the **GRID-OCPP-CPMS** platform.

---

## 1. ⚡ Grid Flexibility & Next-Gen Energy Orchestration

* **OpenADR 2.0b / 3.0 Virtual End Node (VEN) Integration**
  * Connect to TSO/DSO grid operators (e.g., TenneT, Enexis, Liander, Fluvius, Elia) to receive automated demand-response events, peak-shaving curtailment signals, and frequency containment reserves (FCR/aFRR).
  * Monetize site flexibility by automatically throttling or pausing non-urgent charging sessions during grid congestion events.
* **BESS (Battery Energy Storage System) & Solar Hybrid Buffering**
  * Support on-site stationary battery storage tracking alongside solar arrays.
  * Implement smart dispatch algorithms: charge BESS from solar / negative EPEX prices and discharge BESS to buffer ultra-fast DC charging spikes without exceeding grid transformer connection limits.
* **1-Phase ⇄ 3-Phase Dynamic Commutation (Phase-Switching)** *(Completed)*
  * Dynamically switch compatible EVSEs between single-phase (1.4 kW minimum threshold) and 3-phase (4.1 kW minimum threshold) during low solar irradiance or high grid congestion to keep charging continuous without hard stops.
* **Intraday & Real-Time Imbalance Price Arbitrage** *(Completed)*
  * Extend current Day-Ahead EPEX spot pricing to include 15-minute Intraday continuous trading and national real-time settled imbalance markets for maximum energy cost optimization.

---

## 2. 🔌 OCPP 2.0.1 / 2.1 & Hardware Lifecycle Management

* **OCPP 2.1 Native Bidirectional Power Transfer (BPT / V2X)**
  * Implement full OCPP 2.1 dynamic discharge profiles (`SetChargingProfile`), ISO 15118-20 DC/AC bidirectional support, and reactive power control (Var / Cos $\phi$) for local voltage grid stabilization.
* **Automated PKI & EST (Enrollment over Secure Transport) Sub-CA**
  * Automate X.509 certificate lifecycle management for OCPP Security Profile 3 (mTLS) and ISO 15118 Plug & Charge (CSMS Root, V2G Root, OEM Sub-CAs, and EVSE certificates) via EST/ACME protocols.
* **Canary & Staged Firmware Rollout Engine**
  * Support progressive fleet firmware updates (e.g., 5% Canary $\rightarrow$ 25% Staging $\rightarrow$ 100% Production) with automatic rollback triggers if error/fault rates exceed defined thresholds.
* **Eichrecht & OCMF (Open Charge Metering Format) Legal Metrology** *(Completed)*
  * Ingest and cryptographically verify signed meter data public keys (OCMF / SML format) to guarantee tamper-proof billing compliance for German/Austrian legal metrology standards.
* **Built-in Virtual OCPP Charger Simulator / Test Lab** *(Completed)*
  * Add an in-dashboard interactive simulator to emulate physical chargers for OCPP 1.6-J and 2.0.1 testing (cable disconnects, meter value drift, offline transaction buffering, power drops).

---

## 3. 🚚 Fleet Depot & Commercial Logistics Optimization *(In Execution)*

* **Departure Time & Target SoC Scheduling Engine**
  * Allow fleet managers to define target SoC (e.g., 85%) and departure deadlines (e.g., 06:30 AM). The CPMS computes the most cost-effective non-linear charging curve using lowest-cost energy windows while guaranteeing 100% on-time vehicle departure.
* **Vehicle OEM & Telematics Integration (Geotab, Samsara, Enode, Tesla Fleet API)**
  * Pull actual vehicle battery SoC, State of Health (SoH), odometer, and location directly via telematics APIs when chargers or cables do not transmit SoC via standard OCPP.
* **Mission-Critical Priority Queuing (Emergency & Delivery Vehicles)**
  * Rule-based dynamic load sharing that grants unconstrained maximum power to priority fleet vehicles while temporarily derating parked long-stay employee vehicles.

---

## 4. 🇪🇺 EU AFIR Compliance & Roaming Expansion *(In Execution)*

* **AFIR (Alternative Fuels Infrastructure Regulation) Compliance Package**
  * **Ad-Hoc Pricing Transparency:** Pre-session QR price breakdown (energy rate/kWh, session fee, minute fee, idle fee) clearly rendered before authorization.
  * **National Access Point (NAP / DATEX II) Feeds:** Automated real-time open data export of station static/dynamic availability, connector health, and pricing.
  * **Direct POS Payment Terminal Support:** Integration protocols for physical unattended payment terminals (e.g., Payter, Nayax, Ingenico/CCV).
* **OCPI 2.2.1 / 3.0 Full Hub & Bi-directional eMSP Sync**
  * Bi-directional hub integration with automated tariff broadcasting, CDR reconciliation, foreign token whitelist caching, and remote reservation synchronization.
* **Bilateral Roaming Clearing & Settlement Reconciliation**
  * Monthly automated settlement engine with discrepancy detection between foreign partner CDRs and internal transaction records.

---

## 5. 📱 Driver Experience & Frictionless Charging

* **PWA & Native Mobile Companion App** *(Completed)*
  * Web App Manifest, Service Worker offline caching, and push notifications for key milestones (e.g., *Reached 80% SoC*, *Charging completed*, *Idle fee alert in 15 minutes*, *Solar green energy boost active*).
* **Apple Wallet & Google Wallet NFC Passes** *(Completed)*
  * Digital RFID charging cards stored in mobile wallets for one-tap NFC authorization at the charger without carrying plastic cards (.pkpass bundle & Google Pay Save URL).
* **Virtual Waiting Queue & Smart Bay Reservations**
  * When all chargers at a hub are occupied, drivers join a virtual queue via QR/PWA. Once a connector frees up, the driver gets an automatic 10-minute hold reservation to plug in.
* **Multi-Currency & Dynamic VAT Localization**
  * Cross-border billing capabilities supporting multiple currencies (EUR, GBP, CHF, USD) with dynamic B2B reverse-charge VAT rules.

---

## 6. 🧠 AI-Driven Diagnostics & 3D Digital Twin

* **High-Frequency Meter Value Anomaly Detection**
  * Machine learning models analyzing phase current, voltage drops, and harmonic distortion to flag degrading contact resistance, cable wear, or cooling failures before physical breakdown.
* **3D Isometric Ground Plan & Electrical Heatmap**
  * Upgrade the 2D Ground Plan canvas to an isometric/3D digital twin displaying underground cable trenches, transformer load heatmaps, and solar canopy power overlays.
* **Vendor-Specific Auto-Healing Playbooks** *(Completed)*
  * AI-assisted log parser for vendor-specific error codes (Alfen, EVBox, ABB, Schneider, Kempower) that automatically executes tailored multi-step recovery actions.

---

## 7. 🛡️ High Availability & Enterprise Platform Architecture

* **Active-Active Multi-Region Clustering & WebSocket Sharding**
  * Distributed Redis Pub/Sub WebSocket gateways with sticky sessions and zero-downtime rolling deploys.
* **Fine-Grained Custom RBAC & Audit Trails** *(Completed)*
  * Policy-based access controls (PBAC) allowing custom roles with granular per-site, per-charger-group, and per-action permissions.
* **Exportable Webhooks & Event-Driven API Subscriptions** *(Completed)*
  * Outbound webhook system allowing enterprise customers to stream real-time CPMS events directly into their ERP/SCADA/CRM systems.

---

## Roadmap Priority Matrix

| Feature Area | Priority | Complexity | Regulatory / Business Driver | Status |
| :--- | :--- | :--- | :--- | :--- |
| **EU AFIR Compliance & Open Data** | Critical | High | Mandatory EU Regulation (2024/2026) | In Execution |
| **Eichrecht & OCMF Legal Metrology** | Critical | High | German MessEG / Austrian Metrology | **Completed** |
| **1-Phase ⇄ 3-Phase Phase Switching** | High | Medium | Grid Flexibility & Continuous Solar PV | **Completed** |
| **Intraday & Imbalance Arbitrage** | High | High | Energy Flexibility & Cost Optimization | **Completed** |
| **Mobile PWA & NFC Wallet Passes** | Medium | Medium | Appless Charging & Driver Experience | **Completed** |
| **Fleet Depot & Scheduled Charging** | High | High | B2B Fleet Electrification & Cost Reduction | **Completed** |
| **Auto-Healing Vendor Playbooks** | High | Medium | Automated Fleet Diagnostics & Self-Healing | **Completed** |
| **Virtual OCPP Test Lab** | High | Medium | Rapid Hardware QA & Protocol Conformance | **Completed** |
| **Outbound Webhooks Subscriptions** | High | Medium | Third-Party ERP/TMS Integrations | **Completed** |
| **OpenADR & BESS Orchestration** | Medium | High | Grid Flexibility Markets & Peak Shaving | Planned |
| **AI Anomaly & 3D Digital Twin** | Long-Term | High | Predictive Maintenance & Asset Management | Planned |

