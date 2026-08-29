import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');
const FRONTEND_SCREENSHOTS_DIR = path.resolve(__dirname, '../Screenshots');

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
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-0043",
    customerName: "Green Mobility Logistics N.V.",
    customerEmail: "accounts@greenmobility.be",
    companyName: "Green Mobility Logistics N.V.",
    status: "issued",
    issueDate: "2026-08-15",
    dueDate: "2026-08-29",
    subtotal: 840.00,
    tax: 176.40,
    total: 1016.40,
    totalAmount: 1016.40,
    currency: "EUR",
    chargingSessionsCount: 31,
    kwhTotal: 2250.0,
    items: [
      { id: 3, invoiceId: 2, description: "August 2026 Commercial Fleet Sessions (2,250 kWh)", quantity: 2250.0, unitPrice: 0.36, vatRate: 21, vatAmount: 170.10, amount: 810.00, total: 810.00, createdAt: "2026-08-15", updatedAt: "2026-08-15" }
    ]
  }
];

const mockMandates = [
  { id: 1, debtorName: "Pulse Fleet Services B.V.", customerName: "Pulse Fleet Services B.V.", iban: "NL91ABNA0417164300", bic: "ABNANL2A", mandateReference: "MAND-2024-0019", scheme: "CORE", status: "Active", signedDate: "2024-01-15" },
  { id: 2, debtorName: "Green Mobility Logistics N.V.", customerName: "Green Mobility Logistics N.V.", iban: "BE68539007547034", bic: "GEBABEBB", mandateReference: "MAND-2024-0024", scheme: "B2B", status: "Active", signedDate: "2024-03-20" }
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
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
          stats: { totalSubtotal: 2080.50, totalVat: 436.91, totalAmount: 2517.41, paidAmount: 1501.01, pendingAmount: 1016.40, count: 2 }
        }
      })
    });
    if (pathName.includes('/mandates') || pathName.includes('/sepa/mandates')) return json(mockMandates);

    return json({ message: "OK" });
  });
}

async function takeShot(page, filename) {
  const rootPath = path.join(SCREENSHOTS_DIR, filename);
  const frontendPath = path.join(FRONTEND_SCREENSHOTS_DIR, filename);
  await page.waitForTimeout(600);
  await page.screenshot({ path: rootPath, fullPage: true });
  fs.copyFileSync(rootPath, frontendPath);
  console.log(`[SAVED INVOICE VIEW] ${filename}`);
}

async function run() {
  console.log('🚀 Capturing Invoices & Billing suite...');
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

  await page.goto('http://localhost:3002/invoices', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 39. Invoices Billing Ledger
  await takeShot(page, '39_Invoices_Billing_Ledger.png');

  // 40. Invoices Detail Modal
  const viewBtn = page.locator('button[title="View Details"], button:has-text("View Details"), button:has-text("Bekijk"), table tbody tr button').first();
  if (await viewBtn.isVisible({ timeout: 3000 })) {
    await viewBtn.click();
    await page.waitForTimeout(1000);
    await takeShot(page, '40_Invoices_Detail_Modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 41. Generate Invoices Dialog
  const genBtn = page.locator('button:has-text("Generate Monthly Invoices"), button:has-text("Generate Invoices"), button:has-text("Facturen Genereren"), button:has-text("Genereren")').first();
  if (await genBtn.isVisible({ timeout: 3000 })) {
    await genBtn.click();
    await page.waitForTimeout(1000);
    await takeShot(page, '41_Invoices_Generate_Dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 42. SEPA Mandates Dialog
  const mandateBtn = page.locator('button:has-text("SEPA Mandates"), button:has-text("SEPA Mandaten"), button:has-text("Mandaten")').first();
  if (await mandateBtn.isVisible({ timeout: 3000 })) {
    await mandateBtn.click();
    await page.waitForTimeout(1000);
    await takeShot(page, '42_Invoices_SEPA_Mandates_Dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 43. SEPA Direct Debit Dialog
  const sepaDebitBtn = page.locator('button:has-text("SEPA Direct Debit"), button:has-text("SEPA Incasso"), button:has-text("Incasso Export")').first();
  if (await sepaDebitBtn.isVisible({ timeout: 3000 })) {
    await sepaDebitBtn.click();
    await page.waitForTimeout(1000);
    await takeShot(page, '43_Invoices_DirectDebit_Export_Dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await browser.close();
  console.log('🎉 Invoices screenshots complete!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
