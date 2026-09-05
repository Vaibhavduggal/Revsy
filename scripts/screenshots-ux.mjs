import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots', 'ux');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.SITE_URL || 'http://127.0.0.1:4173';
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

async function shot(page, url, name, viewport, setup) {
  await page.setViewportSize(viewport);
  if (setup) await setup(page);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1800);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', name);
}

async function mockOnboarding(page) {
  await page.addInitScript(() => localStorage.setItem('reviewbot_token', 'preview_token'));
  await page.route('**/api/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      businessId: 'biz_preview',
      businessName: 'Preview Kitchen',
      isDemo: false,
      category: 'restaurant',
      categorySet: false,
      onboardingCompleted: false,
    }),
  }));
  await page.route('**/api/onboarding/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      name: 'Preview Kitchen',
      categorySet: false,
      onboardingCompleted: false,
      googleConnected: false,
      whatsappConnected: false,
      approvalStatus: 'pending_approval',
      needsLocation: false,
    }),
  }));
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/`, 'landing-desktop.png', desktop);
    await shot(page, `${BASE}/`, 'landing-mobile.png', mobile);
    await page.close();
  }

  {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/login`, 'login-desktop.png', desktop);
    await shot(page, `${BASE}/login`, 'login-mobile.png', mobile);
    await page.close();
  }

  {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/onboarding`, 'onboarding-desktop.png', desktop, mockOnboarding);
    await page.close();
  }
  {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/onboarding`, 'onboarding-mobile.png', mobile, mockOnboarding);
    await page.close();
  }

  const apiBase = process.env.API_URL || BASE;
  try {
    const res = await fetch(`${apiBase}/api/login/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (data.token) {
      const page = await ctx.newPage();
      await page.addInitScript((t) => localStorage.setItem('reviewbot_token', t), data.token);
      await shot(page, `${BASE}/dashboard`, 'dashboard-desktop.png', desktop);
      await page.close();
      const pageM = await ctx.newPage();
      await pageM.addInitScript((t) => localStorage.setItem('reviewbot_token', t), data.token);
      await shot(pageM, `${BASE}/dashboard`, 'dashboard-mobile.png', mobile);
      await pageM.close();
    } else {
      console.log('skip dashboard shots: no demo token', data);
    }
  } catch (e) {
    console.log('skip dashboard shots:', e.message);
  }

  await browser.close();
  console.log('done ->', OUT);
}

if (process.env.SKIP_PREVIEW) {
  main().catch((e) => { console.error(e); process.exit(1); });
} else {
  const preview = spawn('npm', ['run', 'preview', '--workspace=client', '--', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: path.join(__dir, '..'),
    shell: true,
    stdio: 'pipe',
  });
  let ready = false;
  const onData = (d) => {
    const t = d.toString();
    process.stdout.write(t);
    if (t.includes('Local:') || t.includes('4173')) ready = true;
  };
  preview.stdout.on('data', onData);
  preview.stderr.on('data', onData);
  const waitReady = async () => {
    for (let i = 0; i < 40; i++) {
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await new Promise((r) => setTimeout(r, 1200));
  };
  waitReady()
    .then(main)
    .then(() => { preview.kill(); })
    .catch((e) => { console.error(e); preview.kill(); process.exit(1); });
}
