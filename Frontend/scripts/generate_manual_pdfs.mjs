import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../');
const MANUAL_DIR = path.resolve(ROOT_DIR, 'Manual');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, 'Screenshots');

function imgToBase64(filename) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Image not found: ${filePath}`);
    return '';
  }
  const ext = path.extname(filename).slice(1);
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${data}`;
}

const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4 portrait;
    margin: 18mm 14mm 20mm 14mm;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9.5pt;
    line-height: 1.55;
    margin: 0;
    padding: 0;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    min-height: 250mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24mm 16mm 16mm 16mm;
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f2b48 100%);
    color: #f8fafc;
    border-radius: 12px;
    position: relative;
    overflow: hidden;
  }

  .cover-page::after {
    content: '';
    position: absolute;
    top: -100px;
    right: -100px;
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(56, 189, 248, 0) 70%);
    border-radius: 50%;
    pointer-events: none;
  }

  .cover-badge-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .cover-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .badge-cyan { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
  .badge-emerald { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4); }
  .badge-indigo { background: rgba(129, 140, 248, 0.2); color: #818cf8; border: 1px solid rgba(129, 140, 248, 0.4); }
  .badge-amber { background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); }

  .cover-title {
    font-size: 26pt;
    font-weight: 800;
    line-height: 1.15;
    margin: 0 0 10px 0;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .cover-subtitle {
    font-size: 13pt;
    font-weight: 400;
    color: #94a3b8;
    margin: 0 0 24px 0;
    line-height: 1.4;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px;
    border-radius: 8px;
    margin-top: 24px;
  }

  .cover-meta-item {
    font-size: 8.5pt;
  }

  .cover-meta-label {
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }

  .cover-meta-value {
    color: #f1f5f9;
    font-weight: 500;
  }

  .cover-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 14px;
    font-size: 8pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }

  /* Table of Contents */
  .toc-container {
    page-break-after: always;
    padding: 10px 0;
  }

  .toc-title {
    font-size: 18pt;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }

  .toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .toc-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px dotted #cbd5e1;
    font-size: 9pt;
  }

  .toc-num {
    font-weight: 700;
    color: #0284c7;
    margin-right: 8px;
  }

  .toc-text {
    font-weight: 500;
    color: #334155;
    flex-grow: 1;
  }

  /* Section Styling */
  .section-block {
    margin-bottom: 22px;
  }

  .page-break {
    page-break-before: always;
  }

  .keep-together {
    page-break-inside: avoid;
  }

  h1.section-h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #0f172a;
    border-bottom: 2px solid #0284c7;
    padding-bottom: 6px;
    margin-top: 24px;
    margin-bottom: 12px;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h2.section-h2 {
    font-size: 12pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 16px;
    margin-bottom: 8px;
    border-left: 3px solid #38bdf8;
    padding-left: 8px;
  }

  h3.section-h3 {
    font-size: 10pt;
    font-weight: 600;
    color: #334155;
    margin-top: 12px;
    margin-bottom: 6px;
  }

  p {
    margin: 0 0 8px 0;
    color: #334155;
  }

  ul, ol {
    margin: 0 0 10px 0;
    padding-left: 20px;
    color: #334155;
  }

  li {
    margin-bottom: 4px;
  }

  /* Callout Alert Boxes */
  .callout {
    padding: 10px 14px;
    border-radius: 6px;
    margin: 12px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
    border-left: 4px solid;
  }

  .callout-info {
    background: #f0f9ff;
    border-color: #0284c7;
    color: #0369a1;
  }

  .callout-tip {
    background: #ecfdf5;
    border-color: #10b981;
    color: #047857;
  }

  .callout-warning {
    background: #fffbeb;
    border-color: #f59e0b;
    color: #b45309;
  }

  .callout-title {
    font-weight: 700;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.05em;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 6px 10px;
    border: 1px solid #1e293b;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  td {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    color: #334155;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Code blocks */
  pre, code {
    font-family: 'JetBrains Mono', monospace;
  }

  code {
    background: #f1f5f9;
    color: #0f172a;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 8pt;
  }

  pre {
    background: #0f172a;
    color: #f8fafc;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 7.5pt;
    line-height: 1.45;
    overflow-x: auto;
    page-break-inside: avoid;
    margin: 10px 0;
    border: 1px solid #1e293b;
  }

  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }

  /* Screenshots Figure */
  .screenshot-figure {
    margin: 12px 0;
    text-align: center;
    page-break-inside: avoid;
  }

  .screenshot-img {
    max-width: 100%;
    height: auto;
    max-height: 120mm;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    display: block;
    margin: 0 auto;
  }

  .screenshot-caption {
    font-size: 7.5pt;
    color: #64748b;
    font-weight: 500;
    margin-top: 4px;
    font-style: italic;
  }

  .screenshot-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 12px 0;
    page-break-inside: avoid;
  }

  .screenshot-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin: 12px 0;
    page-break-inside: avoid;
  }

  .screenshot-grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 12px 0;
    page-break-inside: avoid;
  }

  .screenshot-grid-item {
    text-align: center;
  }

  .screenshot-grid-item img {
    width: 100%;
    height: auto;
    border-radius: 5px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }

  .screenshot-grid-item .caption {
    font-size: 7pt;
    color: #64748b;
    margin-top: 3px;
  }
`;

function renderFigure(filename, caption) {
  const base64 = imgToBase64(filename);
  if (!base64) return '';
  return `
    <div class="screenshot-figure keep-together">
      <img class="screenshot-img" src="${base64}" alt="${caption}" />
      <div class="screenshot-caption">${caption}</div>
    </div>
  `;
}

function renderGrid2(item1, item2) {
  const b1 = imgToBase64(item1.file);
  const b2 = imgToBase64(item2.file);
  return `
    <div class="screenshot-grid-2 keep-together">
      <div class="screenshot-grid-item">
        <img src="${b1}" alt="${item1.caption}" />
        <div class="caption">${item1.caption}</div>
      </div>
      <div class="screenshot-grid-item">
        <img src="${b2}" alt="${item2.caption}" />
        <div class="caption">${item2.caption}</div>
      </div>
    </div>
  `;
}

function renderGrid3(item1, item2, item3) {
  const b1 = imgToBase64(item1.file);
  const b2 = imgToBase64(item2.file);
  const b3 = imgToBase64(item3.file);
  return `
    <div class="screenshot-grid-3 keep-together">
      <div class="screenshot-grid-item">
        <img src="${b1}" alt="${item1.caption}" />
        <div class="caption">${item1.caption}</div>
      </div>
      <div class="screenshot-grid-item">
        <img src="${b2}" alt="${item2.caption}" />
        <div class="caption">${item2.caption}</div>
      </div>
      <div class="screenshot-grid-item">
        <img src="${b3}" alt="${item3.caption}" />
        <div class="caption">${item3.caption}</div>
      </div>
    </div>
  `;
}

function renderGrid4(item1, item2, item3, item4) {
  const b1 = imgToBase64(item1.file);
  const b2 = imgToBase64(item2.file);
  const b3 = imgToBase64(item3.file);
  const b4 = imgToBase64(item4.file);
  return `
    <div class="screenshot-grid-4 keep-together">
      <div class="screenshot-grid-item">
        <img src="${b1}" alt="${item1.caption}" />
        <div class="caption">${item1.caption}</div>
      </div>
      <div class="screenshot-grid-item">
        <img src="${b2}" alt="${item2.caption}" />
        <div class="caption">${item2.caption}</div>
      </div>
      <div class="screenshot-grid-item">
        <img src="${b3}" alt="${item3.caption}" />
        <div class="caption">${item3.caption}</div>
      </div>
      <div class="screenshot-grid-item">
        <img src="${b4}" alt="${item4.caption}" />
        <div class="caption">${item4.caption}</div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// 1. USER MANUAL HTML
// ----------------------------------------------------------------------------
function buildUserManualHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OCPP CPMS – Comprehensive User & Operator Manual</title>
  <style>${baseStyles}</style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div>
      <div class="cover-badge-row">
        <span class="cover-badge badge-cyan">OCPP 1.6-J & 2.1</span>
        <span class="cover-badge badge-emerald">User & Operator Manual</span>
        <span class="cover-badge badge-indigo">Release v2.4</span>
      </div>
      <h1 class="cover-title">OCPP Charge Point Management System</h1>
      <div class="cover-subtitle">Enterprise EV Charging Network Operations, Ground Plans, Tariffs, Invoicing, RFID & Driver Companion Guide</div>
    </div>

    <div>
      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Document Target</div>
          <div class="cover-meta-value">Charge Point Operators (CPOs), Facility Managers & Drivers</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">System Version</div>
          <div class="cover-meta-value">v2.4 Enterprise Edition</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Publication Date</div>
          <div class="cover-meta-value">August 2026</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Publisher</div>
          <div class="cover-meta-value">webdotpulse / Mobility Pulse Network</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div>GRID-OCPP-CPMS Enterprise Documentation</div>
      <div>Confidential & Proprietary</div>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-container">
    <div class="toc-title">Table of Contents</div>
    <ul class="toc-list">
      <li class="toc-item"><span class="toc-num">01.</span><span class="toc-text">Getting Started & Authentication Security</span></li>
      <li class="toc-item"><span class="toc-num">02.</span><span class="toc-text">Executive Dashboard & Network KPIs</span></li>
      <li class="toc-item"><span class="toc-num">03.</span><span class="toc-text">Charging Stations & Interactive 2D Ground Plans</span></li>
      <li class="toc-item"><span class="toc-num">04.</span><span class="toc-text">Chargers Fleet, EVSE Connectors & Remote Controls</span></li>
      <li class="toc-item"><span class="toc-num">05.</span><span class="toc-text">User Accounts, Corporate Clients & Granular RBAC</span></li>
      <li class="toc-item"><span class="toc-num">06.</span><span class="toc-text">Active Charging Sessions & Transaction History</span></li>
      <li class="toc-item"><span class="toc-num">07.</span><span class="toc-text">Reservations Manager & Remote Hold</span></li>
      <li class="toc-item"><span class="toc-num">08.</span><span class="toc-text">Tariffs & Dynamic EPEX Spot Pricing</span></li>
      <li class="toc-item"><span class="toc-num">09.</span><span class="toc-text">Enterprise Invoicing ("Facturen") & ISO 20022 SEPA</span></li>
      <li class="toc-item"><span class="toc-num">10.</span><span class="toc-text">Home Charging Reimbursements & Split-Billing</span></li>
      <li class="toc-item"><span class="toc-num">11.</span><span class="toc-text">Public Walk-In Payments (Stripe & Mollie)</span></li>
      <li class="toc-item"><span class="toc-num">12.</span><span class="toc-text">Roaming Hubs (OCPI 2.2.1 & Hubject OICP)</span></li>
      <li class="toc-item"><span class="toc-num">13.</span><span class="toc-text">V2G Smart Grid & Battery Energy Orchestration</span></li>
      <li class="toc-item"><span class="toc-num">14.</span><span class="toc-text">Hardware Reliability, Quirks & Auto-Heal</span></li>
      <li class="toc-item"><span class="toc-num">15.</span><span class="toc-text">Media Screen Campaigns & Advertising</span></li>
      <li class="toc-item"><span class="toc-num">16.</span><span class="toc-text">Mobile Driver Companion Web Application</span></li>
    </ul>
  </div>

  <!-- Content Sections -->
  <div class="section-block">
    <h1 class="section-h1">1. Getting Started & Authentication Security</h1>
    <p>The <strong>OCPP-CPMS</strong> dashboard provides a secure web interface for operating electric vehicle charging infrastructure. Access the platform by navigating to your organization's URL (e.g. <code>https://ui.mobilitypulse.com</code> or <code>http://localhost:3002</code>).</p>
    
    <h2 class="section-h2">1.1 Login & Two-Factor Authentication (2FA TOTP)</h2>
    <ul>
      <li><strong>Standard Authentication:</strong> Input your registered corporate email and password. Passwords are securely hashed with salted bcrypt.</li>
      <li><strong>Two-Factor Authentication:</strong> If 2FA is active on your profile, you will be prompted for a 6-digit Time-Based One-Time Password (TOTP) from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).</li>
      <li><strong>Password Reset & Email Verification:</strong> Automated self-service workflows exist for forgotten credentials and initial account email validation.</li>
    </ul>

    ${renderGrid3(
      { file: '01_Auth_Login.png', caption: 'Secure Operator Login' },
      { file: '02_Auth_Register.png', caption: 'Driver / User Registration' },
      { file: '03_Auth_ForgotPassword.png', caption: 'Self-Service Password Reset' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">2. Executive Dashboard & Network KPIs</h1>
    <p>The <strong>Executive Dashboard</strong> (<code>/dashboard</code>) provides an instant operational summary across all connected charging stations:</p>
    
    <div class="callout callout-info">
      <div class="callout-title">Live Telemetry Overview</div>
      Metrics update automatically in real-time via Socket.IO WebSocket streams without requiring manual page refreshes.
    </div>

    <ul>
      <li><strong>Total Energy Delivered (kWh):</strong> Real-time accumulation of kilowatt-hours dispensed across all active and completed sessions.</li>
      <li><strong>Active Charging Sessions:</strong> Count of vehicles actively drawing or negotiating power.</li>
      <li><strong>Fleet Online Health:</strong> Percentage and status breakdown of online vs offline charge points.</li>
      <li><strong>Geospatial Station Map:</strong> Interactive Leaflet map displaying charging locations with status pins (Available, Charging, Faulted, Offline).</li>
      <li><strong>24-Hour Load Profiles:</strong> Visual hourly charts detailing peak demand and energy utilization trends.</li>
    </ul>

    ${renderFigure('06_Dashboard_Executive_Overview.png', 'Executive Dashboard with Live Fleet Metrics and Map View')}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">3. Charging Stations & Interactive 2D Ground Plans</h1>
    <p>A <strong>Station</strong> represents a physical charging site containing one or more physical charge points with specific geographical, electrical, and operational parameters.</p>

    <h2 class="section-h2">3.1 Station Directory & Management (<code>/stations</code>)</h2>
    <ul>
      <li>Create and edit stations with address, GPS latitude/longitude, total power capacity caps, and emergency contacts.</li>
      <li>Filter stations by active status, city, or assigned charge group cluster.</li>
    </ul>

    ${renderGrid2(
      { file: '17_Stations_Directory_Map.png', caption: 'Stations Directory & Geospatial Map' },
      { file: '18_Stations_Create_New.png', caption: 'Create Station Modal Form' }
    )}

    <h2 class="section-h2">3.2 2D Ground Plan Canvas & Live Floor Monitor</h2>
    <p>Enable Ground Plan on any station to build high-precision visual parking bay layouts:</p>
    <ul>
      <li><strong>2D Canvas Editor (<code>/stations/[id]/ground-plan</code>):</strong> Drag and drop parking bays, rotate bays at 45° angles, draw pedestrian paths and canopy shelters, map physical charger sockets to spots, and draw electrical feeder topology lines.</li>
      <li><strong>Live Floor Monitor (<code>/stations/[id]/live</code>):</strong> Real-time floor plan showing live spot occupancy, charging wattage, delivered kWh, 3-phase balance (L1/L2/L3), and driver RFID tag badges.</li>
    </ul>

    ${renderGrid2(
      { file: '21_Station_GroundPlan_2D_Builder.png', caption: 'Interactive 2D Ground Plan Canvas Builder' },
      { file: '22_Station_Live_FloorPlan_Monitor.png', caption: 'Live Station Floor Plan Monitor with Telemetry' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">4. Chargers Fleet, EVSE Connectors & Remote Controls</h1>
    
    <h2 class="section-h2">4.1 Fleet Directory (<code>/chargers</code>)</h2>
    <p>Track all physical charging hardware connected to the central system with OCPP protocol version, firmware build, serial number, and live state.</p>

    ${renderGrid2(
      { file: '07_Chargers_Fleet_Directory.png', caption: 'Chargers Fleet Directory' },
      { file: '09_Chargers_Unrecognized_Queue.png', caption: 'Unrecognized Chargers Auto-Discovery Queue' }
    )}

    <h2 class="section-h2">4.2 Charger Details & Remote Control RPCs (<code>/chargers/[id]</code>)</h2>
    <ul>
      <li><strong>Remote Control Commands:</strong> Remote Start Transaction, Remote Stop Transaction, Soft/Hard Reset, Unlock Connector, and Change Availability (Operative/Inoperative).</li>
      <li><strong>Connectors Tab:</strong> Configure plug types (Type 2, CCS2, CHAdeMO), phase types (1-phase / 3-phase / DC), and max voltage/amperage ratings.</li>
      <li><strong>Predictive Load Tab:</strong> Inspect 24-hour solar irradiance forecasts and dynamic power limit schedules.</li>
    </ul>

    ${renderGrid2(
      { file: '10_Charger_Detail_Overview_Tab.png', caption: 'Charger Detail & Remote Control Console' },
      { file: '11_Charger_Detail_Connectors_Tab.png', caption: 'EVSE Connectors Configuration Tab' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">5. User Accounts, Corporate Clients & Granular RBAC</h1>
    
    <h2 class="section-h2">5.1 Corporate B2B Clients vs Individual Users</h2>
    <ul>
      <li><strong>🏢 Corporate Clients:</strong> Business entities holding legal company names, VAT/KvK registrations, billing addresses, SEPA mandates, assigned charging hubs, and employee fleet drivers.</li>
      <li><strong>👥 Individual Users:</strong> Driver accounts with login credentials, 2FA settings, assigned RFID cards, and vehicle battery profiles.</li>
    </ul>

    <h2 class="section-h2">5.2 Roles & Permissions Matrix</h2>
    <p>The platform enforces a 5-tier role hierarchy (Superadmin, Platform Admin, Operator/Technician, Client Admin, User/Driver) across all operational modules.</p>

    ${renderGrid3(
      { file: '51_Users_Accounts_Directory.png', caption: 'Users Accounts Directory' },
      { file: '51a_Corporate_Clients_Directory.png', caption: 'Corporate B2B Clients Hub' },
      { file: '51b_Roles_Permissions_Matrix.png', caption: 'Roles & Capabilities Matrix' }
    )}

    <h2 class="section-h2">5.3 RFID Whitelist & ISO 15118 Plug & Charge</h2>
    <p>Manage RFID cards by <code>idTag</code> with instant hardware cache synchronization, and manage ISO 15118 contract certificates (EMAID) for automated Plug & Charge authorization.</p>

    ${renderGrid2(
      { file: '30_RFID_Whitelist_Directory.png', caption: 'RFID Whitelist Directory' },
      { file: '34_VehicleIdentity_PlugAndCharge.png', caption: 'ISO 15118 Plug & Charge Contract Certificates' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">6. Active Sessions & Transaction History</h1>
    
    <h2 class="section-h2">6.1 Live Active Sessions (<code>/transactions/active</code>)</h2>
    <p>Monitor ongoing charging sessions in real-time with continuous duration timers, live wattage draw (kW), consumed energy (kWh), and dynamic cost accumulation.</p>

    <h2 class="section-h2">6.2 Historical Records & Itemized Receipts (<code>/transactions</code>)</h2>
    <p>Search completed transaction records by date range, station, charger, card tag, or driver account, and inspect itemized VAT receipts.</p>

    ${renderGrid2(
      { file: '37_Transactions_Live_Active_Sessions.png', caption: 'Live Active Sessions Monitor' },
      { file: '38_Transaction_Detail_Receipt.png', caption: 'Detailed Transaction Tax Receipt' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">7. Reservations Manager</h1>
    <p>The <strong>Reservations Manager</strong> (<code>/reservations</code>) allows operators and drivers to schedule exclusive charging windows:</p>
    <ul>
      <li>Reserve specific EVSE sockets for specified arrival times.</li>
      <li>Transmits OCPP <code>ReserveNow</code> commands to place physical hardware in <code>Reserved</code> state.</li>
      <li>Configurable reservation expiry windows and automatic cancellation on no-show.</li>
    </ul>

    ${renderFigure('35_Reservations_Manager.png', 'Reservations Management Console')}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">8. Tariffs & Dynamic EPEX Spot Pricing</h1>
    
    <h2 class="section-h2">8.1 4-Part Tariff Pricing Matrices (<code>/tariffs</code>)</h2>
    <table>
      <thead>
        <tr><th>Fee Component</th><th>Unit</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Connection Fee</strong></td><td>€ / session</td><td>Fixed one-time starting charge when session begins.</td></tr>
        <tr><td><strong>Energy Fee</strong></td><td>€ / kWh</td><td>Price per kWh consumed (flat rate or dynamic spot).</td></tr>
        <tr><td><strong>Time Fee</strong></td><td>€ / hour</td><td>Duration charge applied while vehicle is actively plugged in.</td></tr>
        <tr><td><strong>Idle Fee</strong></td><td>€ / hour</td><td>Penalty surcharge after battery reaches 100% SoC.</td></tr>
      </tbody>
    </table>

    ${renderGrid2(
      { file: '45_Tariffs_Pricing_Structures.png', caption: 'Tariffs Pricing Structures' },
      { file: '46_Tariffs_Create_New.png', caption: 'Create Tariff Modal Form' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">9. Enterprise Invoicing ("Facturen") & ISO 20022 SEPA</h1>
    <p>The <strong>Invoices Suite</strong> (<code>/invoices</code>) provides automated end-of-month billing runs for corporate accounts and private subscribers:</p>
    <ul>
      <li><strong>Billing Ledger:</strong> Aggregates unbilled charging sessions and displays turnover, subtotal, and 21% VAT metrics.</li>
      <li><strong>SEPA Direct Debit XML (<code>pain.008.001.02</code>):</strong> Generate standardized ISO 20022 banking direct debit files for direct upload to banking portals.</li>
      <li><strong>SEPA Mandate Management:</strong> Track B2B and CORE Direct Debit mandates with Unique Mandate References (UMR).</li>
    </ul>

    ${renderGrid3(
      { file: '39_Invoices_Billing_Ledger.png', caption: 'Invoicing Ledger & Turnover KPIs' },
      { file: '41_Invoices_Generate_Dialog.png', caption: 'Monthly Batch Invoicing Wizard' },
      { file: '43_Invoices_DirectDebit_Export_Dialog.png', caption: 'ISO 20022 SEPA Direct Debit Export' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">10. Home Reimbursements & Public Payments</h1>
    
    <h2 class="section-h2">10.1 Employee Home Reimbursements (<code>/reimbursements</code>)</h2>
    <p>Calculates employee home charging kWh and generates <strong>ISO 20022 SEPA Credit Transfer XML</strong> (<code>pain.001.001.03</code>) for bulk corporate reimbursement payouts.</p>

    <h2 class="section-h2">10.2 Public Walk-In Payments (Stripe & Mollie)</h2>
    <p>Ad-hoc walk-in drivers scan QR codes at charging bays to pay via Stripe (Credit Card, Apple Pay, Google Pay) or Mollie (iDEAL, Bancontact, EPS).</p>

    ${renderGrid2(
      { file: '44_Reimbursements_HomeCharging_SEPA.png', caption: 'Employee Home Reimbursements & SEPA' },
      { file: '60_Public_Payments_Checkout.png', caption: 'Public Ad-Hoc Checkout Portal' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">11. Roaming Hubs & V2G Smart Grid</h1>
    
    <h2 class="section-h2">11.1 OCPI 2.2.1 & Hubject OICP Roaming (<code>/roaming</code>)</h2>
    <p>Synchronize locations, tariffs, sessions, tokens, and CDRs with international roaming clearinghouses.</p>

    <h2 class="section-h2">11.2 V2G Battery Orchestration (<code>/v2g</code>)</h2>
    <p>Manage bidirectional power flow from EV batteries back to local buildings during high-tariff grid hours while maintaining minimum driver SoC reserves.</p>

    ${renderGrid2(
      { file: '48_Roaming_OCPI_Hubs.png', caption: 'OCPI 2.2.1 Roaming Hubs' },
      { file: '29_V2G_Battery_Orchestration.png', caption: 'V2G Fleet Battery Orchestration' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">12. Mobile Driver Companion Web Application</h1>
    <p>The dedicated mobile web app (<code>/mobile</code>) provides a responsive smartphone experience for drivers on the road:</p>
    <ul>
      <li><strong>Mobile Dashboard (<code>/mobile/dashboard</code>):</strong> Active charging widget, nearest station finder, and recent receipt history.</li>
      <li><strong>Mobile Fleet (<code>/mobile/chargers</code>):</strong> List of available chargers with connector plug types and distance.</li>
      <li><strong>Remote Controller (<code>/mobile/chargers/[id]</code>):</strong> Start and stop charging sessions directly from your phone.</li>
      <li><strong>Geospatial Map (<code>/mobile/map</code>):</strong> Interactive GPS routing and charger availability pins.</li>
    </ul>

    ${renderGrid4(
      { file: '71_Mobile_Dashboard.png', caption: 'Mobile Dashboard' },
      { file: '72_Mobile_Chargers_Fleet.png', caption: 'Mobile Fleet Directory' },
      { file: '73_Mobile_Charger_Detail_Controller.png', caption: 'Remote Charger Controller' },
      { file: '74_Mobile_Station_Map.png', caption: 'Geospatial GPS Map' }
    )}
  </div>

</body>
</html>
  `;
}

// ----------------------------------------------------------------------------
// 2. ADMIN MANUAL HTML
// ----------------------------------------------------------------------------
function buildAdminManualHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OCPP CPMS – System Administration & Enterprise Management Manual</title>
  <style>${baseStyles}</style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div>
      <div class="cover-badge-row">
        <span class="cover-badge badge-indigo">System Administration</span>
        <span class="cover-badge badge-cyan">Enterprise Security</span>
        <span class="cover-badge badge-amber">Release v2.4</span>
      </div>
      <h1 class="cover-title">OCPP Charge Point Management System</h1>
      <div class="cover-subtitle">Enterprise Administration, Multi-Tenancy, Granular RBAC, PKI Certificates, EPEX Tariffs, Auto-Heal & Live Protocol Diagnostics</div>
    </div>

    <div>
      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Target Audience</div>
          <div class="cover-meta-value">System Administrators, Security Officers & Technical CPOs</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Security Compliance</div>
          <div class="cover-meta-value">OCPP 1.6 Security Profile 3 (mTLS) & ISO 15118</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Publication Date</div>
          <div class="cover-meta-value">August 2026</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Publisher</div>
          <div class="cover-meta-value">webdotpulse / Mobility Pulse Network</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div>GRID-OCPP-CPMS Enterprise Documentation</div>
      <div>Confidential & Proprietary</div>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-container">
    <div class="toc-title">Table of Contents</div>
    <ul class="toc-list">
      <li class="toc-item"><span class="toc-num">01.</span><span class="toc-text">Multi-Tenant Architecture & Corporate Hierarchy</span></li>
      <li class="toc-item"><span class="toc-num">02.</span><span class="toc-text">User Accounts, Corporate Clients & 5-Tier RBAC Matrix</span></li>
      <li class="toc-item"><span class="toc-num">03.</span><span class="toc-text">Security Profiles & PKI / TLS X.509 Certificates</span></li>
      <li class="toc-item"><span class="toc-num">04.</span><span class="toc-text">Enterprise Audit Trail & Compliance Logging</span></li>
      <li class="toc-item"><span class="toc-num">05.</span><span class="toc-text">Dynamic EPEX Spot Pricing & Market Integration</span></li>
      <li class="toc-item"><span class="toc-num">06.</span><span class="toc-text">SMTP Mail Server & HTML Mail Template Engine</span></li>
      <li class="toc-item"><span class="toc-num">07.</span><span class="toc-text">Screen Advertising Manager & Target Playlists</span></li>
      <li class="toc-item"><span class="toc-num">08.</span><span class="toc-text">Hardware-at-Risk Engine & Auto-Heal Recovery Rules</span></li>
      <li class="toc-item"><span class="toc-num">09.</span><span class="toc-text">Payment Gateways Configuration (Stripe & Mollie)</span></li>
      <li class="toc-item"><span class="toc-num">10.</span><span class="toc-text">Roaming Hubs: OCPI 2.2.1 & Hubject OICP Credentials</span></li>
      <li class="toc-item"><span class="toc-num">11.</span><span class="toc-text">Live OCPP Packet Inspector & WebSocket Frame Console</span></li>
      <li class="toc-item"><span class="toc-num">12.</span><span class="toc-text">Hardware Quirk Profiles & Config Profile Templates</span></li>
      <li class="toc-item"><span class="toc-num">13.</span><span class="toc-text">Scheduled Background Cron Jobs & Auto-Maintenance</span></li>
    </ul>
  </div>

  <!-- Content Sections -->
  <div class="section-block">
    <h1 class="section-h1">1. Multi-Tenant Architecture & Corporate Hierarchy</h1>
    <p>The CPMS architecture provides strict logical isolation between independent corporate clients, billing entities, and operational domains.</p>
    
    <div class="callout callout-info">
      <div class="callout-title">Multi-Tenancy Isolation Rule</div>
      All database queries for non-superadmin users are strictly scoped by <code>companyId</code> or <code>owner_id</code>. Corporate client administrators can never view or modify chargers assigned to other organizations.
    </div>

    ${renderGrid2(
      { file: '51a_Corporate_Clients_Directory.png', caption: 'Corporate B2B Clients Directory' },
      { file: '51_Users_Accounts_Directory.png', caption: 'User Accounts & Roles Directory' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">2. Role-Based Access Control (RBAC Matrix)</h1>
    <p>The platform provides a granular 5-tier role hierarchy governing permissions across 6 system modules:</p>
    
    <table>
      <thead>
        <tr><th>Module</th><th>Superadmin</th><th>Platform Admin</th><th>Operator/Tech</th><th>Client Admin</th><th>User/Driver</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Infrastructure & Stations</strong></td><td>Full CRUD</td><td>Full CRUD</td><td>View & Diagnostics</td><td>Assigned Only</td><td>Map View</td></tr>
        <tr><td><strong>Remote Controls</strong></td><td>Full Access</td><td>Full Access</td><td>Full Access</td><td>Restricted</td><td>Own Socket</td></tr>
        <tr><td><strong>Tariffs & Dynamic EPEX</strong></td><td>Full CRUD</td><td>Full CRUD</td><td>View Only</td><td>View Assigned</td><td>View Rates</td></tr>
        <tr><td><strong>Invoices & SEPA Direct Debit</strong></td><td>Full CRUD</td><td>Full CRUD</td><td>No Access</td><td>Own Invoices</td><td>Own Receipts</td></tr>
        <tr><td><strong>Roaming Hubs (OCPI/OICP)</strong></td><td>Full CRUD</td><td>Manage</td><td>View Only</td><td>No Access</td><td>No Access</td></tr>
        <tr><td><strong>PKI Security & Audit Trail</strong></td><td>Full CRUD</td><td>View Audit</td><td>No Access</td><td>No Access</td><td>No Access</td></tr>
      </tbody>
    </table>

    ${renderFigure('51b_Roles_Permissions_Matrix.png', 'Interactive Roles & Permissions Matrix Console')}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">3. Security Profiles & PKI / TLS Certificates</h1>
    <p>The CPMS enforces standards compliant with <strong>OCPP 1.6 Security Profile 3</strong> and <strong>ISO 15118 PKI</strong>:</p>
    <ul>
      <li><strong>Profile 1:</strong> Unencrypted HTTP / WS transport (restricted to private VPNs).</li>
      <li><strong>Profile 2:</strong> TLS / WSS transport with HTTP Basic Authentication.</li>
      <li><strong>Profile 3:</strong> Mutual TLS (mTLS) with bidirectional X.509 client and server certificates.</li>
      <li><strong>Certificate Authority Trust Store:</strong> Upload and inspect Root CAs, Sub-CAs, and revocation lists.</li>
    </ul>

    ${renderGrid2(
      { file: '63_Settings_Security_Profiles_PKI.png', caption: 'PKI Security Profiles & X.509 Management' },
      { file: '64_Settings_Enterprise_Audit_Trail.png', caption: 'Enterprise Audit Trail & Compliance Log' }
    )}

    <h2 class="section-h2">4. Enterprise Audit Trail & Compliance</h2>
    <p>Every administrative action, remote control RPC invocation, and tariff modification is recorded immutably in the audit trail with UTC timestamp, actor IP, user-agent, target resource, and outcome status.</p>
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">5. Dynamic EPEX Spot Pricing & Market Feeds</h1>
    <p>The <strong>Dynamic Tariffs Engine</strong> (<code>/settings/tariffs</code>) connects with wholesale Day-Ahead electricity markets to compute real-time hourly consumer tariffs:</p>
    
    <div class="callout callout-tip">
      <div class="callout-title">Spot Pricing Formula</div>
      <code>Tariff (€/kWh) = (Spot Price × Multiplier) + CPO Markup (€/kWh) + Grid Fee + VAT (21%)</code>
    </div>

    <ul>
      <li><strong>Supported Market Feeds:</strong> EnergyZero API, ENTSO-E Transparency Platform, and Energy-Charts API.</li>
      <li><strong>Automated Cron:</strong> Daily price ingestion fires at 13:15 CET for the subsequent 24-hour delivery period.</li>
    </ul>

    ${renderGrid2(
      { file: '65_Settings_DynamicTariffs_EPEX.png', caption: 'Dynamic EPEX Spot Tariffs Settings' },
      { file: '45_Tariffs_Pricing_Structures.png', caption: 'Tariffs Overview Matrix' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">6. SMTP Mail Server & HTML Template Engine</h1>
    
    <h2 class="section-h2">6.1 Outgoing SMTP Configuration (<code>/settings/mail</code>)</h2>
    <p>Configure transactional email delivery via Postmark, SendGrid, Amazon SES, or custom SMTP relays with TLS encryption and testing tools.</p>

    <h2 class="section-h2">6.2 HTML Mail Template Editor (<code>/settings/templates</code>)</h2>
    <p>Customize email templates with visual previews and dynamic variables: <code>{{user_name}}</code>, <code>{{invoice_number}}</code>, <code>{{total_amount}}</code>, <code>{{kwh_delivered}}</code>.</p>

    ${renderGrid2(
      { file: '67_Settings_SMTP_Server.png', caption: 'SMTP Outgoing Mail Server Configuration' },
      { file: '66_Settings_MailTemplates_Editor.png', caption: 'HTML Mail Template Visual Editor' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">7. Screen Advertising Manager & Media Campaigns</h1>
    <p>Distribute digital advertisement media campaigns to chargers equipped with color LCD screens:</p>
    <ul>
      <li>Supports MP4 (H.264 video), PNG, JPG, and dynamic HTML5 promo banners.</li>
      <li>Target campaigns by specific stations, charge groups, or geographic cities.</li>
      <li>Distribute assets via customized OCPP <code>DataTransfer</code> vendor RPCs.</li>
    </ul>

    ${renderFigure('68_Settings_Screen_AdManager.png', 'Screen Advertising Campaign Scheduler')}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">8. Hardware-at-Risk Engine & Auto-Heal Rules</h1>
    <p>The <strong>Hardware-at-Risk Subsystem</strong> (<code>/hardware-at-risk</code> & <code>/settings/hardware-at-risk</code>) continuously evaluates telemetry to resolve hardware failures automatically:</p>

    <div class="callout callout-warning">
      <div class="callout-title">Auto-Heal Protocol</div>
      If a charger misses heartbeats for >180 seconds or experiences a suspended EVSE lock, the engine automatically issues a remote soft reset before escalating an incident ticket to field technicians.
    </div>

    ${renderGrid2(
      { file: '54_HardwareAtRisk_AutoHeal.png', caption: 'Hardware-at-Risk Live Fleet Monitor' },
      { file: '69_Settings_HardwareAtRisk_Rules.png', caption: 'Auto-Heal Heuristic Rules Configuration' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">9. Payment Gateways & Roaming Connections</h1>
    
    <h2 class="section-h2">9.1 Stripe & Mollie Gateway Setup (<code>/settings/payments</code>)</h2>
    <p>Manage API credentials, test sandbox modes, and webhook signing secrets for instant public ad-hoc payment processing.</p>

    <h2 class="section-h2">9.2 Roaming Hubs (OCPI 2.2.1 & Hubject OICP)</h2>
    <p>Manage bilateral roaming credentials, exchange tokens, and track wholesale clearinghouse settlements.</p>

    ${renderGrid2(
      { file: '70_Settings_MolliePayments_Gateway.png', caption: 'Mollie & Stripe Payment Gateway Credentials' },
      { file: '50_Roaming_Settlement_Visualizer_Tab.png', caption: 'Roaming Settlement & Clearinghouse Visualizer' }
    )}
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">10. Live OCPP Packet Inspector & Quirk Profiles</h1>
    
    <h2 class="section-h2">10.1 Live Packet Inspector (<code>/ocpp</code>)</h2>
    <p>Stream real-time unbuffered WebSocket JSON-RPC frames (<code>CALL</code>, <code>CALLRESULT</code>, <code>CALLERROR</code>) with full syntax parsing and manual RPC dispatcher.</p>

    <h2 class="section-h2">10.2 Hardware Quirk Profiles (<code>/quirk-profiles</code>)</h2>
    <p>Non-intrusively repair vendor-specific OCPP firmware non-compliance (missing power derivation, integer multipliers, UID endianness).</p>

    ${renderGrid2(
      { file: '55_OCPP_PacketInspector_Console.png', caption: 'Live OCPP Packet Inspector & RPC Console' },
      { file: '59_QuirkProfiles_HardwareOverrides.png', caption: 'Hardware Quirk Profiles & Overrides' }
    )}
  </div>

</body>
</html>
  `;
}

// ----------------------------------------------------------------------------
// 3. INSTALLATION MANUAL HTML
// ----------------------------------------------------------------------------
function buildInstallationManualHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OCPP CPMS – Comprehensive Installation, Deployment & Infrastructure Manual</title>
  <style>${baseStyles}</style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div>
      <div class="cover-badge-row">
        <span class="cover-badge badge-emerald">DevOps & Deployment</span>
        <span class="cover-badge badge-cyan">Cloud & On-Premise</span>
        <span class="cover-badge badge-indigo">Release v2.4</span>
      </div>
      <h1 class="cover-title">OCPP Charge Point Management System</h1>
      <div class="cover-subtitle">Complete Installation, Production Cloud VM Deployment, PostgreSQL, Redis, Nginx WSS Proxy, PM2 & Hardware Setup Guide</div>
    </div>

    <div>
      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Target Audience</div>
          <div class="cover-meta-value">DevOps Engineers, Cloud Architects & System Administrators</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Supported Operating Systems</div>
          <div class="cover-meta-value">Ubuntu 24.04 / 22.04 LTS, Debian 12, GCP / AWS / Azure</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Publication Date</div>
          <div class="cover-meta-value">August 2026</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Publisher</div>
          <div class="cover-meta-value">webdotpulse / Mobility Pulse Network</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div>GRID-OCPP-CPMS Enterprise Documentation</div>
      <div>Confidential & Proprietary</div>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-container">
    <div class="toc-title">Table of Contents</div>
    <ul class="toc-list">
      <li class="toc-item"><span class="toc-num">01.</span><span class="toc-text">System Architecture & Infrastructure Sizing</span></li>
      <li class="toc-item"><span class="toc-num">02.</span><span class="toc-text">Prerequisites & System Dependencies</span></li>
      <li class="toc-item"><span class="toc-num">03.</span><span class="toc-text">Automated 1-Command Installer (install.sh)</span></li>
      <li class="toc-item"><span class="toc-num">04.</span><span class="toc-text">Interactive Browser-Based Setup Wizard</span></li>
      <li class="toc-item"><span class="toc-num">05.</span><span class="toc-text">Step-by-Step Local Development Setup</span></li>
      <li class="toc-item"><span class="toc-num">06.</span><span class="toc-text">Production Ubuntu 24.04 VM Provisioning</span></li>
      <li class="toc-item"><span class="toc-num">07.</span><span class="toc-text">PostgreSQL 15+ & Prisma Database Setup</span></li>
      <li class="toc-item"><span class="toc-num">08.</span><span class="toc-text">Redis 7+ Caching & BullMQ Worker Queues</span></li>
      <li class="toc-item"><span class="toc-num">09.</span><span class="toc-text">Nginx Reverse Proxy, TLS SSL & WSS Configuration</span></li>
      <li class="toc-item"><span class="toc-num">10.</span><span class="toc-text">PM2 Process Management & Systemd Automation</span></li>
      <li class="toc-item"><span class="toc-num">11.</span><span class="toc-text">Firewall (UFW) & Network Port Rules</span></li>
      <li class="toc-item"><span class="toc-num">12.</span><span class="toc-text">Environment Variables Reference (.env)</span></li>
      <li class="toc-item"><span class="toc-num">13.</span><span class="toc-text">Connecting Physical Chargers & Proxy Setup</span></li>
      <li class="toc-item"><span class="toc-num">14.</span><span class="toc-text">Health Checks, Monitoring & Troubleshooting</span></li>
    </ul>
  </div>

  <!-- Content Sections -->
  <div class="section-block">
    <h1 class="section-h1">1. System Architecture & Infrastructure Sizing</h1>
    <p>The <strong>OCPP-CPMS</strong> operates across a high-performance decoupled multi-tier architecture:</p>
    
    <table>
      <thead>
        <tr><th>Tier</th><th>Technology</th><th>Port</th><th>Role</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Reverse Proxy</strong></td><td>Nginx 1.24+ / Certbot</td><td>80 / 443</td><td>TLS termination, HTTP routing, WSS proxying</td></tr>
        <tr><td><strong>Frontend</strong></td><td>Next.js 16 (React 19)</td><td>3002</td><td>Admin Dashboard & Mobile Companion UI</td></tr>
        <tr><td><strong>Backend API</strong></td><td>Express 5 + TypeScript</td><td>3000</td><td>REST Endpoints, Auth, Roaming, Invoicing</td></tr>
        <tr><td><strong>OCPP Engine</strong></td><td>Node.js <code>ws</code> (RFC 6455)</td><td>9220</td><td>Native OCPP 1.6-J & 2.1 WebSocket Server</td></tr>
        <tr><td><strong>Database</strong></td><td>PostgreSQL 15+ / Prisma</td><td>5432</td><td>Relational transactional storage & telemetry</td></tr>
        <tr><td><strong>Cache & Queue</strong></td><td>Redis 7+ / BullMQ</td><td>6379</td><td>Telemetry cache, pub/sub, background workers</td></tr>
      </tbody>
    </table>

    <h2 class="section-h2">Hardware Sizing Recommendations</h2>
    <table>
      <thead>
        <tr><th>Fleet Size</th><th>vCPU</th><th>RAM</th><th>Storage</th><th>Cloud VM Example</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>1 - 100 Chargers</strong></td><td>2 vCPU</td><td>8 GB</td><td>50 GB NVMe</td><td>GCP <code>e2-standard-2</code> / AWS <code>t3.large</code></td></tr>
        <tr><td><strong>100 - 1,000 Chargers</strong></td><td>4 vCPU</td><td>16 GB</td><td>200 GB NVMe</td><td>GCP <code>e2-standard-4</code> / AWS <code>c6i.xlarge</code></td></tr>
        <tr><td><strong>1,000 - 10,000 Chargers</strong></td><td>8+ vCPU</td><td>32+ GB</td><td>500+ GB NVMe</td><td>GCP <code>c2-standard-8</code> / AWS <code>c6i.2xlarge</code></td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">2. Automated 1-Command Installer & Setup Wizard</h1>
    
    <h2 class="section-h2">2.1 Automated One-Command Installer (<code>install.sh</code>)</h2>
    <p>Deploy the complete stack on Ubuntu 24.04 LTS with a single shell invocation:</p>

    <pre><code>sudo bash install.sh \\
  --frontend-domain "ui.yourdomain.com" \\
  --backend-domain "ocpp.yourdomain.com" \\
  -y</code></pre>

    <div class="callout callout-tip">
      <div class="callout-title">Automated Tasks Executed</div>
      Installs Node.js 24, PostgreSQL, Redis, Nginx, Certbot, PM2; provisions database and schema; builds frontend; configures Nginx virtual hosts with WSS proxying; requests Let's Encrypt SSL; and registers systemd auto-start daemons.
    </div>

    <h2 class="section-h2">2.2 Interactive Browser Setup Wizard (<code>interactive-setup.html</code>)</h2>
    <p>Open <code>interactive-setup.html</code> in any browser to configure domains, SMTP, database credentials, and Stripe/Mollie keys visually, then generate a custom deployment script.</p>
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">3. Step-by-Step Manual Deployment Guide</h1>
    
    <h2 class="section-h2">3.1 PostgreSQL Database Provisioning</h2>
    <pre><code>sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql && sudo systemctl start postgresql

sudo -u postgres psql <<EOF
CREATE DATABASE ocpp_cpms;
CREATE USER cpms_user WITH ENCRYPTED PASSWORD 'YourStrongDatabasePassword123!';
GRANT ALL PRIVILEGES ON DATABASE ocpp_cpms TO cpms_user;
ALTER DATABASE ocpp_cpms OWNER TO cpms_user;
\\c ocpp_cpms
GRANT ALL ON SCHEMA public TO cpms_user;
EOF</code></pre>

    <h2 class="section-h2">3.2 Redis Cache Installation</h2>
    <pre><code>sudo apt install -y redis-server
sudo systemctl enable redis-server && sudo systemctl start redis-server
redis-cli ping # Should return: PONG</code></pre>

    <h2 class="section-h2">3.3 Backend API & Prisma Setup</h2>
    <pre><code>cd /var/www/ocpp-cpms/Backend
npm install --production=false
cp .env.example .env
# Edit .env to set DATABASE_URL, REDIS_URL, and JWT_SECRET
npx prisma generate
npx prisma db push --accept-data-loss
npm run create-superadmin -- "admin@mobilitypulse.com" "SuperAdminPass2026!"
npx tsc</code></pre>

    <h2 class="section-h2">3.4 Frontend Next.js Production Build</h2>
    <pre><code>cd /var/www/ocpp-cpms/Frontend
npm install
cat <<EOT > .env.local
NEXT_PUBLIC_API_URL="https://ocpp.yourdomain.com/api"
EOT
npm run build</code></pre>
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">4. Nginx Reverse Proxy & WSS Configuration</h1>
    <p>Deploy the following virtual host configuration to <code>/etc/nginx/sites-available/ocpp-cpms</code>:</p>

    <pre><code># 1. Frontend Next.js Admin Dashboard
server {
    server_name ui.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Backend REST API & OCPP WSS Server
server {
    server_name ocpp.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # OCPP 1.6 and 2.1 WebSocket Server
    location ~ ^/OCPP/(1\\.6|2\\.1|2\\.0\\.1)/ {
        proxy_pass http://127.0.0.1:9220;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}</code></pre>

    <p>Enable the site and request automated TLS certificates:</p>
    <pre><code>sudo ln -s /etc/nginx/sites-available/ocpp-cpms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ui.yourdomain.com -d ocpp.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com</code></pre>
  </div>

  <div class="section-block page-break">
    <h1 class="section-h1">5. PM2 Daemon Management & Connecting Chargers</h1>
    
    <h2 class="section-h2">5.1 PM2 Process Ecosystem</h2>
    <pre><code>cd /var/www/ocpp-cpms
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd</code></pre>

    <h2 class="section-h2">5.2 Connecting Physical Chargers</h2>
    <p>Configure hardware firmware parameters on your EVSE chargers:</p>
    <ul>
      <li><strong>OCPP 1.6-J WebSocket URL:</strong> <code>wss://ocpp.yourdomain.com/OCPP/1.6/&lt;chargerId&gt;</code></li>
      <li><strong>OCPP 2.0.1 / 2.1 WebSocket URL:</strong> <code>wss://ocpp.yourdomain.com/OCPP/2.1/&lt;chargerId&gt;</code></li>
      <li><strong>Heartbeat Interval:</strong> <code>60</code> seconds.</li>
      <li><strong>Meter Value Interval:</strong> <code>30</code> seconds.</li>
    </ul>

    ${renderGrid2(
      { file: '08_Chargers_Register_New.png', caption: 'Register Charger in Central System' },
      { file: '58_ConfigProfiles_Templates.png', caption: 'Push Standard Configuration Template' }
    )}
  </div>

</body>
</html>
  `;
}

// ----------------------------------------------------------------------------
// MAIN PDF COMPILER
// ----------------------------------------------------------------------------
async function generateAllPdfs() {
  console.log('🚀 Starting PDF Compilation with Playwright Chromium...');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb']
  });

  const manuals = [
    {
      name: 'User & Operator Manual',
      html: buildUserManualHtml(),
      outputPath: path.join(MANUAL_DIR, 'OCPP_CPMS_User_Manual.pdf'),
      headerTitle: 'OCPP CPMS – Comprehensive User & Operator Manual',
      docCategory: 'Operator Guide'
    },
    {
      name: 'System Admin Manual',
      html: buildAdminManualHtml(),
      outputPath: path.join(MANUAL_DIR, 'OCPP_CPMS_Admin_Manual.pdf'),
      headerTitle: 'OCPP CPMS – System Administration & Enterprise Management Manual',
      docCategory: 'System Admin Guide'
    },
    {
      name: 'Installation & Deployment Manual',
      html: buildInstallationManualHtml(),
      outputPath: path.join(MANUAL_DIR, 'OCPP_CPMS_Installation_Manual.pdf'),
      headerTitle: 'OCPP CPMS – Installation, Deployment & Infrastructure Manual',
      docCategory: 'DevOps & Deployment'
    }
  ];

  for (const item of manuals) {
    console.log(`\n📄 Rendering "${item.name}"...`);
    const page = await browser.newPage();

    await page.setContent(item.html, { waitUntil: 'networkidle' });

    await page.pdf({
      path: item.outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '18mm',
        bottom: '18mm',
        left: '14mm',
        right: '14mm'
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm; border-bottom: 1px solid #e2e8f0; margin-bottom: 8mm;">
          <span style="font-weight: 600; color: #64748b;">${item.headerTitle}</span>
          <span style="text-transform: uppercase; letter-spacing: 0.05em; color: #0284c7;">${item.docCategory}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm; border-top: 1px solid #e2e8f0; margin-top: 8mm;">
          <span>Mobility Pulse Network © 2026</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `
    });

    const stats = fs.statSync(item.outputPath);
    console.log(`✅ Generated: ${item.outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    await page.close();
  }

  await browser.close();
  console.log('\n🎉 All 3 PDF Manuals generated successfully in /Manual!');
}

generateAllPdfs().catch(err => {
  console.error('❌ PDF Generation Failed:', err);
  process.exit(1);
});
