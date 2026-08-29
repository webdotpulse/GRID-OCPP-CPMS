import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');
const FRONTEND_SCREENSHOTS_DIR = path.resolve(__dirname, '../Screenshots');

// Unified mock data
const mockUser = {
  id: 1,
  email: 'superadmin@mobilitypulse.com',
  name: 'Super Administrator',
  role: 'superadmin',
  userType: 'company',
  companyName: 'Pulse Charge Network B.V.',
  companyId: 1,
};

const mockChargers = [
  {
    id: 1,
    charger_id: "CP-AMS-01",
    name: "Alfen Eve Double Pro - Bay 1",
    vendor: "Alfen ICU B.V.",
    manufacturer: "Alfen ICU B.V.",
    model: "Eve Double Pro-line",
    serial_number: "ALF-2024-99812",
    firmware_version: "5.18.2-4112",
    protocol: "ocpp1.6",
    power_capacity: 44,
    maxPowerKw: 44,
    status: "charging",
    isOnline: true,
    last_heartbeat: new Date().toISOString(),
    service_contacts: "support@alfen.com / +31 36 549 3400",
    charging_station_id: 1,
    chargingStation: { id: 1, station_name: "Amsterdam Central Charging Hub" },
    stationId: 1,
    station: { id: 1, name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    quirkProfileId: 1,
    isPredictiveBalancingEnabled: true,
    localSolarKwp: 25.0,
    connectors: [
      { id: 1, connectorId: 1, connector_id: 1, connector_name: "Bay 1 - CCS2 (22kW)", type: "CCS2", status: "Charging", maxPowerKw: 22, currentPowerKw: 21.4 },
      { id: 2, connectorId: 2, connector_id: 2, connector_name: "Bay 1 - Type 2 (22kW)", type: "Type2", status: "Available", maxPowerKw: 22, currentPowerKw: 0 }
    ],
    evses: []
  }
];

const mockInvoicesList = [
  {
    id: 1,
    invoiceNumber: "INV-2026-0042",
    customerName: "Pulse Fleet Services B.V.",
    customerEmail: "billing@pulsefleet.eu",
    companyName: "Pulse Fleet Services B.V.",
    status: "paid",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    subtotal: 1240.50,
    tax: 260.51,
    total: 1501.01,
    currency: "EUR",
    chargingSessionsCount: 48,
    kwhTotal: 3340.2,
    items: [
      { description: "August 2026 High-Power Charging Energy (3,340.2 kWh)", quantity: 3340.2, unitPrice: 0.35, total: 1169.07 },
      { description: "Monthly Corporate EVSE Fleet Connection Fee", quantity: 1, unitPrice: 71.43, total: 71.43 }
    ]
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-0043",
    customerName: "Green Mobility Logistics N.V.",
    customerEmail: "accounts@greenmobility.be",
    companyName: "Green Mobility Logistics N.V.",
    status: "pending",
    issueDate: "2026-08-15",
    dueDate: "2026-08-29",
    subtotal: 840.00,
    tax: 176.40,
    total: 1016.40,
    currency: "EUR",
    chargingSessionsCount: 31,
    kwhTotal: 2250.0,
    items: [
      { description: "August 2026 Commercial Fleet Sessions (2,250 kWh)", quantity: 2250.0, unitPrice: 0.36, total: 810.00 }
    ]
  }
];

const mockUsers = [
  {
    id: 1,
    name: "Super Administrator",
    email: "superadmin@mobilitypulse.com",
    role: "superadmin",
    userType: "company",
    companyName: "Pulse Charge Network B.V.",
    companyId: 1,
    company: { id: 1, name: "Pulse Charge Network B.V.", clientNumber: "CLI-1000" },
    status: "Active",
    createdAt: "2024-01-15T08:00:00Z",
    emailVerified: true,
    twoFactorEnabled: true,
  },
  {
    id: 2,
    name: "Dr. Willem Janssen",
    email: "w.janssen@leaseplan.nl",
    role: "client_admin",
    userType: "company",
    companyName: "LeasePlan Corporate Fleet",
    companyId: 2,
    company: { id: 2, name: "LeasePlan Corporate Fleet", clientNumber: "CLI-1001" },
    status: "Active",
    createdAt: "2024-03-01T10:30:00Z",
    emailVerified: true,
    twoFactorEnabled: true,
  }
];

const mockCompanies = [
  {
    id: 1,
    name: "Pulse Charge Network B.V.",
    clientNumber: "CLI-1000",
    vatNumber: "NL861234567B01",
    chamberOfCommerce: "78912345",
    contactName: "Super Administrator",
    contactEmail: "admin@webdotpulse.eu",
    contactPhone: "+31 20 894 3200",
    city: "Amsterdam",
    status: "Active",
    _count: { users: 12, chargingStations: 6, invoices: 24 },
    users: mockUsers.filter(u => u.companyId === 1)
  },
  {
    id: 2,
    name: "LeasePlan Corporate Fleet",
    clientNumber: "CLI-1001",
    vatNumber: "NL001928374B01",
    chamberOfCommerce: "33182941",
    contactName: "Dr. Willem Janssen",
    contactEmail: "w.janssen@leaseplan.nl",
    contactPhone: "+31 20 555 0192",
    city: "Almere",
    status: "Active",
    _count: { users: 48, chargingStations: 14, invoices: 88 },
    users: mockUsers.filter(u => u.companyId === 2)
  }
];

const mockRoles = {
  roles: [
    { role: "superadmin", name: "Super Administrator", badgeColor: "#8b5cf6", level: 100, scope: "Global Platform", description: "Full unrestricted access across all client organizations, hardware endpoints, roaming partners, audit logs, and system settings.", isSystem: true },
    { role: "admin", name: "Platform / CPO Administrator", badgeColor: "#e2626b", level: 80, scope: "Organization / CPO", description: "Manages charging networks, site locations, dynamic tariffs, billing & SEPA, client accounts, and user permissions.", isSystem: true },
    { role: "operator", name: "Operations & Field Technician", badgeColor: "#3f78e0", level: 60, scope: "Hardware & Network", description: "Responsible for charger reliability, live monitoring, diagnostics, firmware deployment, and remote controls.", isSystem: false },
    { role: "client_admin", name: "Corporate Client / Fleet Manager", badgeColor: "#45c4a0", level: 40, scope: "Corporate Client / Tenant", description: "Administers corporate fleet drivers, employee RFID cards, assigned stations/chargers, and monthly company invoices.", isSystem: false },
    { role: "user", name: "EV Driver / Standard User", badgeColor: "#54a8c7", level: 20, scope: "Individual Account", description: "Standard EV driver initiating charging sessions, managing personal RFID cards, vehicle battery profiles, and receipts.", isSystem: false }
  ],
  capabilities: [
    { key: "chargers.view", name: "View Chargers & Status", category: "Infrastructure", description: "Browse connected chargers, EVSE connector states, and real-time telemetry", allowedRoles: ["superadmin", "admin", "operator", "client_admin", "user"] },
    { key: "chargers.control", name: "Remote Charger Commands", category: "Infrastructure", description: "Execute Remote Start/Stop, Reset (Soft/Hard), Unlock Connector, and Change Availability", allowedRoles: ["superadmin", "admin", "operator", "client_admin"] },
    { key: "chargers.edit", name: "Configure Hardware & Profiles", category: "Infrastructure", description: "Create or modify charger parameters, OCPP configuration keys, and quirk overrides", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "stations.manage", name: "Manage Site Locations & Ground Plans", category: "Infrastructure", description: "Create charging stations, configure max site power limits, and design 2D ground plans", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "chargegroups.manage", name: "Dynamic Load Balancing Groups", category: "Infrastructure", description: "Define dynamic phase-balancing clusters, current allocations, and fail-safe power limits", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "v2g.manage", name: "V2G & Grid Discharge Orchestration", category: "Energy & Smart Grid", description: "Configure dynamic vehicle-to-grid limits, peak shaving schedules, and minimum SoC reserves", allowedRoles: ["superadmin", "admin"] },
    { key: "tariffs.manage", name: "Dynamic Tariffs & EPEX Pricing", category: "Energy & Smart Grid", description: "Manage fixed pricing templates and dynamic EPEX day-ahead wholesale electricity formulas", allowedRoles: ["superadmin", "admin"] },
    { key: "rfid.manage", name: "RFID Whitelist & Cards", category: "Fleet & Access", description: "Enroll, assign, block, and whitelist RFID driver tags with real-time sync", allowedRoles: ["superadmin", "admin", "operator", "client_admin"] },
    { key: "invoices.view", name: "View Invoices & Billing Ledger", category: "Invoices & Finance", description: "Access aggregated monthly invoices, line-item transactions, and tax summaries", allowedRoles: ["superadmin", "admin", "client_admin"] },
    { key: "invoices.export", name: "SEPA Direct Debit & Export", category: "Invoices & Finance", description: "Generate ISO 20022 SEPA Direct Debit XML batches (pain.008) and manage mandates", allowedRoles: ["superadmin", "admin"] },
    { key: "users.manage", name: "User Account Administration", category: "Administration", description: "Create and edit platform logins, change passwords, and manage email verification", allowedRoles: ["superadmin", "admin"] },
    { key: "clients.manage", name: "Corporate Client Management", category: "Administration", description: "Create and administer B2B corporate client accounts, billing entities, and assigned fleets", allowedRoles: ["superadmin", "admin"] },
    { key: "roles.assign", name: "Role & Permission Assignment", category: "Administration", description: "Assign and modify system access roles and organizational scoping", allowedRoles: ["superadmin", "admin"] },
    { key: "audit.view", name: "Enterprise Audit Trail", category: "Administration", description: "Inspect tamper-evident immutable security logs for all platform state mutations", allowedRoles: ["superadmin"] }
  ]
};

async function setupApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;

    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    const rawJson = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

    if (pathName.includes('/auth/me')) return json(mockUser);
    if (pathName.includes('/roles')) return json(mockRoles);
    if (pathName.includes('/companies')) return json({ companies: mockCompanies, total: mockCompanies.length });
    if (pathName.includes('/users')) return json(mockUsers);
    if (pathName.includes('/invoices/1')) return json(mockInvoicesList[0]);
    if (pathName.includes('/invoices')) return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          invoices: mockInvoicesList,
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
          stats: { totalSubtotal: 2080.50, totalVat: 436.91, totalAmount: 2517.41, paidAmount: 1501.01, pendingAmount: 1016.40, count: 2 }
        }
      })
    });
    if (pathName.includes('/mandates') || pathName.includes('/sepa/mandates')) return json([
      { id: 1, debtorName: "Pulse Fleet Services B.V.", customerName: "Pulse Fleet Services B.V.", iban: "NL91ABNA0417164300", bic: "ABNANL2A", mandateReference: "MAND-2024-0019", scheme: "CORE", status: "Active", signedDate: "2024-01-15" }
    ]);
    if (pathName.match(/\/chargers\/\d+\/configurations/)) return json([
      { key: "HeartbeatInterval", value: "60", readonly: false },
      { key: "MeterValueSampleInterval", value: "30", readonly: false }
    ]);
    if (pathName.match(/\/chargers\/\d+/)) return json(mockChargers[0]);
    if (pathName.includes('/config-profiles')) return json([
      { id: 1, name: "Alfen Eve Standard 1.6-J Baseline", description: "Standard parameters for Eve Double Pro", vendor: "Alfen", protocol: "ocpp1.6", items: [{ key: "HeartbeatInterval", value: "60" }] }
    ]);

    return json({ message: "OK" });
  });
}

async function takeShot(page, filename) {
  const rootPath = path.join(SCREENSHOTS_DIR, filename);
  const frontendPath = path.join(FRONTEND_SCREENSHOTS_DIR, filename);
  await page.waitForTimeout(500);
  await page.screenshot({ path: rootPath, fullPage: true });
  fs.copyFileSync(rootPath, frontendPath);
  console.log(`[SAVED SUBVIEW] ${filename}`);
}

async function run() {
  console.log('🚀 Capturing remaining tabs & dialog subviews...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript((userData) => {
    window.localStorage.setItem('token', 'mock-jwt-superadmin-token-2026');
    window.localStorage.setItem('user', JSON.stringify(userData));
  }, mockUser);

  await setupApiMocks(page);

  // 1. Charger Tabs: Profiles
  console.log('--- Charger Tabs ---');
  await page.goto('http://localhost:3002/chargers/1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const profilesTab = page.locator('button[value="profiles"]').first();
  if (await profilesTab.isVisible()) {
    await profilesTab.click();
    await page.waitForTimeout(600);
    await takeShot(page, '14_Charger_Detail_Profiles_Tab.png');
  }

  // 2. Invoices Modals & Dialogs
  console.log('--- Invoices Dialogs ---');
  await page.goto('http://localhost:3002/invoices', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Detail Modal
  const viewBtn = page.locator('button:has-text("View Details"), table tbody tr button').first();
  if (await viewBtn.isVisible()) {
    await viewBtn.click();
    await page.waitForTimeout(800);
    await takeShot(page, '40_Invoices_Detail_Modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Generate Invoices Dialog
  const genBtn = page.locator('button:has-text("Generate Monthly Invoices"), button:has-text("Generate Invoices")').first();
  if (await genBtn.isVisible()) {
    await genBtn.click();
    await page.waitForTimeout(800);
    await takeShot(page, '41_Invoices_Generate_Dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // SEPA Mandates Dialog
  const mandateBtn = page.locator('button:has-text("SEPA Mandates")').first();
  if (await mandateBtn.isVisible()) {
    await mandateBtn.click();
    await page.waitForTimeout(800);
    await takeShot(page, '42_Invoices_SEPA_Mandates_Dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // SEPA Direct Debit Dialog
  const sepaDebitBtn = page.locator('button:has-text("SEPA Direct Debit (pain.008)"), button:has-text("SEPA Direct Debit")').first();
  if (await sepaDebitBtn.isVisible()) {
    await sepaDebitBtn.click();
    await page.waitForTimeout(800);
    await takeShot(page, '43_Invoices_DirectDebit_Export_Dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 3. Users Tabs: Clients & Roles Matrix
  console.log('--- Users Tabs ---');
  await page.goto('http://localhost:3002/users', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const clientsTab = page.locator('button[value="clients"], button:has-text("Clients & Accounts"), button:has-text("Clients")').first();
  if (await clientsTab.isVisible({ timeout: 3000 })) {
    await clientsTab.click();
    await page.waitForTimeout(800);
    await takeShot(page, '51a_Corporate_Clients_Directory.png');
  } else {
    console.log('[WARN] clientsTab not found');
  }

  const rolesTab = page.locator('button[value="roles"], button:has-text("Roles & Permissions"), button:has-text("Roles")').first();
  if (await rolesTab.isVisible({ timeout: 3000 })) {
    await rolesTab.click();
    await page.waitForTimeout(800);
    await takeShot(page, '51b_Roles_Permissions_Matrix.png');
  } else {
    console.log('[WARN] rolesTab not found');
  }

  await browser.close();
  console.log('🎉 Subviews captured successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
