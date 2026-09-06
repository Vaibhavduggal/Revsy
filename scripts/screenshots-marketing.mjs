import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots', 'marketing');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.SITE_URL || 'http://localhost:4173';

async function capture(page, name, viewport, { fullPage = true, waitMs = 0 } = {}) {
  await page.setViewportSize(viewport);
  if (waitMs) await page.waitForTimeout(waitMs);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage });
  console.log('saved', name, viewport);
}

async function verifyLoopReveals(page) {
  const beats = ['ask', 'sort', 'learn'];
  const results = {};

  for (const id of beats) {
    const el = page.locator(`[data-loop-beat="${id}"]`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const revealed = await el.getAttribute('data-revealed');
    results[id] = revealed === 'true';
    console.log(`loop beat ${id}: data-revealed=${revealed}`);
  }

  const allRevealed = beats.every((id) => results[id]);
  if (!allRevealed) {
    throw new Error(`Loop scroll reveals failed: ${JSON.stringify(results)}`);
  }
  console.log('loop scroll reveals: OK');
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  const desktop = { width: 1440, height: 900 };
  const mobile = { width: 390, height: 844 };

  {
    const page = await ctx.newPage();

    // Desktop — hero mid-animation (~3 words in)
    await page.setViewportSize(desktop);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(180);
    await capture(page, 'revsy-hero-mid-animation-desktop.png', desktop, { fullPage: false, waitMs: 0 });

    // Desktop — fully loaded
    await page.waitForTimeout(2500);
    await capture(page, 'revsy-landing-desktop.png', desktop);

    // Scroll-triggered loop reveals
    await verifyLoopReveals(page);

    await page.close();
  }

  {
    const page = await ctx.newPage();

    await page.setViewportSize(mobile);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(180);
    await capture(page, 'revsy-hero-mid-animation-mobile.png', mobile, { fullPage: false, waitMs: 0 });

    await page.waitForTimeout(2500);
    await capture(page, 'revsy-landing-mobile.png', mobile);

    await verifyLoopReveals(page);

    await page.close();
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
  preview.stdout.on('data', (d) => {
    const t = d.toString();
    if (t.includes('Local:') || t.includes('4173')) ready = true;
  });
  preview.stderr.on('data', (d) => {
    const t = d.toString();
    if (t.includes('Local:') || t.includes('4173')) ready = true;
  });
  const waitReady = async () => {
    for (let i = 0; i < 40; i++) {
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await new Promise((r) => setTimeout(r, 1500));
  };
  waitReady()
    .then(main)
    .then(() => preview.kill())
    .catch((e) => { console.error(e); preview.kill(); process.exit(1); });
}
