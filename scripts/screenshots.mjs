import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.SITE_URL || 'https://revsy-three.vercel.app';

async function shot(page, url, name, { setup } = {}) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url().slice(0, 120)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => errors.push('goto: ' + e.message.slice(0, 150)));
  if (setup) await setup(page).catch((e) => errors.push('setup: ' + e.message.slice(0, 150)));
  await page.waitForTimeout(2500);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  const title = await page.title().catch(() => '?');
  const rootText = await page.evaluate(() => (document.getElementById('root')?.innerText || '').slice(0, 300)).catch(() => '?');
  console.log(`--- ${name} ---`);
  console.log('url:', page.url());
  console.log('title:', title);
  console.log('rootText[300]:', JSON.stringify(rootText));
  console.log('errors:', errors.length ? errors : 'none');
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });

// 1. landing
{
  const page = await ctx.newPage();
  await shot(page, `${BASE}/?v shot-landing`, 'shot-landing.png');
  await page.close();
}
// 2. login
{
  const page = await ctx.newPage();
  await shot(page, `${BASE}/login`, 'shot-login.png');
  await page.close();
}
// 3. admin login
{
  const page = await ctx.newPage();
  await shot(page, `${BASE}/admin/login`, 'shot-admin-login.png');
  await page.close();
}
// 4. dashboard as demo (token via API, then fresh page with localStorage set)
{
  const res = await fetch(`${BASE}/api/login/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  console.log('demo token prefix:', (data.token || '').slice(0, 8));
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem('reviewbot_token', t), data.token);
  await shot(page, `${BASE}/dashboard`, 'shot-dashboard.png');
  await page.close();
}

await browser.close();
console.log('done ->', OUT);
