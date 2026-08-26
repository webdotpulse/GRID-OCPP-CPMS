import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');

async function captureTabs() {
  console.log('[Auth] Logging in...');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const user = loginJson.data.user;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

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

  await page.goto('http://localhost:3002/chargers/1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Connectors
  await page.locator('[value="connectors"], button:has-text("Connectors")').first().click();
  await takeScreenshot('08_Charger_Detail_Connectors_Tab.png', 1000);

  // Transactions
  await page.locator('[value="transactions"], button:has-text("Transactions")').first().click();
  await takeScreenshot('09_Charger_Detail_Transactions_Tab.png', 1000);

  // Configuration
  await page.locator('[value="configuration"], button:has-text("Configuration")').first().click();
  await takeScreenshot('10_Charger_Detail_Configuration_Tab.png', 1000);

  // Local Auth
  await page.locator('[value="local-auth"], button:has-text("Local Auth")').first().click();
  await takeScreenshot('11_Charger_Detail_LocalAuthList_Tab.png', 1000);

  // Ground Plan 2D Canvas Editor
  await page.goto('http://localhost:3002/stations/1', { waitUntil: 'domcontentloaded' });
  const groundPlanBtn = page.locator('button:has-text("Ground Plan"), a:has-text("Ground Plan")').first();
  if (await groundPlanBtn.isVisible()) {
    await groundPlanBtn.click();
    await takeScreenshot('11b_Station_GroundPlan_Canvas_Builder.png', 1500);
  }

  await desktopContext.close();
  await browser.close();
  console.log('Tabs captured successfully.');
}

captureTabs().catch((err) => {
  console.error(err);
  process.exit(1);
});
