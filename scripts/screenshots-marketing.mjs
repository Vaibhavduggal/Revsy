import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'screenshots', 'marketing');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.SITE_URL || 'http://localhost:4173';

async function capture(page, url, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', name, viewport);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  const desktop = { width: 1440, height: 900 };
  const mobile = { width: 390, height: 844 };

  {
    const page = await ctx.newPage();
    await capture(page, `${BASE}/`, 'revsy-landing-desktop.png', desktop);
    await capture(page, `${BASE}/`, 'revsy-landing-mobile.png', mobile);
    await page.close();
  }

  {
    const page = await ctx.newPage();
    await capture(page, 'https://spade.com/', 'spade-desktop.png', desktop);
    await capture(page, 'https://spade.com/', 'spade-mobile.png', mobile);
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
