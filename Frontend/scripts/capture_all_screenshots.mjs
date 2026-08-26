import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function capture() {
  console.log('====================================================');
  console.log(' Starting Automated Full Platform Screenshot Suite ');
  console.log('====================================================');

  // 1. Authenticate against Backend API
  console.log('[Auth] Authenticating as Superadmin (admin@example.com)...');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const user = loginJson.data.user;

  // 2. Fetch active charger and station IDs
  const cRes = await fetch('http://localhost:3000/api/chargers', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cJson = await cRes.json();
  const chargerId = cJson.data?.[0]?.charger_id || 67;

  const sRes = await fetch('http://localhost:3000/api/stations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sJson = await sRes.json();
  const stationId = sJson.data?.[0]?.id || 100;

  console.log(`[Config] Target Charger ID: ${chargerId}, Target Station ID: ${stationId}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // --- Desktop Context (1920x1080) ---
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5,
  });

  await desktopContext.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });

  const page = await desktopContext.newPage();

  const takeScreenshot = async (filename, waitTime = 1200) => {
    await page.waitForTimeout(waitTime);
    const dest = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`[SAVED] ${filename}`);
  };

  // 1. Auth Screens
  console.log('\n--- Capturing Auth Screens ---');
  await page.goto('http://localhost:3002/login', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('01_Auth_Login.png');

  await page.goto('http://localhost:3002/register', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('02_Auth_Register.png');

  await page.goto('http://localhost:3002/forgot-password', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('03_Auth_ForgotPassword.png');

  await page.goto('http://localhost:3002/verify-email', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('04_Auth_VerifyEmail.png');

  // 2. Dashboard Overview
  console.log('\n--- Capturing Dashboard ---');
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('05_Dashboard_Executive_Overview.png', 2000);

  // 3. Chargers Fleet & Detail Tabs
  console.log('\n--- Capturing Chargers ---');
  await page.goto('http://localhost:3002/chargers', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('06_Chargers_Fleet_Directory.png', 1500);

  await page.goto(`http://localhost:3002/chargers/${chargerId}`, { waitUntil: 'domcontentloaded' });
  await takeScreenshot('07_Charger_Detail_Overview_Tab.png', 1500);

  // Connectors Tab
  const connectorsTab = page.locator('[data-value="connectors"], [value="connectors"], button:has-text("Connectors")').first();
  if (await connectorsTab.isVisible()) {
    await connectorsTab.click();
    await takeScreenshot('08_Charger_Detail_Connectors_Tab.png', 1200);
  }

  // Transactions Tab
  const txTab = page.locator('[data-value="transactions"], [value="transactions"], button:has-text("Transactions")').first();
  if (await txTab.isVisible()) {
    await txTab.click();
    await takeScreenshot('09_Charger_Detail_Transactions_Tab.png', 1200);
  }

  // Configuration Tab
  const configTab = page.locator('[data-value="configuration"], [value="configuration"], button:has-text("Configuration")').first();
  if (await configTab.isVisible()) {
    await configTab.click();
    await takeScreenshot('10_Charger_Detail_Configuration_Tab.png', 1200);
  }

  // Local Auth List Tab (Roadmap Phase 1)
  const localListTab = page.locator('[data-value="local-auth"], [value="local-auth"], button:has-text("Local Auth")').first();
  if (await localListTab.isVisible()) {
    await localListTab.click();
    await takeScreenshot('11_Charger_Detail_LocalAuthList_Tab.png', 1200);
  }

  // 4. Stations & Ground Plans
  console.log('\n--- Capturing Stations & Ground Plans ---');
  await page.goto('http://localhost:3002/stations', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('12_Stations_Directory_Map.png', 1800);

  await page.goto(`http://localhost:3002/stations/${stationId}`, { waitUntil: 'domcontentloaded' });
  await takeScreenshot('13_Station_Detail_View.png', 1500);

  // 5. Smart Charging & Load Balancing
  console.log('\n--- Capturing Smart Charging ---');
  await page.goto('http://localhost:3002/charge-groups', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('14_ChargeGroups_DynamicLoadBalancing.png', 1500);

  await page.goto('http://localhost:3002/v2g', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('15_V2G_Battery_Orchestration.png', 1500);

  // 6. Access & Identity
  console.log('\n--- Capturing Access & Identity ---');
  await page.goto('http://localhost:3002/rfid', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('16_RFID_Whitelist_Directory.png', 1500);

  await page.goto('http://localhost:3002/vehicle-identity-management', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('17_VehicleIdentity_PlugAndCharge.png', 1500);

  // 7. Reservations Engine (Roadmap Phase 2)
  console.log('\n--- Capturing Reservations Engine ---');
  await page.goto('http://localhost:3002/reservations', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('18_Reservations_Manager.png', 1500);

  // 8. Transactions, Tariffs & Reimbursements
  console.log('\n--- Capturing Transactions & Tariffs ---');
  await page.goto('http://localhost:3002/transactions', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('19_Transactions_History_Records.png', 1500);

  await page.goto('http://localhost:3002/tariffs', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('20_Tariffs_Pricing_Structures.png', 1500);

  await page.goto('http://localhost:3002/reimbursements', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('21_Reimbursements_HomeCharging_SEPA.png', 1500);

  await page.goto('http://localhost:3002/roaming', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('22_Roaming_OCPI_Hubs.png', 1500);

  // 9. Tools & Diagnostics
  console.log('\n--- Capturing Tools & Diagnostics ---');
  await page.goto('http://localhost:3002/hardware-at-risk', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('23_HardwareAtRisk_AutoHeal.png', 1500);

  await page.goto('http://localhost:3002/ocpp', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('24_OCPP_PacketInspector_Console.png', 1500);

  await page.goto('http://localhost:3002/config-profiles', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('25_ConfigProfiles_Templates.png', 1500);

  await page.goto('http://localhost:3002/quirk-profiles', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('26_QuirkProfiles_HardwareOverrides.png', 1500);

  await page.goto('http://localhost:3002/media-campaigns', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('27_MediaCampaigns_AdScheduler.png', 1500);

  await page.goto('http://localhost:3002/users', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('28_Users_Accounts_Directory.png', 1500);

  // 10. Settings Suite
  console.log('\n--- Capturing Settings Suite ---');
  await page.goto('http://localhost:3002/settings', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('29_Settings_Main_Hub.png', 1500);

  // Security Profiles & PKI (Roadmap Phase 4)
  await page.goto('http://localhost:3002/settings/security', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('30_Settings_Security_Profiles_PKI.png', 1500);

  // Enterprise Audit Trail (Roadmap Phase 3)
  await page.goto('http://localhost:3002/settings/audit', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('31_Settings_Enterprise_Audit_Trail.png', 1500);

  await page.goto('http://localhost:3002/settings/dynamic-tariffs', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('32_Settings_DynamicTariffs_EPEX.png', 1500);

  await page.goto('http://localhost:3002/settings/mail', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('33_Settings_MailTemplates_Editor.png', 1500);

  await page.goto('http://localhost:3002/settings/smtp', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('34_Settings_SMTP_Server.png', 1500);

  await page.goto('http://localhost:3002/settings/media', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('35_Settings_Screen_AdManager.png', 1500);

  await page.goto('http://localhost:3002/settings/hardware-risk', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('36_Settings_HardwareAtRisk_Rules.png', 1500);

  await page.goto('http://localhost:3002/settings/payments', { waitUntil: 'domcontentloaded' });
  await takeScreenshot('37_Settings_MolliePayments_Gateway.png', 1500);

  await desktopContext.close();

  // --- Mobile Driver View (390x844) ---
  console.log('\n--- Capturing Mobile Driver Companion ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  await mobileContext.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });

  const mobilePage = await mobileContext.newPage();

  const takeMobileScreenshot = async (filename, waitTime = 1200) => {
    await mobilePage.waitForTimeout(waitTime);
    const dest = path.join(SCREENSHOTS_DIR, filename);
    await mobilePage.screenshot({ path: dest, fullPage: false });
    console.log(`[SAVED MOBILE] ${filename}`);
  };

  await mobilePage.goto('http://localhost:3002/mobile/dashboard', { waitUntil: 'domcontentloaded' });
  await takeMobileScreenshot('38_Mobile_Dashboard.png', 1500);

  await mobilePage.goto('http://localhost:3002/mobile/chargers', { waitUntil: 'domcontentloaded' });
  await takeMobileScreenshot('39_Mobile_Chargers_Fleet.png', 1500);

  await mobilePage.goto(`http://localhost:3002/mobile/chargers/${chargerId}`, { waitUntil: 'domcontentloaded' });
  await takeMobileScreenshot('40_Mobile_Charger_Detail_Controller.png', 1500);

  await mobilePage.goto('http://localhost:3002/mobile/map', { waitUntil: 'domcontentloaded' });
  await takeMobileScreenshot('41_Mobile_Station_Map.png', 2000);

  await mobilePage.goto('http://localhost:3002/mobile/settings', { waitUntil: 'domcontentloaded' });
  await takeMobileScreenshot('42_Mobile_Driver_Settings.png', 1500);

  await mobileContext.close();
  await browser.close();

  console.log('\n====================================================');
  console.log(' All Fresh Platform Screenshots Captured Successfully! ');
  console.log('====================================================');
}

capture().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
