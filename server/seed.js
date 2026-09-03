import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const __seedDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__seedDir, '.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const db = createClient(url, key);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n, w) { return String(n).padStart(w, '0'); }

const DEFAULT_TEMPLATE = "Hi [customer name], thank you for visiting [business name]! We'd love to hear about your experience. It only takes 30 seconds: [google review link]";

const SAMPLE_NAMES = ['Aarav Sharma', 'Vivaan Patel', 'Aditya Gupta', 'Vihaan Reddy', 'Arjun Nair', 'Sai Kumar', 'Rohan Mehta', 'Karan Singh', 'Ananya Iyer', 'Diya Verma', 'Isha Kapoor', 'Kavya Rao', 'Pooja Menon', 'Neha Joshi', 'Sanjay Das', 'Priya Banerjee', 'Rahul Khanna', 'Meera Nambiar', 'Kabir Malhotra', 'Tanvi Chopra'];
const PHONE_PREFIXES = ['981', '982', '983', '984', '985', '986', '987', '988', '989', '990'];

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

async function seed() {
  console.log('Clearing existing data...');
  await db.from('activities').delete().neq('id', '__x__');
  await db.from('pending_sends').delete().neq('id', '__x__');
  await db.from('feedback').delete().neq('id', '__x__');
  await db.from('reviews').delete().neq('id', '__x__');
  await db.from('requests').delete().neq('id', '__x__');
  await db.from('customers').delete().neq('id', '__x__');
  await db.from('sessions').delete().neq('token', '__x__');
  await db.from('admin_sessions').delete().neq('token', '__x__');
  await db.from('businesses').delete().neq('id', '__x__');
  await db.from('admins').delete().neq('id', '__x__');

  const rng = mulberry32(20260829);
  const now = Date.now();
  const DAY = 86400000;

  console.log('Seeding admin...');
  await db.from('admins').insert({ id: 'admin_1', email: 'admin@revsy.app', password_hash: hashPassword('ChangeMe123!'), created_at: new Date().toISOString() });

  console.log('Seeding business...');
  const business = {
    id: 'biz_1', name: 'Smash Bros', owner_email: 'owner@business.com', password: hashPassword('demo123'),
    is_demo: true, google_review_link: 'https://g.page/smash-bros-ludhiana/review',
    feedback_link: 'https://smashbros.example.com/feedback/private',
    address: 'SCF 29 F, Bhai Randhir Singh Nagar, Ludhiana, Punjab 141012',
    phone: '098143 05932', description: 'Smash Bros is a modern smash burger and fried chicken restaurant.',
    message_template: DEFAULT_TEMPLATE, delay_seconds: 7200, demo_mode: false,
    subscription_status: 'trial', created_at: new Date(now - 240 * DAY).toISOString(),
    place_id: '', whatsapp_bsp: '', whatsapp_api_key: '', whatsapp_phone_number_id: '',
    whatsapp_status: 'not_connected', reviews_received: 0,
  };
  await db.from('businesses').insert(business);

  console.log('Seeding customers...');
  const customers = [];
  for (let i = 0; i < 18; i++) {
    const name = SAMPLE_NAMES[i];
    const phone = `+91 ${PHONE_PREFIXES[i % PHONE_PREFIXES.length]}${pad(Math.floor(rng() * 10000000), 7)}`;
    const stageRoll = rng();
    let stage = 'to_send';
    if (stageRoll > 0.62) stage = 'reviewed';
    else if (stageRoll > 0.40) stage = 'negative';
    else if (stageRoll > 0.20) stage = 'positive';
    else if (stageRoll > 0.10) stage = 'opened';
    else if (stageRoll > 0.04) stage = 'sent';
    const createdAt = new Date(now - Math.floor(rng() * 84) * DAY - Math.floor(rng() * DAY)).toISOString();
    customers.push({
      id: `cust_${i + 1}`, business_id: business.id, name, phone, custom_message: '',
      stage, sentiment: stage === 'positive' ? 'positive' : stage === 'negative' ? 'negative' : null,
      complaint: stage === 'negative' ? 'Food took a while and the fries were cold.' : '',
      created_at: createdAt, last_request_at: null, last_request_status: null,
    });
  }
  const { error: custErr } = await db.from('customers').insert(customers);
  if (custErr) { console.error('customers insert', custErr); throw custErr; }

  console.log('Seeding requests and reviews...');
  const requests = [];
  const reviews = [];
  const feedback = [];
  const activities = [];
  let reviewsReceived = 0;

  for (let i = 0; i < 42; i++) {
    const cust = customers[Math.floor(rng() * customers.length)];
    const weekOffset = Math.floor(Math.pow(rng(), 1.6) * 12);
    const ageDays = weekOffset * 7 + Math.floor(rng() * 7);
    const createdAt = new Date(now - ageDays * DAY - Math.floor(rng() * DAY));
    let status = 'Sent';
    let reaction = null;
    let feedbackText = null;
    if (cust.stage === 'opened') status = 'Opened';
    else if (cust.stage === 'positive') { status = 'Opened'; reaction = 'positive'; }
    else if (cust.stage === 'negative') { status = 'Opened'; reaction = 'negative'; feedbackText = cust.complaint; }
    else if (cust.stage === 'reviewed') status = 'Reviewed';
    const openedAt = status === 'Opened' || status === 'Reviewed' ? new Date(Math.min(now, createdAt.getTime() + Math.floor(rng() * 6 * 3600000) + 600000)).toISOString() : null;
    const reviewedAt = status === 'Reviewed' ? new Date(Math.min(now, new Date(openedAt).getTime() + Math.floor(rng() * 48 * 3600000))).toISOString() : null;
    const id = `req_${i + 1}`;
    const message = renderTemplate(business.message_template, { customerName: cust.name, businessName: business.name, reviewLink: business.google_review_link });
    const req = { id, business_id: business.id, customer_id: cust.id, customer_name: cust.name, phone: cust.phone, message, status, reaction, feedback_text: feedbackText, created_at: createdAt.toISOString(), sent_at: createdAt.toISOString(), opened_at: openedAt, reviewed_at: reviewedAt };
    requests.push(req);
    if (status === 'Reviewed') {
      reviewsReceived++;
      reviews.push({ id: `rev_${i + 1}`, business_id: business.id, customer_id: cust.id, customer_name: cust.name, rating: 4 + (rng() < 0.5 ? 1 : 0), text: '', source: 'internal', google_review_id: null, request_id: id, sent_at: createdAt.toISOString(), created_at: reviewedAt });
    }
  }
  const { error: reqErr } = await db.from('requests').insert(requests);
  if (reqErr) { console.error('requests insert', reqErr); throw reqErr; }
  if (reviews.length) { const { error: revErr } = await db.from('reviews').insert(reviews); if (revErr) { console.error('reviews', revErr); throw revErr; } }

  for (const c of customers) {
    if (c.stage === 'negative') {
      feedback.push({ id: `fb_${c.id}`, business_id: business.id, customer_id: c.id, customer_name: c.name, phone: c.phone, complaint: c.complaint, google_review_id: null, created_at: c.created_at, submitted_at: null });
    }
  }
  if (feedback.length) { const { error: fbErr } = await db.from('feedback').insert(feedback); if (fbErr) { console.error('feedback', fbErr); throw fbErr; } }

  const sortedReqs = [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  for (const r of sortedReqs.slice(0, 50)) {
    activities.push({ id: `act_${r.id}`, business_id: business.id, type: 'message_sent', customer_name: r.customer_name, phone: r.phone, message: r.message, status: r.status, created_at: r.created_at });
  }
  if (activities.length) { const { error: actErr } = await db.from('activities').insert(activities); if (actErr) { console.error('activities', actErr); throw actErr; } }

  await db.from('businesses').update({ reviews_received: reviewsReceived }).eq('id', business.id);

  console.log(`Seeded: 1 business, ${customers.length} customers, ${requests.length} requests, ${reviews.length} reviews, ${feedback.length} feedback, ${activities.length} activities`);
  console.log('Done!');
}

seed().catch(e => { console.error(e); process.exit(1); });
