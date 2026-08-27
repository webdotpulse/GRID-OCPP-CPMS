import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('/home/koen/Git/OCPP-CPMS/Screenshots');
const FRONTEND_SCREENSHOTS_DIR = path.resolve('/home/koen/Git/OCPP-CPMS/Frontend/Screenshots');

const mockUser = {
  id: 1,
  email: 'superadmin@mobilitypulse.com',
  name: 'Super Administrator',
  role: 'superadmin',
  userType: 'company',
  companyName: 'Pulse Charge Network B.V.',
  companyId: 1,
};

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
    totalAmount: 1501.01,
    currency: "EUR",
    chargingSessionsCount: 48,
    kwhTotal: 3340.2,
    items: [
      { id: 1, invoiceId: 1, description: "August 2026 High-Power Charging Energy (3,340.2 kWh)", quantity: 3340.2, unitPrice: 0.35, vatRate: 21, vatAmount: 245.50, amount: 1169.07, total: 1169.07, createdAt: "2026-08-01", updatedAt: "2026-08-01" },
      { id: 2, invoiceId: 1, description: "Monthly Corporate EVSE Fleet Connection Fee", quantity: 1, unitPrice: 71.43, vatRate: 21, vatAmount: 15.01, amount: 71.43, total: 71.43, createdAt: "2026-08-01", updatedAt: "2026-08-01" }
    ]
  }
];

const mockMandates = [
  { id: 1, debtorName: "Pulse Fleet Services B.V.", customerName: "Pulse Fleet Services B.V.", iban: "NL91ABNA0417164300", bic: "ABNANL2A", mandateReference: "MAND-2024-0019", scheme: "CORE", status: "Active", signedDate: "2024-01-15" }
];

async function setupApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;

    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

    if (pathName.includes('/auth/me')) return json(mockUser);
    if (pathName.match(/\/invoices\/\d+/)) return json(mockInvoicesList[0]);
    if (pathName.includes('/invoices')) return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          invoices: mockInvoicesList,
          data: mockInvoicesList,
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          stats: { totalSubtotal: 1240.50, totalVat: 260.51, totalAmount: 1501.01, paidAmount: 1501.01, pendingAmount: 0, count: 1 }
        }
      })
    });
    if (pathName.includes('/mandates') || pathName.includes('/sepa/mandates')) return json(mockMandates);

    return json({ message: "OK" });
  });
}

async function saveShot(page, filename) {
  const rootPath = path.join(SCREENSHOTS_DIR, filename);
  const frontendPath = path.join(FRONTEND_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: rootPath, fullPage: true });
  fs.copyFileSync(rootPath, frontendPath);
  console.log(`[SAVED DIALOG] ${filename}`);
}

async function run() {
  console.log('🚀 Capturing Dialogs...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.addInitScript((userData) => {
    window.localStorage.setItem('token', 'mock-jwt-token');
    window.localStorage.setItem('user', JSON.stringify(userData));
  }, mockUser);

  await setupApiMocks(page);

  // 1. Generate Dialog
  await page.goto('http://localhost:3002/invoices', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1:has-text("Invoicing & Billing"), h1:has-text("Facturatie & Betaling")', { timeout: 10000 });
  await page.waitForTimeout(1000);
  
  await page.locator('button:has-text("Generate Invoices"), button:has-text("Facturen Genereren")').first().click();
  await page.waitForTimeout(1000);
  await saveShot(page, '41_Invoices_Generate_Dialog.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 2. SEPA Mandates Dialog
  await page.locator('button:has-text("SEPA Mandates"), button:has-text("SEPA Mandaten")').first().click();
  await page.waitForTimeout(1000);
  await saveShot(page, '42_Invoices_SEPA_Mandates_Dialog.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 3. SEPA Direct Debit Dialog
  await page.locator('button:has-text("SEPA Direct Debit"), button:has-text("SEPA Incasso")').first().click();
  await page.waitForTimeout(1000);
  await saveShot(page, '43_Invoices_DirectDebit_Export_Dialog.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 4. Invoices Detail Modal
  const rowBtn = page.locator('table tbody tr td:last-child button, button:has-text("View Details"), button:has-text("Details"), button[title="View Details"]').first();
  if (await rowBtn.isVisible()) {
    await rowBtn.click();
    await page.waitForTimeout(1000);
    await saveShot(page, '40_Invoices_Detail_Modal.png');
  }

  await browser.close();
  console.log('🎉 Successfully saved all 4 invoice dialog modals!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
