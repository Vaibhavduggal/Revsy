import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// --- Supabase client ---
let supabase = null;

export async function initDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  supabase = createClient(url, key);
  return supabase;
}

export function getDb() {
  if (!supabase) throw new Error('Database not initialised');
  return supabase;
}

export async function getBusiness(businessId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  if (error || !data) return null;
  return mapBusiness(data);
}

// Map snake_case DB row to camelCase JS object
function mapBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    passwordHash: row.password_hash,
    isDemo: row.is_demo,
    googleReviewLink: row.google_review_link,
    feedbackLink: row.feedback_link,
    address: row.address,
    phone: row.phone,
    description: row.description,
    messageTemplate: row.message_template,
    delaySeconds: row.delay_seconds,
    demoMode: row.demo_mode,
    subscriptionStatus: row.subscription_status,
    createdAt: row.created_at,
    placeId: row.place_id,
    whatsapp: {
      bsp: row.whatsapp_bsp || '',
      apiKey: row.whatsapp_api_key || '',
      phoneNumberId: row.whatsapp_phone_number_id || '',
      status: row.whatsapp_status || 'not_connected',
    },
    reviewsReceived: row.reviews_received || 0,
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    customMessage: row.custom_message || '',
    stage: row.stage || 'to_send',
    sentiment: row.sentiment || null,
    complaint: row.complaint || '',
    createdAt: row.created_at,
    lastRequestAt: row.last_request_at,
    lastRequestStatus: row.last_request_status,
  };
}

function mapRequest(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    phone: row.phone,
    message: row.message,
    status: row.status,
    reaction: row.reaction || null,
    feedbackText: row.feedback_text || null,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    reviewedAt: row.reviewed_at,
  };
}

function mapReview(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    rating: row.rating,
    text: row.text || '',
    source: row.source || 'internal',
    googleReviewId: row.google_review_id || null,
    requestId: row.request_id,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function mapFeedback(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    phone: row.phone,
    complaint: row.complaint || '',
    googleReviewId: row.google_review_id || null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at || null,
  };
}

function mapPendingSend(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    phone: row.phone,
    message: row.message,
    scheduledTime: row.scheduled_time,
    status: row.status,
    retryCount: row.retry_count || 0,
    error: row.error || null,
    createdAt: row.created_at,
    sentAt: row.sent_at || null,
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    customerName: row.customer_name,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapSession(row) {
  return {
    token: row.token,
    businessId: row.business_id,
    createdAt: row.created_at,
  };
}

function mapAdminSession(row) {
  return {
    token: row.token,
    adminId: row.admin_id,
    createdAt: row.created_at,
  };
}

function mapAdmin(row) {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
  };
}

// Convert JS object to snake_case for DB inserts
function toBusinessRow(obj) {
  const row = {
    id: obj.id,
    name: obj.name,
    owner_email: obj.ownerEmail,
    password_hash: obj.passwordHash,
    is_demo: obj.isDemo,
    google_review_link: obj.googleReviewLink,
    feedback_link: obj.feedbackLink,
    address: obj.address,
    phone: obj.phone,
    description: obj.description,
    message_template: obj.messageTemplate,
    delay_seconds: obj.delaySeconds,
    demo_mode: obj.demoMode,
    subscription_status: obj.subscriptionStatus,
    created_at: obj.createdAt,
    place_id: obj.placeId,
    whatsapp_bsp: obj.whatsapp?.bsp || '',
    whatsapp_api_key: obj.whatsapp?.apiKey || '',
    whatsapp_phone_number_id: obj.whatsapp?.phoneNumberId || '',
    whatsapp_status: obj.whatsapp?.status || 'not_connected',
    reviews_received: obj.reviewsReceived || 0,
  };
  return row;
}

function toCustomerRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    name: obj.name,
    phone: obj.phone,
    custom_message: obj.customMessage || '',
    stage: obj.stage || 'to_send',
    sentiment: obj.sentiment || null,
    complaint: obj.complaint || '',
    created_at: obj.createdAt,
    last_request_at: obj.lastRequestAt,
    last_request_status: obj.lastRequestStatus,
  };
}

function toRequestRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    customer_id: obj.customerId,
    customer_name: obj.customerName,
    phone: obj.phone,
    message: obj.message,
    status: obj.status,
    reaction: obj.reaction || null,
    feedback_text: obj.feedbackText || null,
    created_at: obj.createdAt,
    sent_at: obj.sentAt,
    opened_at: obj.openedAt,
    reviewed_at: obj.reviewedAt,
  };
}

function toReviewRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    customer_id: obj.customerId,
    customer_name: obj.customerName,
    rating: obj.rating,
    text: obj.text || '',
    source: obj.source || 'internal',
    google_review_id: obj.googleReviewId || null,
    request_id: obj.requestId,
    sent_at: obj.sentAt,
    created_at: obj.createdAt,
  };
}

function toFeedbackRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    customer_id: obj.customerId,
    customer_name: obj.customerName,
    phone: obj.phone,
    complaint: obj.complaint || '',
    google_review_id: obj.googleReviewId || null,
    created_at: obj.createdAt,
    submitted_at: obj.submittedAt || null,
  };
}

function toPendingSendRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    customer_id: obj.customerId,
    phone: obj.phone,
    message: obj.message,
    scheduled_time: obj.scheduledTime,
    status: obj.status,
    retry_count: obj.retryCount || 0,
    error: obj.error || null,
    created_at: obj.createdAt,
    sent_at: obj.sentAt || null,
  };
}

function toActivityRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    type: obj.type,
    customer_name: obj.customerName,
    phone: obj.phone,
    message: obj.message,
    status: obj.status,
    created_at: obj.createdAt,
  };
}

export const DEFAULT_TEMPLATE =
  'Hi [customer name], thank you for visiting [business name]! We\'d love to hear about your experience. It only takes 30 seconds: [google review link]';

export function renderTemplate(template, { customerName, businessName, reviewLink }) {
  return String(template)
    .replaceAll('[customer name]', customerName)
    .replaceAll('[business name]', businessName)
    .replaceAll('[google review link]', reviewLink);
}

export function buildSeedExport() {
  return buildSeed();
}

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
    description: 'Smash Bros is a modern smash burger and fried chicken restaurant bringing bold flavors and crispy perfection to every bite.',
    messageTemplate: DEFAULT_TEMPLATE,
    delaySeconds: 7200,
    demoMode: false,
    subscriptionStatus: 'trial',
    createdAt: new Date(now - 240 * DAY).toISOString(),
    placeId: '',
    whatsapp: { bsp: '', apiKey: '', phoneNumberId: '', status: 'not_connected' },
    reviewsReceived: 0,
  };

  const SAMPLE_NAMES = [
    'Aarav Sharma', 'Vivaan Patel', 'Aditya Gupta', 'Vihaan Reddy', 'Arjun Nair',
    'Sai Kumar', 'Rohan Mehta', 'Karan Singh', 'Ananya Iyer', 'Diya Verma',
    'Isha Kapoor', 'Kavya Rao', 'Pooja Menon', 'Neha Joshi', 'Sanjay Das',
    'Priya Banerjee', 'Rahul Khanna', 'Meera Nambiar', 'Kabir Malhotra', 'Tanvi Chopra',
  ];
  const PHONE_PREFIXES = ['981', '982', '983', '984', '985', '986', '987', '988', '989', '990'];

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
        rating: 4 + (rng() < 0.5 ? 1 : 0),
        text: '',
        source: 'internal',
        requestId: id,
        sentAt: createdAt.toISOString(),
        createdAt: reviewedAt,
      });
    }
  }

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

export { mapBusiness, mapCustomer, mapRequest, mapReview, mapFeedback, mapPendingSend, mapActivity, mapSession, mapAdminSession, mapAdmin };
export { toBusinessRow, toCustomerRow, toRequestRow, toReviewRow, toFeedbackRow, toPendingSendRow, toActivityRow };
export { defaultTemplate };
