import { Router } from 'express';
import { getDb, getBusiness, renderTemplate, hashPassword, verifyPassword, newToken, defaultTemplate, mapBusiness, mapCustomer, mapRequest, mapReview, mapReviewSummary, mapFeedback, mapPendingSend, mapActivity } from './db.js';
import { auth, adminAuth, recordActivity, publicBusiness } from './auth.js';
import { enqueueSend, retrySend, getFailedSends } from './queue.js';
import { firstRunClustering, classifyOneReview, weeklyUpdateBusiness, getCurrentSummaryRow, issuesFromRow } from './ai.js';

const router = Router();

function positiveFollowUp(link) {
  return `Awesome! 🙌 If you have 30 seconds, please leave us a Google review: ${link}`;
}
function negativeFollowUp(link) {
  return `We're really sorry to hear that. We'd love to make it right privately — please tell us what happened: ${link}`;
}

function effectiveDelay(business) {
  return business.demoMode ? 10 : (Number.isFinite(Number(business.delaySeconds)) ? Number(business.delaySeconds) : 1800);
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export const MESSAGE_PRESETS = [
  { id: 'casual', label: 'Casual', template: 'Hey [customer name]! Hope you enjoyed [business name] today 😄 Drop us a quick Google review if you can: [google review link]' },
  { id: 'warm', label: 'Warm / Thankful', template: 'Hi [customer name], thank you so much for visiting [business name]! We would be grateful if you shared your experience: [google review link]' },
  { id: 'first_time', label: 'First-time visitor', template: 'Welcome to [business name], [customer name]! We hope it was love at first bite. If so, a 30-second Google review would mean the world: [google review link]' },
];

export function render(business, customer) {
  const template = (customer && customer.customMessage && customer.customMessage.trim())
    ? customer.customMessage
    : business.messageTemplate;
  return renderTemplate(template, {
    customerName: customer?.name,
    businessName: business.name,
    reviewLink: business.googleReviewLink,
  });
}

function renderConversation(business, customer, request, feedbackForCustomer) {
  const bubbles = [];
  const initialMsg = (request && request.message) ? request.message : render(business, customer);
  if (request && request.status !== 'Scheduled') {
    bubbles.push({ from: 'business', type: 'text', text: initialMsg });
  }
  if (customer.stage === 'opened') {
    bubbles.push({ from: 'business', type: 'quickreply', text: 'How was your experience?', buttons: [{ label: '👍 Great', value: 'positive' }, { label: '👎 Not great', value: 'negative' }] });
  }
  if (customer.sentiment === 'positive') {
    bubbles.push({ from: 'customer', type: 'reaction', text: '👍 Great' });
    bubbles.push({ from: 'business', type: 'link', text: positiveFollowUp(business.googleReviewLink) });
  } else if (customer.sentiment === 'negative') {
    bubbles.push({ from: 'customer', type: 'reaction', text: '👎 Not great' });
    bubbles.push({ from: 'business', type: 'link', text: negativeFollowUp(business.feedbackLink) });
    if (feedbackForCustomer && feedbackForCustomer.complaint) {
      bubbles.push({ from: 'customer', type: 'text', text: feedbackForCustomer.complaint, private: true });
    }
  }
  if (customer.stage === 'reviewed') {
    bubbles.push({ from: 'business', type: 'text', text: 'Thanks for the Google review! 🙌' });
  }
  return bubbles;
}

function enqueueCustomerSend(business, customer) {
  const message = render(business, customer);
  const delaySeconds = effectiveDelay(business);
  return enqueueSend({ businessId: business.id, customerId: customer.id, phone: customer.phone, message, delaySeconds });
}

async function performSendNow(business, customer, request) {
  const db = getDb();
  const message = render(business, customer);
  await db.from('requests').update({ message }).eq('id', request.id);
  await enqueueSend({ businessId: business.id, customerId: customer.id, phone: customer.phone, message, delaySeconds: 0 });
  if (global.__reviewbotPollNow) global.__reviewbotPollNow();
}

export function resumeScheduledSends() {}

async function buildWeekly(businessId) {
  const db = getDb();
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const label = `W${weeks.length + 1}`;
    const { count } = await db.rpc('count_requests_in_range', { p_business_id: businessId, p_start: start.toISOString(), p_end: end.toISOString() }).single().then(r => r.data || { count: 0 }).catch(() => ({ count: 0 }));
    weeks.push({ label, count: count || 0 });
  }
  return weeks;
}

// Helper: fetch all requests for a business
async function getRequestsForBusiness(businessId) {
  const db = getDb();
  const { data } = await db.from('requests').select('*').eq('business_id', businessId);
  return (data || []).map(mapRequest);
}

// Helper: fetch all customers for a business
async function getCustomersForBusiness(businessId) {
  const db = getDb();
  const { data } = await db.from('customers').select('*').eq('business_id', businessId);
  return (data || []).map(mapCustomer);
}

// Helper: fetch all reviews for a business
async function getReviewsForBusiness(businessId) {
  const db = getDb();
  const { data } = await db.from('reviews').select('*').eq('business_id', businessId);
  return (data || []).map(mapReview);
}

// Helper: fetch all feedback for a business
async function getFeedbackForBusiness(businessId) {
  const db = getDb();
  const { data } = await db.from('feedback').select('*').eq('business_id', businessId);
  return (data || []).map(mapFeedback);
}

// --- Auth ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = getDb();
  const { data: bizData } = await db.from('businesses').select('*').eq('owner_email', email).single();
  if (!bizData || !verifyPassword(password || '', bizData.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const business = mapBusiness(bizData);
  const token = newToken();
  await db.from('sessions').insert({ token, business_id: business.id, created_at: new Date().toISOString() });
  res.json({ token, business: publicBusiness(business) });
});

router.post('/login/demo', async (req, res) => {
  const db = getDb();
  const { data: bizData } = await db.from('businesses').select('*').eq('is_demo', true).single();
  if (!bizData) return res.status(404).json({ error: 'Demo account not available' });
  const business = mapBusiness(bizData);
  const token = newToken();
  await db.from('sessions').insert({ token, business_id: business.id, created_at: new Date().toISOString() });
  res.json({ token, business: publicBusiness(business) });
});

router.post('/logout', auth, async (req, res) => {
  const db = getDb();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  await db.from('sessions').delete().eq('token', token);
  res.json({ ok: true });
});

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = getDb();
  const { data } = await db.from('admins').select('*').eq('email', email).single();
  if (!data || !verifyPassword(password || '', data.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = newToken();
  await db.from('admin_sessions').insert({ token, admin_id: data.id, created_at: new Date().toISOString() });
  res.json({ token, admin: { id: data.id, email: data.email } });
});

router.post('/admin/logout', adminAuth, async (req, res) => {
  const db = getDb();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  await db.from('admin_sessions').delete().eq('token', token);
  res.json({ ok: true });
});

// --- Dashboard ---
router.get('/dashboard', auth, async (req, res) => {
  const biz = req.business;
  const reqs = await getRequestsForBusiness(biz.id);
  const sent = reqs.filter((r) => r.status !== 'Scheduled').length;
  const received = biz.reviewsReceived || 0;
  const failedSendsRaw = await getFailedSends(biz.id);
  const customersList = await getCustomersForBusiness(biz.id);
  const customerMap = new Map(customersList.map(c => [c.id, c]));
  const failedSends = failedSendsRaw.map((s) => ({
    id: s.id, customerId: s.customerId, customerName: customerMap.get(s.customerId)?.name || s.phone,
    phone: s.phone, error: s.error, retryCount: s.retryCount,
  }));
  const recent = [...reqs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map((r) => {
      const cust = customerMap.get(r.customerId);
      return { id: r.id, customerName: r.customerName, phone: r.phone, status: r.status, reaction: r.reaction || null, hasCustomMessage: !!(cust && cust.customMessage && cust.customMessage.trim()), createdAt: r.createdAt };
    });
  res.json({
    stats: { totalSent: sent, totalReceived: received, conversionRate: sent ? Math.round((received / sent) * 1000) / 10 : 0 },
    weekly: await buildWeekly(biz.id),
    recent, failedSends,
  });
});

// --- Customers ---
router.get('/customers', auth, async (req, res) => {
  const list = await getCustomersForBusiness(req.business.id);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ customers: list.map(c => ({ ...c, hasCustomMessage: !!(c.customMessage && c.customMessage.trim()) })) });
});

router.get('/customers/:id', auth, async (req, res) => {
  const db = getDb();
  const { data } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!data) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(data);
  const { data: reqsData } = await db.from('requests').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
  const requests = (reqsData || []).map(mapRequest);
  const { data: fbData } = await db.from('feedback').select('*').eq('customer_id', customer.id).single();
  const feedbackForCustomer = fbData ? mapFeedback(fbData) : null;
  const conversation = renderConversation(req.business, customer, requests[0], feedbackForCustomer);
  res.json({
    customer: { ...customer, hasCustomMessage: !!(customer.customMessage && customer.customMessage.trim()) },
    requests, conversation,
    config: { googleReviewLink: req.business.googleReviewLink, feedbackLink: req.business.feedbackLink, messageTemplate: req.business.messageTemplate },
  });
});

async function createCustomerAndSchedule(business, name, phone) {
  const db = getDb();
  const customerId = newId('cust');
  const requestId = newId('req');
  const customerRow = { id: customerId, business_id: business.id, name, phone, custom_message: '', stage: 'to_send', sentiment: null, complaint: '', created_at: new Date().toISOString(), last_request_at: null, last_request_status: null };
  const requestRow = { id: requestId, business_id: business.id, customer_id: customerId, customer_name: name, phone, message: '', status: 'Scheduled', created_at: new Date().toISOString(), sent_at: null, opened_at: null, reviewed_at: null };
  await db.from('customers').insert(customerRow);
  await db.from('requests').insert(requestRow);
  const customer = mapCustomer(customerRow);
  await enqueueCustomerSend(business, customer);
  return { customer, request: mapRequest(requestRow) };
}

router.post('/customers', auth, async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  const { customer } = await createCustomerAndSchedule(req.business, name.trim(), phone.trim());
  res.json({ customer });
});

router.post('/customers/import', auth, async (req, res) => {
  const rows = Array.isArray(req.body?.customers) ? req.body.customers : [];
  const added = [];
  const skipped = [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const phone = String(row.phone || '').trim();
    if (!name || !phone) { skipped.push(row); continue; }
    const { customer } = await createCustomerAndSchedule(req.business, name, phone);
    added.push(customer);
  }
  res.json({ added: added.length, skipped: skipped.length, customers: added });
});

router.post('/customers/:id/send', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  let { data: reqData } = await db.from('requests').select('*').eq('customer_id', customer.id).eq('status', 'Scheduled').single();
  if (!reqData) {
    const newRow = { id: newId('req'), business_id: req.business.id, customer_id: customer.id, customer_name: customer.name, phone: customer.phone, message: '', status: 'Scheduled', created_at: new Date().toISOString(), sent_at: null, opened_at: null, reviewed_at: null };
    await db.from('requests').insert(newRow);
    reqData = newRow;
  }
  const request = mapRequest(reqData);
  await performSendNow(req.business, customer, request);
  res.json({ request, customer: { id: customer.id, stage: customer.stage } });
});

router.post('/customers/:id/open', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  if (customer.stage !== 'sent' && customer.stage !== 'to_send') {
    return res.status(400).json({ error: `Cannot open from stage "${customer.stage}"` });
  }
  const { data: reqData } = await db.from('requests').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(1).single();
  if (reqData) {
    const updates = {};
    if (!reqData.opened_at) updates.opened_at = new Date().toISOString();
    if (reqData.status === 'Sent') updates.status = 'Opened';
    await db.from('requests').update(updates).eq('id', reqData.id);
  }
  await db.from('customers').update({ stage: 'opened', last_request_status: 'Opened' }).eq('id', customer.id);
  res.json({ customer: { id: customer.id, stage: 'opened' } });
});

router.post('/customers/:id/reply', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  if (customer.stage !== 'opened') return res.status(400).json({ error: `Cannot reply from stage "${customer.stage}"` });
  const { reaction } = req.body || {};
  if (reaction !== 'positive' && reaction !== 'negative') return res.status(400).json({ error: 'reaction must be "positive" or "negative"' });
  const { data: reqData } = await db.from('requests').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(1).single();
  if (reqData) await db.from('requests').update({ reaction }).eq('id', reqData.id);
  const now = new Date().toISOString();
  await db.from('customers').update({ sentiment: reaction, stage: reaction }).eq('id', customer.id);

  if (reaction === 'negative') {
    const { data: existing } = await db.from('feedback').select('*').eq('customer_id', customer.id).single();
    if (!existing) {
      await db.from('feedback').insert({ id: `fb_${customer.id}`, business_id: req.business.id, customer_id: customer.id, customer_name: customer.name, phone: customer.phone, complaint: customer.complaint || '', created_at: now });
    } else {
      await db.from('feedback').update({ created_at: now }).eq('id', existing.id);
    }
    await recordActivity(req.business.id, { type: 'negative_reply', customerName: customer.name, phone: customer.phone, message: negativeFollowUp(req.business.feedbackLink), status: 'Negative' });
  } else {
    await recordActivity(req.business.id, { type: 'positive_reply', customerName: customer.name, phone: customer.phone, message: positiveFollowUp(req.business.googleReviewLink), status: 'Positive' });
  }
  res.json({ customer: { id: customer.id, stage: reaction, sentiment: reaction } });
});

router.post('/customers/:id/review', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  if (customer.stage !== 'positive') return res.status(400).json({ error: `Cannot review from stage "${customer.stage}"` });
  const { data: reqData } = await db.from('requests').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(1).single();
  const now = new Date().toISOString();
  if (reqData) await db.from('requests').update({ status: 'Reviewed', reviewed_at: reqData.reviewed_at || now }).eq('id', reqData.id);
  await db.from('customers').update({ stage: 'reviewed', last_request_status: 'Reviewed' }).eq('id', customer.id);
  const { data: already } = await db.from('reviews').select('*').eq('customer_id', customer.id).limit(1).single();
  if (!already) {
    await db.from('reviews').insert({ id: `rev_${customer.id}`, business_id: req.business.id, customer_id: customer.id, customer_name: customer.name, rating: 5, request_id: reqData ? reqData.id : null, sent_at: reqData ? reqData.sent_at : null, created_at: now });
    const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
    await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', req.business.id);
  }
  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
  res.json({ customer: { id: customer.id, stage: 'reviewed' }, reviewsReceived: count || 0 });
});

router.post('/customers/:id/feedback', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  if (customer.stage !== 'negative') return res.status(400).json({ error: `Cannot submit feedback from stage "${customer.stage}"` });
  const { complaint, name, phone } = req.body || {};
  const text = (complaint && String(complaint).trim()) || customer.complaint || '';
  const now = new Date().toISOString();
  const { data: existing } = await db.from('feedback').select('*').eq('customer_id', customer.id).single();
  if (!existing) {
    await db.from('feedback').insert({ id: `fb_${customer.id}`, business_id: req.business.id, customer_id: customer.id, customer_name: customer.name, phone: customer.phone, complaint: text, created_at: now, submitted_at: now });
  } else {
    await db.from('feedback').update({ complaint: text, customer_name: name ? String(name).trim() : customer.name, phone: phone ? String(phone).trim() : customer.phone, submitted_at: now }).eq('id', existing.id);
  }
  await db.from('customers').update({ complaint: text }).eq('id', customer.id);
  res.json({ feedback: existing || { id: `fb_${customer.id}`, complaint: text }, customer: { id: customer.id, stage: 'negative' } });
});

router.post('/customers/:id/reset', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  await db.from('customers').update({ stage: 'to_send', sentiment: null, complaint: '' }).eq('id', customer.id);
  await db.from('feedback').delete().eq('customer_id', customer.id);
  await db.from('reviews').delete().eq('customer_id', customer.id);
  await db.from('requests').update({ status: 'Scheduled', reaction: null, opened_at: null, reviewed_at: null }).eq('customer_id', customer.id);
  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
  await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', req.business.id);
  res.json({ customer: { id: customer.id, stage: 'to_send' }, reviewsReceived: count || 0 });
});

router.put('/customers/:id', auth, async (req, res) => {
  const db = getDb();
  const { data: custData } = await db.from('customers').select('*').eq('id', req.params.id).eq('business_id', req.business.id).single();
  if (!custData) return res.status(404).json({ error: 'Customer not found' });
  const customer = mapCustomer(custData);
  const { name, phone, customMessage } = req.body || {};
  const updates = {};
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof phone === 'string' && phone.trim()) updates.phone = phone.trim();
  if (typeof customMessage === 'string') updates.custom_message = customMessage;
  if (Object.keys(updates).length > 0) await db.from('customers').update(updates).eq('id', customer.id);
  const updated = { ...customer, ...updates };
  res.json({ customer: { id: updated.id, name: updated.name, phone: updated.phone, customMessage: updated.customMessage || updated.custom_message || '', hasCustomMessage: !!(updated.customMessage || updated.custom_message), stage: updated.stage, sentiment: updated.sentiment } });
});

router.post('/render', auth, async (req, res) => {
  const db = getDb();
  const { customerId, template, customerName } = req.body || {};
  let customer = null;
  if (customerId) {
    const { data } = await db.from('customers').select('*').eq('id', customerId).eq('business_id', req.business.id).single();
    if (data) customer = mapCustomer(data);
  }
  const effectiveTemplate = template && template.trim()
    ? template
    : (customer && customer.customMessage && customer.customMessage.trim()) ? customer.customMessage : req.business.messageTemplate;
  const message = renderTemplate(effectiveTemplate, { customerName: customerName || customer?.name || req.body?.fallbackName || 'Rahul Sharma', businessName: req.business.name, reviewLink: req.business.googleReviewLink });
  res.json({ message, usingOverride: !!(customer && customer.customMessage && customer.customMessage.trim() && !template) });
});

router.get('/feedback', auth, async (req, res) => {
  const list = await getFeedbackForBusiness(req.business.id);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ feedback: list, total: list.length });
});

router.get('/reviews', auth, async (req, res) => {
  const list = await getReviewsForBusiness(req.business.id);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reviews: list, total: list.length });
});

router.post('/reviews', auth, async (req, res) => {
  const db = getDb();
  const { customerId, customerName, rating } = req.body || {};
  const review = { id: newId('rev'), business_id: req.business.id, customer_id: customerId || null, customer_name: customerName || null, rating: Number.isFinite(Number(rating)) ? Number(rating) : 5, request_id: null, sent_at: null, created_at: new Date().toISOString() };
  await db.from('reviews').insert(review);
  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
  await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', req.business.id);
  res.json({ review: mapReview(review), total: count || 0 });
});

router.delete('/reviews/last', auth, async (req, res) => {
  const db = getDb();
  const { data: mine } = await db.from('reviews').select('*').eq('business_id', req.business.id).order('created_at', { ascending: false }).limit(1);
  if (!mine || mine.length === 0) return res.status(404).json({ error: 'No reviews to remove' });
  await db.from('reviews').delete().eq('id', mine[0].id);
  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
  await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', req.business.id);
  res.json({ ok: true });
});

router.get('/reviews/list', auth, async (req, res) => {
  const biz = req.business;
  const reviews = await getReviewsForBusiness(biz.id);
  const positive = reviews.filter((r) => (r.rating || 5) >= 4).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((r) => ({ id: r.id, customerName: r.customerName || 'Anonymous', rating: r.rating, text: r.text || '', source: r.source || 'internal', createdAt: r.createdAt, isRead: !!r.isRead }));
  const negativeFromReviews = reviews.filter((r) => (r.rating || 5) < 4).map((r) => ({ id: r.id, customerName: r.customerName || 'Anonymous', rating: r.rating, text: r.text || '', source: r.source || 'google', createdAt: r.createdAt, isRead: !!r.isRead, aiFlag: r.aiFlag || null, aiIssueId: r.aiIssueId || null }));
  const feedbackList = await getFeedbackForBusiness(biz.id);
  const negativeFromFeedback = feedbackList.map((f) => ({ id: f.id, customerName: f.customerName || 'Anonymous', rating: null, text: f.complaint || '', source: 'internal', createdAt: f.createdAt, isRead: true, aiFlag: null, aiIssueId: null }));
  const negative = [...negativeFromReviews, ...negativeFromFeedback].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ positive, negative });
});

router.get('/reviews/all', auth, async (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const per = 20;
  const { data, count } = await db.from('reviews').select('*', { count: 'exact' }).eq('business_id', req.business.id).order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1);
  res.json({ reviews: (data || []).map(mapReview), total: count || 0, page, perPage: per, pages: Math.ceil((count || 0) / per) });
});

router.post('/reviews/:id/read', auth, async (req, res) => {
  const db = getDb();
  await db.from('reviews').update({ is_read: true }).eq('id', req.params.id).eq('business_id', req.business.id);
  res.json({ ok: true });
});

router.get('/reviews/summaries', auth, async (req, res) => {
  const db = getDb();
  const { data } = await db.from('review_summaries').select('*').eq('business_id', req.business.id).order('created_at', { ascending: false }).limit(10);
  const list = (data || []).map(mapReviewSummary);
  res.json({ summaries: list, current: list[0] || null });
});

router.post('/reviews/summaries/:id/read', auth, async (req, res) => {
  const db = getDb();
  await db.from('review_summaries').update({ is_read: true }).eq('id', req.params.id).eq('business_id', req.business.id);
  res.json({ ok: true });
});

router.post('/reviews/summaries/issues/:issueId/read', auth, async (req, res) => {
  const db = getDb();
  const current = await getCurrentSummaryRow(req.business.id);
  if (!current) return res.status(404).json({ error: 'No insights yet' });
  const issues = issuesFromRow(current).map((i) => (i.id === req.params.issueId ? { ...i, is_read: true } : i));
  await db.from('review_summaries').update({ issues }).eq('id', current.id);
  res.json({ ok: true });
});

// Weekly cron: Vercel Cron calls GET /api/cron/weekly with Authorization: Bearer $CRON_SECRET
router.get('/cron/weekly', async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  if (secret) {
    const authz = req.headers.authorization || '';
    if (authz !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  }
  const db = getDb();
  const { data: businesses } = await db.from('businesses').select('id').eq('approval_status', 'approved');
  const results = [];
  for (const b of (businesses || [])) {
    try {
      const r = await weeklyUpdateBusiness(b.id);
      results.push({ businessId: b.id, ...r });
    } catch (e) { results.push({ businessId: b.id, error: e.message }); }
  }
  res.json({ ok: true, results });
});

async function getValidGoogleAccessToken(business) {
  if (!business.googleAccessToken) return null;
  const expiresAt = business.googleTokenExpiresAt ? new Date(business.googleTokenExpiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60000) return business.googleAccessToken;
  const refreshToken = business.googleRefreshToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return business.googleAccessToken;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const d = await r.json();
    if (!r.ok || !d.access_token) return business.googleAccessToken;
    const newExpiresAt = new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString();
    const db = getDb();
    await db.from('businesses').update({ google_access_token: d.access_token, google_token_expires_at: newExpiresAt }).eq('id', business.id);
    business.googleAccessToken = d.access_token;
    business.googleTokenExpiresAt = newExpiresAt;
    return d.access_token;
  } catch { return business.googleAccessToken; }
}

router.post('/reviews/google/sync', auth, async (req, res) => {
  const db = getDb();
  const biz = req.business;
  // Prefer per-business OAuth token; fallback to legacy Places API key only if OAuth not connected
  const hasOAuth = !!biz.googleConnected && !!biz.googleAccessToken;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!biz.placeId) {
    return res.json({ connected: false, message: 'No Google Place ID is set for this business yet — add it in Settings.' });
  }
  if (!hasOAuth && !apiKey) {
    return res.json({ connected: false, message: hasOAuth ? 'Google account connected but token missing — reconnect in onboarding.' : 'Google not connected — complete onboarding to connect your Business Profile.' });
  }
  try {
    let accessToken = null;
    if (hasOAuth) accessToken = await getValidGoogleAccessToken(biz);
    let url;
    let headers = {};
    if (hasOAuth && accessToken) {
      // Use OAuth token to call Places Details (still works with Bearer, key param optional)
      url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(biz.placeId)}&fields=review,rating,user_ratings_total`;
      headers = { Authorization: `Bearer ${accessToken}` };
      // also include API key if available as fallback param
      if (apiKey) url += `&key=${apiKey}`;
    } else {
      url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(biz.placeId)}&fields=review,rating,user_ratings_total&key=${apiKey}`;
    }
    const resp = await fetch(url, { headers });
    const data = await resp.json();
    if (data.status !== 'OK') return res.json({ connected: false, message: `Google API error: ${data.status}` });
    const googleReviews = data.result?.reviews || [];
    let added = 0;
    for (const gr of googleReviews) {
      const googleReviewId = `g_${gr.author_name}_${gr.time}`;
      const { data: existingReview } = await db.from('reviews').select('*').eq('google_review_id', googleReviewId).limit(1).single();
      const { data: existingFeedback } = await db.from('feedback').select('*').eq('google_review_id', googleReviewId).limit(1).single();
      if (existingReview || existingFeedback) continue;
      const createdAt = new Date(gr.time * 1000).toISOString();
      const newRevId = newId('rev');
      await db.from('reviews').insert({ id: newRevId, business_id: biz.id, customer_id: null, customer_name: gr.author_name, rating: gr.rating, text: gr.text || '', source: 'google', google_review_id: googleReviewId, request_id: null, sent_at: null, created_at: createdAt, is_read: false, ai_flag: null, ai_issue_id: null });
      if (gr.rating < 4) {
        await db.from('feedback').insert({ id: newId('fb'), business_id: biz.id, customer_id: null, customer_name: gr.author_name, phone: '', complaint: gr.text || `${gr.rating}★ Google review`, google_review_id: googleReviewId, created_at: createdAt });
        // immediate one-off AI classification (never blocks sync)
        try {
          await classifyOneReview(biz.id, { id: newRevId, rating: gr.rating, text: gr.text || '' });
        } catch (e) { console.error('immediate AI classify failed (retry on cron):', e.message); }
      }
      added++;
    }
    const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('rating', 4);
    await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', biz.id);
    res.json({ connected: true, added, total: googleReviews.length });
  } catch (err) {
    res.json({ connected: false, message: `Could not reach Google: ${err.message}` });
  }
});

router.get('/pending-sends/failed', auth, async (req, res) => {
  const db = getDb();
  const list = await getFailedSends(req.business.id);
  const customersList = await getCustomersForBusiness(req.business.id);
  const customerMap = new Map(customersList.map(c => [c.id, c]));
  res.json({ failed: list.map((s) => ({ id: s.id, customerId: s.customerId, phone: s.phone, error: s.error, retryCount: s.retryCount, customerName: customerMap.get(s.customerId)?.name || s.phone })) });
});

router.post('/pending-sends/:id/retry', auth, async (req, res) => {
  const row = await retrySend(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pending send not found' });
  res.json({ ok: true, status: row.status });
});

router.get('/analytics', auth, async (req, res) => {
  const biz = req.business;
  const reqs = await getRequestsForBusiness(biz.id);
  const reviews = await getReviewsForBusiness(biz.id);
  const customers = await getCustomersForBusiness(biz.id);
  const feedback = await getFeedbackForBusiness(biz.id);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const reviewsThisMonth = reviews.filter((r) => { const d = new Date(r.createdAt); return d.getFullYear() === thisYear && d.getMonth() === thisMonth; }).length;
  const reviewsLastMonth = reviews.filter((r) => { const d = new Date(r.createdAt); return d.getFullYear() === lastYear && d.getMonth() === lastMonth; }).length;
  const momPct = reviewsLastMonth ? Math.round(((reviewsThisMonth - reviewsLastMonth) / reviewsLastMonth) * 1000) / 10 : (reviewsThisMonth ? 100 : 0);

  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
    const upper = i === 0 ? now : weekEnd;
    const inWeek = reviews.filter((r) => { const d = new Date(r.createdAt); return d >= weekStart && d < upper; });
    const positive = inWeek.filter((r) => (r.rating || 5) >= 4).length;
    const negative = inWeek.filter((r) => (r.rating || 5) < 4).length;
    weeks.push({ label: `W${12 - i}`, count: inWeek.length, positive, negative });
  }

  const dow = [0, 0, 0, 0, 0, 0, 0];
  for (const r of reviews) dow[new Date(r.createdAt).getDay()]++;

  const linked = reviews.filter((r) => r.sentAt && r.createdAt);
  let avgTimeToReview = null;
  if (linked.length) {
    const totalMs = linked.reduce((sum, r) => sum + (new Date(r.createdAt) - new Date(r.sentAt)), 0);
    avgTimeToReview = Math.round(totalMs / linked.length / 3600000);
  }

  const sent = reqs.filter((r) => r.status !== 'Scheduled').length;
  const opened = reqs.filter((r) => r.status === 'Opened' || r.status === 'Reviewed').length;
  const reviewed = reviews.length;
  const funnel = { sent, opened, reviewed, sentToOpenedPct: sent ? Math.round((opened / sent) * 1000) / 10 : 0, openedToReviewedPct: opened ? Math.round((reviewed / opened) * 1000) / 10 : 0, sentToReviewedPct: sent ? Math.round((reviewed / sent) * 1000) / 10 : 0 };

  const positives = customers.filter((c) => c.sentiment === 'positive').length;
  const negatives = customers.filter((c) => c.sentiment === 'negative').length;
  const totalReacted = positives + negatives;
  const positiveRate = totalReacted ? Math.round((positives / totalReacted) * 1000) / 10 : 0;

  const sentimentWeeks = [];
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
    const upper = i === 0 ? now : weekEnd;
    const pos = customers.filter((c) => { if (c.sentiment !== 'positive') return false; const d = new Date(c.reactedAt || c.createdAt); return d >= weekStart && d < upper; }).length;
    const neg = customers.filter((c) => { if (c.sentiment !== 'negative') return false; const d = new Date(c.reactedAt || c.createdAt); return d >= weekStart && d < upper; }).length;
    const tot = pos + neg;
    sentimentWeeks.push({ label: `W${12 - i}`, positive: pos, negative: neg, rate: tot ? Math.round((pos / tot) * 1000) / 10 : null });
  }

  const keptOffGoogleThisMonth = feedback.filter((f) => { const d = new Date(f.createdAt); return d.getFullYear() === thisYear && d.getMonth() === thisMonth; }).length;
  const recentFeedback = feedback.slice(0, 8).map((f) => ({ id: f.id, customerName: f.customerName, phone: f.phone, complaint: f.complaint, date: f.createdAt }));

  res.json({ total: reviews.length, reviewsThisMonth, reviewsLastMonth, momPct, weeks, dow, dowLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], avgTimeToReview, funnel, sentiment: { positives, negatives, totalReacted, positiveRate, weeks: sentimentWeeks, keptOffGoogleThisMonth, recentFeedback } });
});

router.get('/activity', auth, async (req, res) => {
  const db = getDb();
  const { data } = await db.from('activities').select('*').eq('business_id', req.business.id).order('created_at', { ascending: false }).limit(30);
  res.json({ activities: (data || []).map(mapActivity) });
});

router.get('/settings', auth, (req, res) => {
  const b = req.business;
  res.json({ businessName: b.name, googleReviewLink: b.googleReviewLink, feedbackLink: b.feedbackLink, messageTemplate: b.messageTemplate, delaySeconds: b.delaySeconds, demoMode: b.demoMode, reviewsReceived: b.reviewsReceived || 0, placeId: b.placeId || '', whatsappStatus: b.whatsapp?.status || 'not_connected', whatsappBsp: b.whatsapp?.bsp || '', onboardingCompleted: !!b.onboardingCompleted, isDemo: !!b.isDemo, googleConnected: !!b.googleConnected });
});

router.put('/settings', auth, async (req, res) => {
  const db = getDb();
  const b = req.business;
  const { businessName, googleReviewLink, feedbackLink, messageTemplate, delaySeconds, demoMode, placeId } = req.body || {};
  const updates = {};
  if (typeof businessName === 'string' && businessName.trim()) updates.name = businessName.trim();
  if (typeof googleReviewLink === 'string') updates.google_review_link = googleReviewLink.trim();
  if (typeof feedbackLink === 'string') updates.feedback_link = feedbackLink.trim();
  if (typeof messageTemplate === 'string' && messageTemplate.trim()) updates.message_template = messageTemplate.trim();
  if (Number.isFinite(Number(delaySeconds))) updates.delay_seconds = Number(delaySeconds);
  if (typeof demoMode === 'boolean') updates.demo_mode = demoMode;
  if (typeof placeId === 'string') updates.place_id = placeId.trim();
  if (Object.keys(updates).length > 0) await db.from('businesses').update(updates).eq('id', b.id);
  const updated = { ...b, ...updates };
  res.json({ businessName: updated.name, googleReviewLink: updated.googleReviewLink, feedbackLink: updated.feedbackLink, messageTemplate: updated.messageTemplate, delaySeconds: updated.delaySeconds, demoMode: updated.demoMode, reviewsReceived: updated.reviewsReceived || 0, placeId: updated.placeId || '', whatsappStatus: updated.whatsapp?.status || 'not_connected', whatsappBsp: updated.whatsapp?.bsp || '' });
});

router.get('/message-preview', auth, (req, res) => {
  const b = req.business;
  const message = renderTemplate(b.messageTemplate, { customerName: 'Rahul Sharma', businessName: b.name, reviewLink: b.googleReviewLink });
  res.json({ message, effectiveDelay: effectiveDelay(b) });
});

// --- Onboarding gate ---
router.get('/onboarding/status', auth, async (req, res) => {
  const b = req.business;
  res.json({
    onboardingCompleted: !!b.onboardingCompleted,
    googleConnected: !!b.googleConnected,
    googleAccountEmail: b.googleAccountEmail || null,
    whatsappConnected: b.whatsapp?.status === 'connected',
    whatsappBsp: b.whatsapp?.bsp || null,
    approvalStatus: b.approvalStatus || 'pending_approval',
    preApproved: !!b.preApproved,
    isRejected: b.approvalStatus === 'rejected',
  });
});

router.post('/onboarding/whatsapp', auth, async (req, res) => {
  const db = getDb();
  const { apiKey, phoneNumberId } = req.body || {};
  if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: 'AiSensy API key is required' });
  await db.from('businesses').update({
    whatsapp_api_key: String(apiKey).trim(),
    whatsapp_bsp: 'AiSensy',
    whatsapp_phone_number_id: phoneNumberId ? String(phoneNumberId).trim() : '',
    whatsapp_status: 'connected',
  }).eq('id', req.business.id);
  const updated = await getBusiness(req.business.id);
  const isApproved = updated.approvalStatus === 'approved';
  if (updated.googleConnected && updated.whatsapp.status === 'connected' && isApproved) {
    await db.from('businesses').update({ onboarding_completed: true }).eq('id', req.business.id);
  }
  res.json({ ok: true, whatsappConnected: true, approvalStatus: updated.approvalStatus });
});

router.get('/auth/google', async (req, res) => {
  // Allow token via query ?token= for browser redirects where header isn't sent, fallback to header
  let businessId = null;
  const qToken = req.query.token;
  const header = req.headers.authorization || '';
  const hToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = qToken || hToken;
  if (token) {
    const db = getDb();
    const { data: sess } = await db.from('sessions').select('*').eq('token', token).single();
    if (sess) businessId = sess.business_id;
  }
  if (!businessId && req.business) businessId = req.business.id;
  if (!businessId) return res.status(401).json({ error: 'Unauthorized — login first' });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI env vars.' });
  }
  const state = businessId;
  const scope = encodeURIComponent('https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/userinfo.email');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return res.status(500).send('Google OAuth not configured');
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return res.status(400).send('Token exchange failed: ' + JSON.stringify(tokenData));
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    let accountEmail = null;
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
      const info = await infoRes.json();
      accountEmail = info.email || null;
    } catch {}

    const db = getDb();
    const businessId = String(state);
    const existingBiz = await getBusiness(businessId);
    const updates = {
      google_access_token: accessToken,
      google_refresh_token: refreshToken || null,
      google_token_expires_at: expiresAt,
      google_connected: true,
      google_account_email: accountEmail,
    };
    // Handle pre-approved: auto-approve after Google connect
    if (existingBiz && existingBiz.preApproved) {
      updates.approval_status = 'approved';
      updates.approved_at = new Date().toISOString();
      updates.rejected_at = null;
    } else if (existingBiz && existingBiz.approvalStatus === 'pending_approval') {
      // keep pending for manual approval, don't auto-approve
    }
    await db.from('businesses').update(updates).eq('id', businessId);

    const biz = await getBusiness(businessId);
    const isApproved = biz && biz.approvalStatus === 'approved';
    if (biz && biz.whatsapp.status === 'connected' && isApproved) {
      await db.from('businesses').update({ onboarding_completed: true }).eq('id', businessId);
    }

    const frontendBase = process.env.FRONTEND_URL || req.headers.referer || '/onboarding';
    // redirect to frontend onboarding with success flag
    const redirectTo = (frontendBase.includes('localhost') ? 'http://localhost:4000/onboarding?google=success' : '/onboarding?google=success');
    res.redirect(redirectTo);
  } catch (e) {
    res.status(500).send('OAuth callback failed: ' + e.message);
  }
});

router.post('/onboarding/complete', auth, async (req, res) => {
  const b = req.business;
  if (!b.googleConnected) return res.status(400).json({ error: 'Google not connected yet' });
  if (b.whatsapp?.status !== 'connected') return res.status(400).json({ error: 'WhatsApp not connected yet' });
  if (b.approvalStatus !== 'approved') return res.status(400).json({ error: 'Waiting for admin approval' });
  const db = getDb();
  await db.from('businesses').update({ onboarding_completed: true }).eq('id', b.id);
  res.json({ ok: true, onboardingCompleted: true });
});

router.post('/reviews/increment', auth, async (req, res) => {
  const db = getDb();
  await db.from('reviews').insert({ id: newId('rev'), business_id: req.business.id, customer_id: null, customer_name: null, rating: 5, request_id: null, sent_at: null, created_at: new Date().toISOString() });
  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
  await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', req.business.id);
  res.json({ reviewsReceived: count || 0 });
});

router.post('/reviews/decrement', auth, async (req, res) => {
  const db = getDb();
  const { data: mine } = await db.from('reviews').select('*').eq('business_id', req.business.id).order('created_at', { ascending: false }).limit(1);
  if (mine && mine.length > 0) await db.from('reviews').delete().eq('id', mine[0].id);
  const { count } = await db.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', req.business.id);
  await db.from('businesses').update({ reviews_received: count || 0 }).eq('id', req.business.id);
  res.json({ reviewsReceived: count || 0 });
});

router.get('/admin/businesses', adminAuth, async (req, res) => {
  const db = getDb();
  const { data: businesses } = await db.from('businesses').select('*');
  const list = [];
  for (const b of (businesses || [])) {
    const { count: reqCount } = await db.from('requests').select('*', { count: 'exact', head: true }).eq('business_id', b.id).neq('status', 'Scheduled');
    const { count: custCount } = await db.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', b.id);
    list.push({
      id: b.id, name: b.name, ownerEmail: b.owner_email, subscriptionStatus: b.subscription_status, isDemo: !!b.is_demo,
      requestsSent: reqCount || 0, customersCount: custCount || 0, createdAt: b.created_at,
      whatsapp: { bsp: b.whatsapp_bsp || '', status: b.whatsapp_status || 'not_connected', phoneNumberId: b.whatsapp_phone_number_id || '' },
      placeId: b.place_id || '', googleReviewLink: b.google_review_link || '',
    });
  }
  res.json({ businesses: list });
});

router.post('/admin/businesses', adminAuth, async (req, res) => {
  const db = getDb();
  const { name, ownerEmail, password, googleReviewLink } = req.body || {};
  if (!name || !ownerEmail || !password) return res.status(400).json({ error: 'name, ownerEmail and password are required' });
  const { data: existing } = await db.from('businesses').select('*').eq('owner_email', ownerEmail).single();
  if (existing) return res.status(409).json({ error: 'A business with that owner email already exists' });
  const business = {
    id: newId('biz'), name: String(name).trim(), owner_email: String(ownerEmail).trim(), password: hashPassword(password), is_demo: false,
    google_review_link: googleReviewLink ? String(googleReviewLink).trim() : '', feedback_link: '', address: '', phone: '', description: '',
    message_template: defaultTemplate, delay_seconds: 7200, demo_mode: false, subscription_status: 'trial', created_at: new Date().toISOString(),
    reviews_received: 0, place_id: '', whatsapp_bsp: '', whatsapp_api_key: '', whatsapp_phone_number_id: '', whatsapp_status: 'not_connected',
    google_access_token: null, google_refresh_token: null, google_token_expires_at: null, google_connected: false, google_account_email: null, onboarding_completed: false,
  };
  await db.from('businesses').insert(business);
  res.json({ business: { id: business.id, name: business.name, ownerEmail: business.owner_email } });
});

router.delete('/admin/businesses/:id', adminAuth, async (req, res) => {
  const db = getDb();
  const { data: business } = await db.from('businesses').select('*').eq('id', req.params.id).single();
  if (!business) return res.status(404).json({ error: 'Business not found' });
  if (business.is_demo) return res.status(400).json({ error: 'The demo account cannot be removed' });
  const id = business.id;
  await db.from('customers').delete().eq('business_id', id);
  await db.from('requests').delete().eq('business_id', id);
  await db.from('reviews').delete().eq('business_id', id);
  await db.from('feedback').delete().eq('business_id', id);
  await db.from('activities').delete().eq('business_id', id);
  await db.from('pending_sends').delete().eq('business_id', id);
  await db.from('sessions').delete().eq('business_id', id);
  await db.from('businesses').delete().eq('id', id);
  res.json({ ok: true });
});

// --- Admin: invite-by-email ---
router.post('/admin/invites', adminAuth, async (req, res) => {
  const db = getDb();
  const { email, businessName } = req.body || {};
  if (!email || !String(email).trim()) return res.status(400).json({ error: 'email is required' });
  const em = String(email).trim().toLowerCase();
  const { data: existing } = await db.from('invited_emails').select('*').eq('email', em).single();
  if (existing && !existing.used) return res.status(409).json({ error: 'Email already invited and unused' });
  const row = { id: newId('inv'), email: em, business_name: businessName ? String(businessName).trim() : '', invited_at: new Date().toISOString(), used: false };
  await db.from('invited_emails').insert(row);
  res.json({ invite: row });
});

router.get('/admin/invites', adminAuth, async (req, res) => {
  const db = getDb();
  const { data } = await db.from('invited_emails').select('*').order('invited_at', { ascending: false });
  res.json({ invites: data || [] });
});

router.get('/admin/requests', adminAuth, async (req, res) => {
  const db = getDb();
  const { data } = await db.from('businesses').select('*').eq('approval_status', 'pending_approval').order('created_at', { ascending: false });
  const list = (data || []).map(b => ({ id: b.id, name: b.name, ownerEmail: b.owner_email, googleAccountEmail: b.google_account_email, googleConnected: !!b.google_connected, createdAt: b.created_at, approvalStatus: b.approval_status }));
  res.json({ requests: list });
});

router.post('/admin/businesses/:id/approve', adminAuth, async (req, res) => {
  const db = getDb();
  const { data: b } = await db.from('businesses').select('*').eq('id', req.params.id).single();
  if (!b) return res.status(404).json({ error: 'Business not found' });
  await db.from('businesses').update({ approval_status: 'approved', approved_at: new Date().toISOString(), rejected_at: null }).eq('id', req.params.id);
  // FIRST RUN: generate initial issues list from trailing 12 months (fire-and-forget, never blocks approval)
  (async () => {
    try {
      const since = new Date(Date.now() - 365 * 86400000).toISOString();
      const { data } = await db.from('reviews').select('*').eq('business_id', req.params.id).lt('rating', 4).gte('created_at', since).order('created_at', { ascending: true }).limit(200);
      const negatives = (data || []).filter((r) => !r.ai_flag).map((r) => ({ id: r.id, rating: r.rating, text: r.text }));
      if (negatives.length) await firstRunClustering(req.params.id, negatives);
      else {
        const cur = await getCurrentSummaryRow(req.params.id);
        if (!cur) {
          await db.from('review_summaries').insert({ id: newId('sum'), business_id: req.params.id, period_start: since, period_end: new Date().toISOString(), summary_text: '', areas_of_improvement: '', review_count: 0, is_read: false, created_at: new Date().toISOString(), issues: [] });
        }
      }
    } catch (e) { console.error('first-run AI failed (retry on cron):', e.message); }
  })();
  res.json({ ok: true });
});

router.post('/admin/businesses/:id/reject', adminAuth, async (req, res) => {
  const db = getDb();
  const { data: b } = await db.from('businesses').select('*').eq('id', req.params.id).single();
  if (!b) return res.status(404).json({ error: 'Business not found' });
  await db.from('businesses').update({ approval_status: 'rejected', rejected_at: new Date().toISOString(), approved_at: null }).eq('id', req.params.id);
  res.json({ ok: true });
});

// --- Public signup (replaces admin creates password) ---
router.post('/signup', async (req, res) => {
  const db = getDb();
  const { email, password, businessName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const em = String(email).trim().toLowerCase();
  const { data: existingBiz } = await db.from('businesses').select('*').eq('owner_email', em).single();
  if (existingBiz) return res.status(409).json({ error: 'An account with that email already exists' });
  // check invited_emails
  const { data: invite } = await db.from('invited_emails').select('*').eq('email', em).eq('used', false).single();
  let preApproved = false;
  if (invite) {
    preApproved = true;
    await db.from('invited_emails').update({ used: true }).eq('id', invite.id);
  }
  const business = {
    id: newId('biz'), name: businessName ? String(businessName).trim() : em.split('@')[0], owner_email: em, password: hashPassword(password), is_demo: false,
    google_review_link: '', feedback_link: '', address: '', phone: '', description: '',
    message_template: defaultTemplate, delay_seconds: 1800, demo_mode: false, subscription_status: 'trial', created_at: new Date().toISOString(),
    reviews_received: 0, place_id: '', whatsapp_bsp: '', whatsapp_api_key: '', whatsapp_phone_number_id: '', whatsapp_status: 'not_connected',
    google_access_token: null, google_refresh_token: null, google_token_expires_at: null, google_connected: false, google_account_email: null, onboarding_completed: false,
    approval_status: 'pending_approval', pre_approved: preApproved, approved_at: null, rejected_at: null,
  };
  // if pre-approved, we will approve after Google connect, not immediately - keep pending for now, but mark pre_approved
  await db.from('businesses').insert(business);
  const token = newToken();
  await db.from('sessions').insert({ token, business_id: business.id, created_at: new Date().toISOString() });
  const mapped = await getBusiness(business.id);
  res.json({ token, business: publicBusiness(mapped) });
});

router.put('/admin/businesses/:id/whatsapp', adminAuth, async (req, res) => {
  const db = getDb();
  const { data: business } = await db.from('businesses').select('*').eq('id', req.params.id).single();
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const { bsp, apiKey, phoneNumberId, status } = req.body || {};
  const updates = {};
  if (typeof bsp === 'string') updates.whatsapp_bsp = bsp.trim();
  if (typeof apiKey === 'string' && apiKey.trim()) updates.whatsapp_api_key = apiKey.trim();
  if (typeof phoneNumberId === 'string') updates.whatsapp_phone_number_id = phoneNumberId.trim();
  updates.whatsapp_status = status || (apiKey ? 'connected' : (business.whatsapp_status || 'not_connected'));
  await db.from('businesses').update(updates).eq('id', req.params.id);
  res.json({ whatsapp: { bsp: updates.whatsapp_bsp || business.whatsapp_bsp, status: updates.whatsapp_status, phoneNumberId: updates.whatsapp_phone_number_id || business.whatsapp_phone_number_id } });
});

router.put('/admin/businesses/:id/google', adminAuth, async (req, res) => {
  const db = getDb();
  const { data: business } = await db.from('businesses').select('*').eq('id', req.params.id).single();
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const { placeId, googleReviewLink } = req.body || {};
  const updates = {};
  if (typeof placeId === 'string') updates.place_id = placeId.trim();
  if (typeof googleReviewLink === 'string' && googleReviewLink.trim()) updates.google_review_link = googleReviewLink.trim();
  if (Object.keys(updates).length > 0) await db.from('businesses').update(updates).eq('id', req.params.id);
  res.json({ placeId: updates.place_id || business.place_id, googleReviewLink: updates.google_review_link || business.google_review_link });
});

router.post('/reset-db', auth, async (req, res) => {
  const db = getDb();
  const fresh = (await import('./db.js')).buildSeedExport();
  // Clear all tables and reseed
  await db.from('activities').delete().neq('id', '__never_match__');
  await db.from('pending_sends').delete().neq('id', '__never_match__');
  await db.from('feedback').delete().neq('id', '__never_match__');
  await db.from('reviews').delete().neq('id', '__never_match__');
  await db.from('requests').delete().neq('id', '__never_match__');
  await db.from('customers').delete().neq('id', '__never_match__');
  await db.from('sessions').delete().neq('token', '__never_match__');
  await db.from('businesses').delete().neq('id', '__never_match__');

  for (const b of fresh.businesses) await db.from('businesses').insert(toBusinessRow(b));
  for (const c of fresh.customers) await db.from('customers').insert(toCustomerRow(c));
  for (const r of fresh.requests) await db.from('requests').insert(toRequestRow(r));
  for (const r of fresh.reviews) await db.from('reviews').insert(toReviewRow(r));
  for (const f of fresh.feedback) await db.from('feedback').insert(toFeedbackRow(f));
  for (const a of fresh.activities) await db.from('activities').insert(toActivityRow(a));

  resumeScheduledSends();
  res.json({ ok: true });
});

function toBusinessRow(obj) {
  return { id: obj.id, name: obj.name, owner_email: obj.ownerEmail, password: obj.passwordHash, is_demo: obj.isDemo, google_review_link: obj.googleReviewLink, feedback_link: obj.feedbackLink, address: obj.address, phone: obj.phone, description: obj.description, message_template: obj.messageTemplate, delay_seconds: obj.delaySeconds, demo_mode: obj.demoMode, subscription_status: obj.subscriptionStatus, created_at: obj.createdAt, place_id: obj.placeId, whatsapp_bsp: obj.whatsapp?.bsp || '', whatsapp_api_key: obj.whatsapp?.apiKey || '', whatsapp_phone_number_id: obj.whatsapp?.phoneNumberId || '', whatsapp_status: obj.whatsapp?.status || 'not_connected', reviews_received: obj.reviewsReceived || 0, google_access_token: obj.googleAccessToken || null, google_refresh_token: obj.googleRefreshToken || null, google_token_expires_at: obj.googleTokenExpiresAt || null, google_connected: !!obj.googleConnected, google_account_email: obj.googleAccountEmail || null, onboarding_completed: !!obj.onboardingCompleted, approval_status: obj.approvalStatus || 'pending_approval', pre_approved: !!obj.preApproved, approved_at: obj.approvedAt || null, rejected_at: obj.rejectedAt || null };
}
function toCustomerRow(obj) {
  return { id: obj.id, business_id: obj.businessId, name: obj.name, phone: obj.phone, custom_message: obj.customMessage || '', stage: obj.stage || 'to_send', sentiment: obj.sentiment || null, complaint: obj.complaint || '', created_at: obj.createdAt, last_request_at: obj.lastRequestAt, last_request_status: obj.lastRequestStatus };
}
function toRequestRow(obj) {
  return { id: obj.id, business_id: obj.businessId, customer_id: obj.customerId, customer_name: obj.customerName, phone: obj.phone, message: obj.message, status: obj.status, reaction: obj.reaction || null, feedback_text: obj.feedbackText || null, created_at: obj.createdAt, sent_at: obj.sentAt, opened_at: obj.openedAt, reviewed_at: obj.reviewedAt };
}
function toReviewRow(obj) {
  return { id: obj.id, business_id: obj.businessId, customer_id: obj.customerId, customer_name: obj.customerName, rating: obj.rating, text: obj.text || '', source: obj.source || 'internal', google_review_id: obj.googleReviewId || null, request_id: obj.requestId, sent_at: obj.sentAt, created_at: obj.createdAt, is_read: !!obj.isRead, ai_flag: obj.aiFlag || null, ai_issue_id: obj.aiIssueId || null };
}
function toFeedbackRow(obj) {
  return { id: obj.id, business_id: obj.businessId, customer_id: obj.customerId, customer_name: obj.customerName, phone: obj.phone, complaint: obj.complaint || '', google_review_id: obj.googleReviewId || null, created_at: obj.createdAt, submitted_at: obj.submittedAt || null };
}
function toActivityRow(obj) {
  return { id: obj.id, business_id: obj.businessId, type: obj.type, customer_name: obj.customerName, phone: obj.phone, message: obj.message, status: obj.status, created_at: obj.createdAt };
}

export default router;
