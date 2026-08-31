import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACTS_DIR = '/home/koen/.gemini/antigravity-ide/brain/bd9c0b73-9d93-4008-86ef-f5e464354ec2';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');

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
    charger_id: 1,
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
    connectors: [
      { id: 1, connectorId: 1, connector_id: 1, connector_name: "Bay 1 - CCS2 (22kW)", type: "CCS2", status: "Charging", maxPowerKw: 22 },
      { id: 2, connectorId: 2, connector_id: 2, connector_name: "Bay 1 - Type 2 (22kW)", type: "Type2", status: "Available", maxPowerKw: 22 }
    ]
  }
];

const mockRfid = [
  { rfid_user_id: 1, rfid_tag: "046BA312126680", name: "Paul Aelbrecht" }
];

const mockRoles = {
  roles: [
    { role: "superadmin", name: "Super Administrator", badgeColor: "#8b5cf6", level: 100, scope: "Global Platform", description: "Full unrestricted access.", isSystem: true, userCount: 1, capabilities: ["chargers.view", "chargers.control"] },
    { role: "admin", name: "Platform Admin", badgeColor: "#e2626b", level: 80, scope: "Organization", description: "Manages network.", isSystem: true, userCount: 3, capabilities: ["chargers.view"] },
  ],
  capabilities: [
    { key: "invoices.view", name: "Invoicing & Billing Engine", category: "Invoicing & Billing", description: "Generate monthly PDF invoices, calculate VAT rates, and manage payment statuses." },
    { key: "invoices.export", name: "SEPA ISO 20022 Direct Debit XML", category: "Invoicing & Billing", description: "Generate and download banking XML batch transfer files (pain.008 / pain.001)." },
    { key: "reimbursements.manage", name: "Home Reimbursement Split-Billing", category: "Invoicing & Billing", description: "Calculate employee home charging compensation and employer reimbursement ledgers." },
    { key: "ocpp.raw_stream", name: "OCPP Raw Live Message Stream", category: "Operations & Logs", description: "Inspect low-level WebSocket frames (Call, CallResult, CallError) and diagnostics." },
    { key: "chargers.auto_heal", name: "Hardware Reliability & Auto-Heal", category: "Operations & Logs", description: "Inspect hardware risk flags, fault counters, and automated reboot workflows." },
    { key: "firmware.manage", name: "Over-The-Air Firmware Upgrades", category: "Operations & Logs", description: "Push signed firmware update packages to physical charge points." },
    { key: "roaming.manage", name: "Roaming Hubs (OCPI & OICP)", category: "Operations & Logs", description: "Manage eMSP/CPO roaming tokens, Hubject OICP credentials, and CDR sync." },
    { key: "users.manage", name: "User Account Administration", category: "Administration & Integrations", description: "Create, update, deactivate, reset passwords, and manage individual user accounts." },
    { key: "companies.manage", name: "Client & Corporate Organization Management", category: "Administration & Integrations", description: "Create and administer B2B corporate client accounts, billing entities, and assigned fleets." },
    { key: "roles.manage", name: "Custom Roles & PBAC Policy Management", category: "Administration & Integrations", description: "Create, edit, and configure custom role policies and site-scoped access permissions." },
    { key: "audit.view", name: "Enterprise Audit Trail Explorer", category: "Administration & Integrations", description: "Inspect tamper-evident immutable security logs for all platform state mutations." },
    { key: "webhooks.manage", name: "Outbound Webhook Subscriptions", category: "Administration & Integrations", description: "Configure outbound event streams, HMAC secrets, test pings, and delivery retry traces." }
  ]
};

const mockWebhookEvents = [
  { topic: "transaction.started", name: "Charging Session Started", category: "Charging", description: "Fired when EV plugs in.", samplePayload: { event: "transaction.started" } },
  { topic: "transaction.stopped", name: "Charging Session Completed", category: "Charging", description: "Fired when EV stops charging.", samplePayload: { event: "transaction.stopped" } },
  { topic: "charger.booted", name: "Charger Boot Notification", category: "Hardware", description: "Fired on BootNotification.", samplePayload: { event: "charger.booted" } },
  { topic: "connector.status_changed", name: "EVSE Connector Status Changed", category: "Hardware", description: "Fired on StatusNotification.", samplePayload: { event: "connector.status_changed" } },
  { topic: "connector.faulted", name: "Connector Hardware Fault", category: "Alerts", description: "Fired on hardware fault.", samplePayload: { event: "connector.faulted" } },
  { topic: "tariff.updated", name: "Tariff Rates Updated", category: "Tariffs", description: "Fired on tariff update.", samplePayload: { event: "tariff.updated" } },
  { topic: "invoice.issued", name: "Monthly Billing Invoice Issued", category: "Billing", description: "Fired when invoice issued.", samplePayload: { event: "invoice.issued" } },
  { topic: "hardware.risk_alert", name: "Hardware at Risk Alert", category: "Alerts", description: "Fired on auto-heal risk.", samplePayload: { event: "hardware.risk_alert" } }
];

async function setupMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

    if (pathName.includes('/auth/me')) return json(mockUser);
    if (pathName.includes('/chargers')) return json(mockChargers);
    if (pathName.includes('/rfid')) return json(mockRfid);
    if (pathName.includes('/roles')) return json(mockRoles);
    if (pathName.includes('/webhooks/events')) return json(mockWebhookEvents);
    if (pathName.includes('/webhooks')) return json([]);
    if (pathName.includes('/firmware')) return json([]);
    if (pathName.includes('/scheduled-charging')) return json([]);
    if (pathName.includes('/invoices')) return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          invoices: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          stats: { totalSubtotal: 0, totalVat: 0, totalAmount: 0, count: 0 }
        }
      })
    });
    if (pathName.includes('/products')) return json([]);
    if (pathName.includes('/audit')) return json({
      logs: [
        { id: 1, action: "USER_LOGIN", target: "User", targetId: 1, ip: "192.168.1.100", createdAt: new Date().toISOString(), payload: { method: "2FA_TOTP" }, user: { name: "Super Administrator", email: "superadmin@mobilitypulse.com" } }
      ],
      total: 1
    });
    if (pathName.includes('/quirk-profiles')) return json([]);
    if (pathName.includes('/reservations')) return json([]);
    if (pathName.includes('/config-profiles')) return json([]);
    if (pathName.includes('/vehicles')) return json([]);
    if (pathName.includes('/stations')) return json([]);
    if (pathName.includes('/users')) return json([]);

    return json({ message: "OK" });
  });
}

async function captureModal(page, url, triggerSelector, filename) {
  console.log(`📸 Capturing modal for ${url}...`);
  try {
    await page.goto(`http://localhost:3002${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    const btn = page.locator(triggerSelector).first();
    await btn.waitFor({ state: 'visible', timeout: 15000 });
    await btn.click();
    await page.waitForTimeout(1000);

    const artifactPath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: artifactPath, fullPage: false });

    if (fs.existsSync(SCREENSHOTS_DIR)) {
      fs.copyFileSync(artifactPath, path.join(SCREENSHOTS_DIR, filename));
    }

    console.log(`✅ Saved: ${filename}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  } catch (err) {
    console.error(`❌ Error on ${url}:`, err.message);
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  await page.addInitScript((userData) => {
    window.localStorage.setItem('token', 'mock-jwt-token');
    window.localStorage.setItem('user', JSON.stringify(userData));
  }, mockUser);

  await setupMocks(page);

  // 1. Firmware Modal
  await captureModal(page, '/settings/firmware', 'button:has-text("Upload Firmware Binary")', 'proof_modal_firmware.png');

  // 2. Webhooks Modal
  await captureModal(page, '/settings/webhooks', 'button:has-text("Register Webhook")', 'proof_modal_webhooks.png');

  // 3. Roles Modal
  await captureModal(page, '/settings/roles', 'button:has-text("Create Custom Role")', 'proof_modal_roles.png');

  // 4. Scheduled Charging Modal
  await captureModal(page, '/scheduled-charging', 'button:has-text("New Schedule"), button:has-text("Create Schedule")', 'proof_modal_scheduled_charging.png');

  // 5. Invoices - Generate Invoices Modal
  await captureModal(page, '/invoices', 'button:has-text("Generate Invoices"), button:has-text("Generate Monthly Invoices")', 'proof_modal_invoices_generate.png');

  // 6. Invoices - SEPA Direct Debit XML Export Modal
  await captureModal(page, '/invoices', 'button:has-text("SEPA Direct Debit")', 'proof_modal_invoices_sepa.png');

  // 7. Audit Clear Logs Modal
  await captureModal(page, '/settings/audit', 'button:has-text("Clear Audit Logs"), button:has-text("Clear Logs")', 'proof_modal_audit_clear.png');

  // 8. Quirk Profiles Modal
  await captureModal(page, '/quirk-profiles', 'button:has-text("New Quirk Profile"), button:has-text("Create First Profile")', 'proof_modal_quirk_profiles.png');

  // 9. Reservations Modal
  await captureModal(page, '/reservations', 'button:has-text("New Reservation")', 'proof_modal_reservations.png');

  // 10. Products Modal
  await captureModal(page, '/settings/products', 'button:has-text("New Subscription Product"), button:has-text("New Product")', 'proof_modal_products.png');

  await browser.close();
  console.log('🎉 All modal verification screenshots captured successfully!');
}

run().catch(err => {
  console.error('ERROR in verification script:', err);
  process.exit(1);
});
