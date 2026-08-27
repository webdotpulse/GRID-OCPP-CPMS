import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');
const FRONTEND_SCREENSHOTS_DIR = path.resolve(__dirname, '../Screenshots');

// Ensure directories exist
for (const dir of [ROOT_SCREENSHOTS_DIR, FRONTEND_SCREENSHOTS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const mockUser = {
  id: 1,
  email: 'admin@webdotpulse.eu',
  name: 'Super Administrator',
  role: 'superadmin',
  userType: 'company',
  companyName: 'Pulse Charge Network B.V.',
  address: 'Keizersgracht 421, 1016 EK Amsterdam',
  phone: '+31 20 894 3200',
  taxNumber: 'NL861234567B01',
  createdAt: '2024-01-15T08:00:00.000Z',
  twoFactorEnabled: true,
  twoFactorMethod: 'authenticator',
};

async function setupApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const parsed = new URL(url);
    const pathName = parsed.pathname;

    const json = (data, status = 200) => {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data })
      });
    };

    if (pathName.includes('/auth/me')) return json(mockUser);
    if (pathName.includes('/settings/payments/stripe')) {
      return json({
        id: 1,
        hasSecretKey: true,
        publishableKey: "pk_live_51M0cpms82810283492817263548",
        hasWebhookSecret: true,
        testMode: false
      });
    }
    if (pathName.includes('/settings/payments/mollie')) {
      return json({
        id: 1,
        hasApiKey: true,
        profileId: "pfl_99281a",
        testMode: false
      });
    }
    if (pathName.includes('/settings/payments')) {
      return json({
        isConfigured: true,
        apiKey: "live_mollie_live_998182747192",
        profileId: "pfl_99281a"
      });
    }

    return json({});
  });
}

async function injectAuth(page) {
  await page.addInitScript((userData) => {
    window.localStorage.setItem('token', 'mock-jwt-superadmin-token-2026');
    window.localStorage.setItem('user', JSON.stringify(userData));
  }, mockUser);
}

async function run() {
  console.log('--- Capturing Screenshot 70 (Payments Settings with Stripe & Mollie) ---');

  const frontendDir = path.resolve(__dirname, '..');
  const nextBin = path.resolve(frontendDir, 'node_modules/.bin/next');

  // Check if server is already running on port 3002
  let serverRunning = false;
  try {
    const checkRes = await fetch('http://localhost:3002/login');
    if (checkRes.status === 200 || checkRes.status === 307 || checkRes.status === 308) {
      serverRunning = true;
      console.log('✓ Found running server on port 3002');
    }
  } catch (e) {}

  let serverProcess = null;
  if (!serverRunning) {
    console.log('[Server] Spawning Next.js dev server on port 3002...');
    serverProcess = spawn(nextBin, ['dev', '-p', '3002', '--turbopack'], {
      cwd: frontendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(`[Next.js] ${d}`));
    serverProcess.stderr.on('data', (d) => process.stderr.write(`[Next.js ERR] ${d}`));

    // Poll until server is ready
    let serverReady = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch('http://localhost:3002/login');
        if (res.status === 200 || res.status === 307 || res.status === 308) {
          serverReady = true;
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 500));
    }

    if (!serverReady) {
      console.error('Server failed to start on port 3002');
      if (serverProcess) serverProcess.kill('SIGTERM');
      process.exit(1);
    }
    console.log('✓ Next.js dev server ready on http://localhost:3002\n');
  }

  const cleanup = () => {
    if (serverProcess) {
      try { serverProcess.kill('SIGTERM'); } catch (e) {}
    }
  };

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });

    const page = await context.newPage();
    await setupApiMocks(page);
    await injectAuth(page);

    console.log('Navigating to /settings/payments...');
    await page.goto('http://localhost:3002/settings/payments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const rootDest = path.join(ROOT_SCREENSHOTS_DIR, '70_Settings_MolliePayments_Gateway.png');
    const frontendDest = path.join(FRONTEND_SCREENSHOTS_DIR, '70_Settings_MolliePayments_Gateway.png');

    await page.screenshot({ path: rootDest, fullPage: true });
    if (fs.existsSync(FRONTEND_SCREENSHOTS_DIR)) {
      fs.copyFileSync(rootDest, frontendDest);
    }

    console.log(`✓ [SAVED] ${rootDest}`);

    await context.close();
    await browser.close();
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    cleanup();
  }
}

run();
