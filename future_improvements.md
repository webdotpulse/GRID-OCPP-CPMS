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

---

## 2. 🔌 OCPP 2.0.1 / 2.1 & Hardware Lifecycle Management

* **OCPP 2.1 Native Bidirectional Power Transfer (BPT / V2X)**
  * Implement full OCPP 2.1 dynamic discharge profiles (`SetChargingProfile`), ISO 15118-20 DC/AC bidirectional support, and reactive power control (Var / Cos $\phi$) for local voltage grid stabilization.
* **Automated PKI & EST (Enrollment over Secure Transport) Sub-CA**
  * Automate X.509 certificate lifecycle management for OCPP Security Profile 3 (mTLS) and ISO 15118 Plug & Charge (CSMS Root, V2G Root, OEM Sub-CAs, and EVSE certificates) via EST/ACME protocols.
* **Canary & Staged Firmware Rollout Engine**
  * Support progressive fleet firmware updates (e.g., 5% Canary $\rightarrow$ 25% Staging $\rightarrow$ 100% Production) with automatic rollback triggers if error/fault rates exceed defined thresholds.

---

## 3. 🚚 Fleet Depot & Commercial Logistics Optimization

* **Vehicle OEM & Telematics Integration (Geotab, Samsara, Enode, Tesla Fleet API)**
  * Pull actual vehicle battery SoC, State of Health (SoH), odometer, and location directly via telematics APIs when chargers or cables do not transmit SoC via standard OCPP.
* **Mission-Critical Priority Queuing (Emergency & Delivery Vehicles)**
  * Rule-based dynamic load sharing that grants unconstrained maximum power to priority fleet vehicles while temporarily derating parked long-stay employee vehicles.

---

## 4. 🇪🇺 EU AFIR Compliance & Roaming Expansion

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

---

## 7. 🛡️ High Availability & Enterprise Platform Architecture

* **Active-Active Multi-Region Clustering & WebSocket Sharding**
  * Distributed Redis Pub/Sub WebSocket gateways with sticky sessions and zero-downtime rolling deploys.

---

## Roadmap Priority Matrix

| Feature Area | Priority | Complexity | Regulatory / Business Driver | Status |
| :--- | :--- | :--- | :--- | :--- |
| **EU AFIR Compliance & Open Data (NAP / DATEX II)** | Critical | High | Mandatory EU Regulation (2024/2026) | In Execution |
| **OCPP 2.1 Native Bidirectional Power Transfer (BPT / V2X)** | High | High | ISO 15118-20 & Smart Grid | Planned |
| **Vehicle OEM & Telematics Integration** | High | Medium | Fleet Telematics & Live SoC | Planned |
| **Automated PKI & EST Sub-CA** | High | High | Security Profile 3 & Plug & Charge | Planned |
| **OpenADR 2.0b / 3.0 & BESS Hybrid Buffering** | Medium | High | Grid Flexibility Markets & Peak Shaving | Planned |
| **Canary & Staged Firmware Rollout Engine** | Medium | Medium | Hardware Lifecycle & Fleet Reliability | Planned |
| **Mission-Critical Priority Queuing** | Medium | Medium | Commercial Fleet Logistics | Planned |
| **Virtual Waiting Queue & Smart Bay Reservations** | Medium | Low | Driver UX & High-Traffic Hubs | Planned |
| **Multi-Currency & Dynamic VAT Localization** | Medium | Medium | Pan-European Cross-Border Billing | Planned |
| **Active-Active Multi-Region Clustering** | High | High | Enterprise High Availability & Resilience | Planned |
| **AI Anomaly Detection & 3D Digital Twin** | Long-Term | High | Predictive Maintenance & Asset Management | Planned |
