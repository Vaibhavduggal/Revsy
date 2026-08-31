import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// --- Password hashing (scrypt, no extra dependency) ---
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}
export function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Tiny deterministic PRNG so seeded demo data is stable across resets.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_TEMPLATE =
  'Hi [customer name], thank you for visiting [business name]! We\'d love to hear about your experience. It only takes 30 seconds: [google review link]';

const SAMPLE_NAMES = [
  'Aarav Sharma', 'Vivaan Patel', 'Aditya Gupta', 'Vihaan Reddy', 'Arjun Nair',
  'Sai Kumar', 'Rohan Mehta', 'Karan Singh', 'Ananya Iyer', 'Diya Verma',
  'Isha Kapoor', 'Kavya Rao', 'Pooja Menon', 'Neha Joshi', 'Sanjay Das',
  'Priya Banerjee', 'Rahul Khanna', 'Meera Nambiar', 'Kabir Malhotra', 'Tanvi Chopra',
];

const PHONE_PREFIXES = ['981', '982', '983', '984', '985', '986', '987', '988', '989', '990'];

function pad(n, w) { return String(n).padStart(w, '0'); }
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return week;
}

let DB = null;

function buildSeed() {
  const rng = mulberry32(20260829);
  const now = Date.now();
  const DAY = 86400000;

  const business = {
    id: 'biz_1',
    name: 'Smash Bros',
    ownerEmail: 'owner@business.com',
    passwordHash: hashPassword('demo123'),
    isDemo: true,
    googleReviewLink: 'https://g.page/smash-bros-ludhiana/review',
    feedbackLink: 'https://smashbros.example.com/feedback/private',
    address: 'SCF 29 F, Bhai Randhir Singh Nagar, Ludhiana, Punjab 141012',
    phone: '098143 05932',
    description: 'Smash Bros is a modern smash burger and fried chicken restaurant bringing bold flavors and crispy perfection to every bite. We serve freshly grilled smash burgers and golden fried chicken in a fun, minimal, blue-and-white-themed space. Born from the bond of brotherhood, our story is about passion, flavor, and family.',
    messageTemplate: DEFAULT_TEMPLATE,
    delaySeconds: 7200,
    demoMode: false,
    subscriptionStatus: 'trial',
    createdAt: new Date(now - 240 * DAY).toISOString(),
    // Google Places review sync (set by the client in Settings, or by admin).
    placeId: '',
    // WhatsApp Business API connection (set by the admin during client onboarding).
    whatsapp: { bsp: '', apiKey: '', phoneNumberId: '', status: 'not_connected' },
  };

  const customers = [];
  for (let i = 0; i < 18; i++) {
    const name = SAMPLE_NAMES[i];
    const phone = `+91 ${PHONE_PREFIXES[i % PHONE_PREFIXES.length]}${pad(Math.floor(rng() * 10000000), 7)}`;
    // Distribute customers across the kanban pipeline up front.
    const stageRoll = rng();
    let stage = 'to_send';
    if (stageRoll > 0.62) stage = 'reviewed';
    else if (stageRoll > 0.40) stage = 'negative';
    else if (stageRoll > 0.20) stage = 'positive';
    else if (stageRoll > 0.10) stage = 'opened';
    else if (stageRoll > 0.04) stage = 'sent';
    const createdAt = new Date(now - Math.floor(rng() * 84) * DAY - Math.floor(rng() * DAY)).toISOString();
    customers.push({
      id: `cust_${i + 1}`,
      businessId: business.id,
      name,
      phone,
      customMessage: '',
      stage,
      sentiment: stage === 'positive' ? 'positive' : stage === 'negative' ? 'negative' : null,
      complaint: stage === 'negative' ? 'Food took a while and the fries were cold.' : '',
      createdAt,
      lastRequestAt: null,
      lastRequestStatus: null,
    });
  }

  const requests = [];
  const reviews = [];
  const feedback = [];
  const activities = [];
  let reviewsReceived = 0;
  const REQ_COUNT = 42;
  for (let i = 0; i < REQ_COUNT; i++) {
    const cust = customers[Math.floor(rng() * customers.length)];
    // Bias toward recent weeks for a gentle growth trend, but spread across all 12.
    const weekOffset = Math.floor(Math.pow(rng(), 1.6) * 12); // 0..11, biased toward recent
    const ageDays = weekOffset * 7 + Math.floor(rng() * 7);
    const createdAt = new Date(now - ageDays * DAY - Math.floor(rng() * DAY));

    let status = 'Sent';
    let reaction = null;
    let feedbackText = null;
    let sentiment = null;

    if (cust.stage === 'opened') status = 'Opened';
    else if (cust.stage === 'positive') { status = 'Opened'; reaction = 'positive'; sentiment = 'positive'; }
    else if (cust.stage === 'negative') { status = 'Opened'; reaction = 'negative'; sentiment = 'negative'; feedbackText = cust.complaint; }
    else if (cust.stage === 'reviewed') status = 'Reviewed';

    const openedAt = status === 'Opened' || status === 'Reviewed'
      ? new Date(Math.min(now, createdAt.getTime() + Math.floor(rng() * 6 * 3600000) + 600000)).toISOString()
      : null;
    const reviewedAt = status === 'Reviewed'
      ? new Date(Math.min(now, new Date(openedAt).getTime() + Math.floor(rng() * 48 * 3600000))).toISOString()
      : null;

    const id = `req_${i + 1}`;
    const message = renderTemplate(business.messageTemplate, {
      customerName: cust.name,
      businessName: business.name,
      reviewLink: business.googleReviewLink,
    });
    requests.push({
      id,
      businessId: business.id,
      customerId: cust.id,
      customerName: cust.name,
      phone: cust.phone,
      message,
      status,
      reaction,
      feedbackText,
      createdAt: createdAt.toISOString(),
      sentAt: createdAt.toISOString(),
      openedAt,
      reviewedAt,
    });
    if (status === 'Reviewed') {
      reviewsReceived++;
      reviews.push({
        id: `rev_${i + 1}`,
        businessId: business.id,
        customerId: cust.id,
        customerName: cust.name,
        rating: 4 + (rng() < 0.5 ? 1 : 0), // 4 or 5 stars
        text: '',
        source: 'internal',
        requestId: id,
        sentAt: createdAt.toISOString(),
        createdAt: reviewedAt,
      });
    }
  }

  // Private feedback entries for negative customers (never shown on Google).
  for (const c of customers) {
    if (c.stage === 'negative') {
      feedback.push({
        id: `fb_${c.id}`,
        businessId: business.id,
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        complaint: c.complaint,
        createdAt: c.createdAt,
      });
    }
  }

  // Activities derived from requests, most recent first.
  const sortedReqs = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const r of sortedReqs.slice(0, 50)) {
    activities.push({
      id: `act_${r.id}`,
      businessId: business.id,
      type: 'message_sent',
      customerName: r.customerName,
      phone: r.phone,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
    });
  }

  business.reviewsReceived = reviewsReceived;

  // Default platform admin — change this password after first login (Admin login page).
  const admins = [
    { id: 'admin_1', email: 'admin@revsy.app', passwordHash: hashPassword('ChangeMe123!') },
  ];

  return {
    businesses: [business],
    customers,
    requests,
    reviews,
    feedback,
    pendingSends: [],
    activities,
    admins,
    sessions: [],
    adminSessions: [],
  };
}

export function renderTemplate(template, { customerName, businessName, reviewLink }) {
  return String(template)
    .replaceAll('[customer name]', customerName)
    .replaceAll('[business name]', businessName)
    .replaceAll('[google review link]', reviewLink);
}

export async function initDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const adapter = new JSONFile(DATA_FILE);
  const defaults = buildSeed();
  DB = new Low(adapter, defaults);
  await DB.read();
  // lowdb keeps defaults only when the file is missing/empty.
  if (!DB.data || !DB.data.businesses || DB.data.businesses.length === 0) {
    DB.data = buildSeed();
    await DB.write();
  } else {
    // Migrate an older db.json (plaintext password, no admin/session tables) in place.
    let changed = false;
    for (const b of DB.data.businesses) {
      if (!b.passwordHash && b.password) { b.passwordHash = hashPassword(b.password); delete b.password; changed = true; }
      if (!b.whatsapp) { b.whatsapp = { bsp: '', apiKey: '', phoneNumberId: '', status: 'not_connected' }; changed = true; }
      if (typeof b.placeId !== 'string') { b.placeId = ''; changed = true; }
    }
    if (!DB.data.admins || DB.data.admins.length === 0) {
      DB.data.admins = [{ id: 'admin_1', email: 'admin@revsy.app', passwordHash: hashPassword('ChangeMe123!') }];
      changed = true;
    }
    if (!DB.data.sessions) { DB.data.sessions = []; changed = true; }
    if (!DB.data.adminSessions) { DB.data.adminSessions = []; changed = true; }
    if (changed) await DB.write();
  }
  return DB;
}

export function getDb() {
  if (!DB) throw new Error('Database not initialised');
  return DB;
}

export function getBusiness(businessId) {
  return DB.data.businesses.find((b) => b.id === businessId) || null;
}

export function buildSeedExport() {
  return buildSeed();
}

export const defaultTemplate = DEFAULT_TEMPLATE;
