import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const BASE = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '');

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  const text = await page.evaluate(() => (document.getElementById('root')?.innerText || '').slice(0, 800));
  console.log(`--- ${name} ---`);
  console.log('url:', page.url());
  console.log('text:', JSON.stringify(text));
  return text;
}

const browser = await chromium.launch();

{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await login(page, 'setup@burngym.com', 'demo123');
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="category-step"]');
  await page.click('[data-testid="category-gym"]');
  await page.fill('[data-testid="onboarding-address"]', 'Plot No. B-19/186, 3rd-4th Floor, Rani Jhansi Road, Ghumar Mandi, Ludhiana, Punjab 141001');
  await page.fill('[data-testid="onboarding-phone"]', '+91 99887 77999');
  await page.waitForTimeout(400);
  await shot(page, 'shot-onboarding-category.png');
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await login(page, 'owner@burngym.com', 'demo123');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await shot(page, 'shot-gym-dashboard.png');
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="suggestions-section"]');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  await shot(page, 'shot-gym-suggestions-complaints.png');
  await ctx.close();
}

await browser.close();
console.log('done ->', OUT);
