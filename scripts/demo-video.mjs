import { chromium } from 'playwright';

const BASE = 'https://revsy-three.vercel.app';
const PAUSE = (ms) => new Promise((r) => setTimeout(r, ms));

async function focus(page, selector, hold = 1400) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: 'visible', timeout: 8000 });
    await el.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
    await PAUSE(hold);
  } catch {
    // optional section
  }
}

async function scrollBy(page, y, hold = 700) {
  await page.evaluate((amount) => window.scrollBy({ top: amount, behavior: 'instant' }), y);
  await PAUSE(hold);
}

async function nav(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await PAUSE(700);
}

async function waitDashboard(page) {
  await page.waitForSelector('[aria-busy="true"]', { state: 'detached', timeout: 20000 }).catch(() => {});
  await PAUSE(600);
  // Fix collapsed chart width on production until card.jsx deploy lands
  await page.evaluate(() => {
    document.querySelectorAll('[data-slot="card-content"]').forEach((el) => {
      el.style.width = '100%';
      el.style.minWidth = '0';
    });
    document.querySelectorAll('[data-slot="chart"]').forEach((el) => {
      el.style.width = '100%';
    });
    window.dispatchEvent(new Event('resize'));
  });
  await PAUSE(800);
}

async function login(page) {
  await nav(page, '/login');
  await page.fill('input[type="email"]', 'owner@burngym.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30000 });
  await PAUSE(600);
}

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--window-position=0,0',
      '--start-maximized',
      '--window-size=1920,1200',
      '--disable-infobars',
      '--no-first-run',
    ],
  });

  const page = await (await browser.newContext({ viewport: null })).newPage();

  try {
    console.log('Login');
    await login(page);
    if (page.url().includes('onboarding')) await nav(page, '/dashboard');

    console.log('Dashboard + chart');
    await nav(page, '/dashboard');
    await waitDashboard(page);
    await focus(page, '.stat-grid', 1000);
    await focus(page, 'text=Positive vs negative', 1800);
    await focus(page, '.recharts-surface', 2000);

    console.log('AI insights + reviews');
    await focus(page, '.ai-insights', 1600);
    await focus(page, 'h3:has-text("Negative reviews")', 1400);
    const markRead = page.locator('button').filter({ hasText: /^Mark read$|^Read$/ }).first();
    if (await markRead.isVisible()) {
      await markRead.click();
      await PAUSE(700);
    }
    await focus(page, '[data-testid="complaints-section"]', 1200);

    console.log('Analytics');
    await nav(page, '/analytics');
    await focus(page, 'h1:has-text("Review Analytics")', 800);
    await focus(page, 'h3:has-text("Positive vs Negative")', 1600);
    await focus(page, 'h3:has-text("Positive rate over time")', 1600);
    await scrollBy(page, 480);
    await focus(page, 'h3:has-text("Reviews per week")', 1600);
    await focus(page, 'h3:has-text("Conversion funnel")', 1400);

    console.log('Messages');
    await nav(page, '/messages');
    const thread = page.locator('.thread-item').first();
    if (await thread.count()) {
      await thread.click();
      await PAUSE(1200);
      const qr = page.locator('.qr-btn').first();
      if (await qr.isVisible() && await qr.isEnabled()) {
        await qr.click();
        await PAUSE(900);
      }
    }

    console.log('Settings');
    await nav(page, '/settings');
    await focus(page, 'text=Message 1', 1200);
    await scrollBy(page, 380);
    await focus(page, 'text=AiSensy', 1000);

    console.log('Final chart');
    await nav(page, '/dashboard');
    await waitDashboard(page);
    await focus(page, '.recharts-surface', 2200);

    console.log('Done');
  } catch (err) {
    console.error('Demo error:', err.message);
    await PAUSE(1000);
  } finally {
    await PAUSE(600);
    await browser.close();
  }
}

run();
