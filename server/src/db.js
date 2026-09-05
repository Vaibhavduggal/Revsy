import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { defaultTemplateFor, getCopy } from './categoryCopy.js';

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
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  supabase = createClient(url, key);
  await ensurePlatformAdmin();
  await ensureDemoBusiness();
  await ensureBurnGym();
  return supabase;
}

async function ensureDemoBusiness() {
  try {
    const { data } = await supabase.from('businesses').select('id').eq('is_demo', true).limit(1);
    const patch = {
      onboarding_completed: true,
      approval_status: 'approved',
      google_connected: true,
      demo_mode: true,
      category: 'restaurant',
      category_set: true,
    };
    if (data?.[0]) {
      const { error } = await supabase.from('businesses').update(patch).eq('id', data[0].id);
      if (error) console.error('[revsy] ensureDemo update:', error.message);
      return;
    }
    const { error } = await supabase.from('businesses').insert({
      id: 'biz_1',
      name: 'Smash Bros',
      owner_email: 'owner@business.com',
      password: hashPassword('demo123'),
      is_demo: true,
      google_review_link: 'https://g.page/smash-bros-ludhiana/review',
      feedback_link: '',
      address: 'SCF 29 F, Bhai Randhir Singh Nagar, Ludhiana, Punjab 141012',
      phone: '098143 05932',
      description: 'Smash burger restaurant demo used for live client walkthroughs.',
      message_template: defaultTemplateFor('restaurant'),
      delay_seconds: 1800,
      demo_mode: true,
      subscription_status: 'active',
      created_at: new Date().toISOString(),
      place_id: '',
      whatsapp_bsp: '',
      whatsapp_api_key: '',
      whatsapp_phone_number_id: '',
      whatsapp_status: 'not_connected',
      reviews_received: 0,
      google_connected: true,
      onboarding_completed: true,
      approval_status: 'approved',
      pre_approved: true,
      category: 'restaurant',
      category_set: true,
    });
    if (error) console.error('[revsy] ensureDemo insert:', error.message);
  } catch (e) {
    console.error('[revsy] ensureDemo:', e.message);
  }
}

async function ensurePlatformAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;
  const { data: match } = await supabase.from('admins').select('id').eq('email', email).maybeSingle();
  if (match) return;
  const { data: all } = await supabase.from('admins').select('id');
  for (const row of all || []) {
    await supabase.from('admin_sessions').delete().eq('admin_id', row.id);
    await supabase.from('admins').delete().eq('id', row.id);
  }
  await supabase.from('admins').insert({
    id: 'admin_1',
    email,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
  });
}

async function ensureBurnGym() {
  try {
    const { data: existing } = await supabase.from('businesses').select('id').eq('owner_email', 'owner@burngym.com').maybeSingle();
    const now = new Date().toISOString();
    const gym = {
      name: 'Burn Gym, Ghumar Mandi',
      owner_email: 'owner@burngym.com',
      is_demo: false,
      google_review_link: 'https://search.google.com/local/writereview?placeid=ChIJBurnGymGhumarMandi',
      feedback_link: '',
      address: 'Plot No. B-19/186, 3rd-4th Floor, Rani Jhansi Road, Ghumar Mandi, Ludhiana, Punjab 141001',
      phone: '+91 99887 77999',
      description: 'Burn Gym, Ghumar Mandi — strength, PT, and group training in Ludhiana.',
      message_template: defaultTemplateFor('gym'),
      delay_seconds: 1800,
      demo_mode: true,
      subscription_status: 'active',
      place_id: '',
      google_connected: true,
      onboarding_completed: true,
      approval_status: 'approved',
      pre_approved: true,
      category: 'gym',
      category_set: true,
      whatsapp_status: 'not_connected',
    };
    let businessId = existing?.id;
    if (!businessId) {
      businessId = 'biz_burn_gym';
      const { error } = await supabase.from('businesses').insert({
        id: businessId,
        password: hashPassword('demo123'),
        created_at: now,
        reviews_received: 0,
        whatsapp_bsp: '',
        whatsapp_api_key: '',
        whatsapp_phone_number_id: '',
        ...gym,
      });
      if (error) {
        console.error('[revsy] ensureBurnGym insert:', error.message);
        return;
      }
    } else {
      await supabase.from('businesses').update(gym).eq('id', businessId);
    }

    const { data: onboard } = await supabase.from('businesses').select('id').eq('owner_email', 'setup@burngym.com').maybeSingle();
    if (!onboard) {
      await supabase.from('businesses').insert({
        id: 'biz_burn_onboard',
        name: 'Burn Gym, Ghumar Mandi',
        owner_email: 'setup@burngym.com',
        password: hashPassword('demo123'),
        is_demo: false,
        google_review_link: '',
        feedback_link: '',
        address: '',
        phone: '',
        description: '',
        message_template: defaultTemplateFor('restaurant'),
        delay_seconds: 1800,
        demo_mode: false,
        subscription_status: 'trial',
        created_at: now,
        place_id: '',
        whatsapp_bsp: '',
        whatsapp_api_key: '',
        whatsapp_phone_number_id: '',
        whatsapp_status: 'not_connected',
        reviews_received: 0,
        google_connected: false,
        onboarding_completed: false,
        approval_status: 'pending_approval',
        pre_approved: true,
        category: 'restaurant',
        category_set: false,
      });
    }

    await seedBurnGymReviews(businessId);
  } catch (e) {
    console.error('[revsy] ensureBurnGym:', e.message);
  }
}

async function seedBurnGymReviews(businessId) {
  const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', businessId);
  if ((count || 0) > 0) return;

  const DAY = 86400000;
  const now = Date.now();
  const negatives = [
    { name: 'Manpreet Singh', rating: 2, text: 'Machines at this branch feel dated compared to Burn Gym Model Town. Treadmills squeak and the floor looks worn. Ambience is not up to the other locations.' },
    { name: 'Simran Kaur', rating: 1, text: 'The 30-day challenge keeps getting postponed. Third time my PT slot was moved with almost no notice. Scheduling is inconsistent.' },
    { name: 'Gurpreet Dhillon', rating: 2, text: 'Front desk rarely replies on WhatsApp. I waited 20 minutes for someone to acknowledge me after my session. Staff responsiveness is poor.' },
    { name: 'Navjot Brar', rating: 2, text: 'Equipment is old and two cable machines were out of order. Other Burn Gym branches feel newer. Please refresh this location.' },
    { name: 'Jasleen Gill', rating: 1, text: 'Booked a trainer for the 30-day challenge kickoff and it was postponed again. PT calendar does not match what they promised at signup.' },
    { name: 'Harmanpreet Joshi', rating: 2, text: 'Asked three times about a locker issue. Staff smiled and walked away. Need someone at the desk who actually follows up.' },
  ];
  const positives = [
    { name: 'Anmol Sharma', rating: 5, text: 'Trainer Rahul actually cares about form. I have lost 6kg in two months and the energy in the evening batch is great.' },
    { name: 'Pooja Verma', rating: 5, text: 'Helpful trainers and I can already see results. The community here keeps me showing up.' },
    { name: 'Karan Mehta', rating: 4, text: 'Solid workouts and the PT who is present is excellent. Hoping they fix the older machines soon but I still recommend the coaches.' },
    { name: 'Ishita Nanda', rating: 5, text: 'Good results after 8 weeks. Trainers explain every movement. This branch can be great once equipment is updated.' },
  ];

  const reviews = [...negatives, ...positives].map((r, i) => ({
    id: `rev_burn_${i + 1}`,
    business_id: businessId,
    customer_id: null,
    customer_name: r.name,
    rating: r.rating,
    text: r.text,
    source: 'google',
    google_review_id: `g_burn_${i + 1}`,
    created_at: new Date(now - (20 - i) * DAY).toISOString(),
    is_read: false,
  }));
  const { error } = await supabase.from('reviews').insert(reviews);
  if (error) {
    console.error('[revsy] seedBurnGymReviews:', error.message);
    return;
  }
  await supabase.from('businesses').update({ reviews_received: reviews.length }).eq('id', businessId);

  const issues = [
    {
      id: 'iss_burn_equipment',
      theme: 'Dated equipment and ambience vs other branches',
      improvement: 'Refresh high-use machines and deep-clean the floor so Ghumar Mandi matches newer Burn Gym locations.',
      first_seen: new Date(now - 18 * DAY).toISOString(),
      occurrences: 3,
      example_review_ids: ['rev_burn_1', 'rev_burn_4'],
      is_read: false,
      kind: 'complaint',
    },
    {
      id: 'iss_burn_pt',
      theme: 'Inconsistent trainer / 30-day challenge scheduling',
      improvement: 'Lock the 30-day challenge calendar and message members 24h before any PT change.',
      first_seen: new Date(now - 14 * DAY).toISOString(),
      occurrences: 2,
      example_review_ids: ['rev_burn_2', 'rev_burn_5'],
      is_read: false,
      kind: 'complaint',
    },
    {
      id: 'iss_burn_staff',
      theme: 'Slow staff responsiveness',
      improvement: 'Put a dedicated floor manager on WhatsApp and a 5-minute front-desk SLA.',
      first_seen: new Date(now - 10 * DAY).toISOString(),
      occurrences: 2,
      example_review_ids: ['rev_burn_3', 'rev_burn_6'],
      is_read: false,
      kind: 'complaint',
    },
    {
      id: 'iss_burn_hours',
      theme: 'Later evening class on weekdays',
      improvement: 'Pilot a 8:30pm strength class twice a week and measure attendance for a month.',
      first_seen: new Date(now - 6 * DAY).toISOString(),
      occurrences: 2,
      example_review_ids: [],
      is_read: false,
      kind: 'suggestion',
    },
  ];
  await supabase.from('review_summaries').insert({
    id: 'sum_burn_gym',
    business_id: businessId,
    period_start: new Date(now - 365 * DAY).toISOString(),
    period_end: new Date().toISOString(),
    summary_text: issues.map((i) => `${i.theme}: ${i.improvement}`).join('\n'),
    areas_of_improvement: issues.map((i) => i.improvement).join('\n'),
    review_count: negatives.length,
    is_read: false,
    created_at: new Date().toISOString(),
    issues,
  });
  for (const iss of issues) {
    for (const rid of iss.example_review_ids) {
      await supabase.from('reviews').update({ ai_flag: 'repeated', ai_issue_id: iss.id }).eq('id', rid);
    }
  }
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
    passwordHash: row.password,
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
      bsp: (row.whatsapp_bsp || '').split('::')[0] || '',
      apiKey: row.whatsapp_api_key || '',
      phoneNumberId: row.whatsapp_phone_number_id || '',
      campaignName: row.whatsapp_campaign_name || (row.whatsapp_bsp || '').split('::')[1] || '',
      status: row.whatsapp_status || 'not_connected',
    },
    reviewsReceived: row.reviews_received || 0,
    googleAccessToken: row.google_access_token || null,
    googleRefreshToken: row.google_refresh_token || null,
    googleTokenExpiresAt: row.google_token_expires_at || null,
    googleConnected: !!row.google_connected,
    googleAccountEmail: row.google_account_email || null,
    googleAccountName: row.google_account_name || null,
    googleLocationName: row.google_location_name || (String(row.place_id || '').includes('/locations/') ? row.place_id : null),
    onboardingCompleted: !!row.onboarding_completed,
    approvalStatus: row.approval_status || 'pending_approval',
    preApproved: !!row.pre_approved,
    approvedAt: row.approved_at || null,
    rejectedAt: row.rejected_at || null,
    category: row.category === 'gym' ? 'gym' : 'restaurant',
    categorySet: !!row.category_set,
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
    waDeliveryStatus: row.wa_delivery_status || null,
    waStep: row.wa_step || 'idle',
    waHistory: Array.isArray(row.wa_history) ? row.wa_history : [],
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
    isRead: !!row.is_read,
    aiFlag: row.ai_flag || null,
    aiIssueId: row.ai_issue_id || null,
  };
}

function mapReviewSummary(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summaryText: row.summary_text,
    areasOfImprovement: row.areas_of_improvement,
    reviewCount: row.review_count,
    isRead: !!row.is_read,
    createdAt: row.created_at,
    issues: Array.isArray(row.issues) ? row.issues : [],
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
    type: row.type === 'suggestion' ? 'suggestion' : 'complaint',
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
    password: obj.passwordHash,
    google_access_token: obj.googleAccessToken || null,
    google_refresh_token: obj.googleRefreshToken || null,
    google_token_expires_at: obj.googleTokenExpiresAt || null,
    google_connected: !!obj.googleConnected,
    google_account_email: obj.googleAccountEmail || null,
    onboarding_completed: !!obj.onboardingCompleted,
    approval_status: obj.approvalStatus || 'pending_approval',
    pre_approved: !!obj.preApproved,
    approved_at: obj.approvedAt || null,
    rejected_at: obj.rejectedAt || null,
    category: obj.category === 'gym' ? 'gym' : 'restaurant',
    category_set: !!obj.categorySet,
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
    wa_delivery_status: obj.waDeliveryStatus || null,
    wa_step: obj.waStep || 'idle',
    wa_history: Array.isArray(obj.waHistory) ? obj.waHistory : [],
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
    is_read: !!obj.isRead,
    ai_flag: obj.aiFlag || null,
    ai_issue_id: obj.aiIssueId || null,
  };
}

function toReviewSummaryRow(obj) {
  return {
    id: obj.id,
    business_id: obj.businessId,
    period_start: obj.periodStart,
    period_end: obj.periodEnd,
    summary_text: obj.summaryText,
    areas_of_improvement: obj.areasOfImprovement,
    review_count: obj.reviewCount,
    is_read: !!obj.isRead,
    created_at: obj.createdAt,
    issues: Array.isArray(obj.issues) ? obj.issues : [],
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
    type: obj.type === 'suggestion' ? 'suggestion' : 'complaint',
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

export const DEFAULT_TEMPLATE = defaultTemplateFor('restaurant');

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
    { id: 'admin_1', email: 'vaibhavduggal88@gmail.com', passwordHash: hashPassword('admin123') },
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

export const defaultTemplate = DEFAULT_TEMPLATE;
export { mapBusiness, mapCustomer, mapRequest, mapReview, mapReviewSummary, mapFeedback, mapPendingSend, mapActivity, mapSession, mapAdminSession, mapAdmin };
export { toBusinessRow, toCustomerRow, toRequestRow, toReviewRow, toReviewSummaryRow, toFeedbackRow, toPendingSendRow, toActivityRow };
