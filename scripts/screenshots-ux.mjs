import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots', 'ux');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.SITE_URL || 'http://127.0.0.1:4173';
const API_BASE = process.env.API_URL || BASE;

const viewports = {
  mobile: { width: 375, height: 812, label: '375' },
  tablet: { width: 768, height: 1024, label: '768' },
  desktop: { width: 1280, height: 900, label: '1280' },
};

async function checkPageHealth(page, label) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const buttons = [...document.querySelectorAll('button, a.btn, .mkt-btn, .touch-target')];
    const small = buttons.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40);
    });
    return {
      overflow: doc.scrollWidth > doc.clientWidth + 2,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      smallTargets: small.length,
    };
  });
  if (metrics.overflow) {
    throw new Error(`${label}: horizontal overflow (${metrics.scrollWidth}px > ${metrics.clientWidth}px)`);
  }
  console.log(`${label}: OK (small tap targets: ${metrics.smallTargets})`);
  return metrics;
}

async function shot(page, url, name, viewport, setup) {
  await page.setViewportSize(viewport);
  if (setup) await setup(page);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await checkPageHealth(page, name);
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
      messageTemplates: {},
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

  for (const [key, vp] of Object.entries(viewports)) {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/`, `landing-${vp.label}.png`, vp);
    await page.close();
  }

  for (const [key, vp] of Object.entries(viewports)) {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/login`, `login-${vp.label}.png`, vp);
    await page.close();
  }

  for (const [key, vp] of Object.entries(viewports)) {
    const page = await ctx.newPage();
    await shot(page, `${BASE}/onboarding`, `onboarding-${vp.label}.png`, vp, mockOnboarding);
    await page.close();
  }

  try {
    const res = await fetch(`${API_BASE}/api/login/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (data.token) {
      for (const [key, vp] of Object.entries(viewports)) {
        const page = await ctx.newPage();
        await page.addInitScript((t) => localStorage.setItem('reviewbot_token', t), data.token);
        await shot(page, `${BASE}/dashboard`, `dashboard-${vp.label}.png`, vp);
        if (vp.label === '375') {
          await page.click('button:has-text("Add")').catch(() => {});
          await page.waitForTimeout(500);
          await checkPageHealth(page, 'dashboard-add-customer-375');
          await page.screenshot({ path: path.join(OUT, 'dashboard-add-customer-375.png'), fullPage: true });
          console.log('saved dashboard-add-customer-375.png');
        }
        await page.close();
      }
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
