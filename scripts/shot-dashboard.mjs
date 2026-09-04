import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.SITE_URL || 'https://revsy-three.vercel.app';

async function fetchJson(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts);
      return await r.json();
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2000)); }
  }
  throw last;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const data = await fetchJson(`${BASE}/api/login/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
console.log('demo token prefix:', (data.token || '').slice(0, 8));
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url().slice(0, 120)));
await page.addInitScript((t) => localStorage.setItem('reviewbot_token', t), data.token);
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'shot-dashboard.png'), fullPage: true });
console.log('url:', page.url());
console.log('rootText[300]:', JSON.stringify((await page.evaluate(() => (document.getElementById('root')?.innerText || '').slice(0, 300)))));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
console.log('done');
