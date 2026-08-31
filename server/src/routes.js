import { Router } from 'express';
import { getDb, getBusiness, renderTemplate, hashPassword, verifyPassword, newToken, defaultTemplate } from './db.js';
import { auth, adminAuth, recordActivity, publicBusiness } from './auth.js';
import { enqueueSend, retrySend, getFailedSends } from './queue.js';

const router = Router();

const STAGES = ['to_send', 'sent', 'opened', 'positive', 'negative', 'reviewed'];

// Copy of the seeded quick-reply follow-up copy so the activity feed stays consistent.
function positiveFollowUp(link) {
  return `Awesome! 🙌 If you have 30 seconds, please leave us a Google review: ${link}`;
}
function negativeFollowUp(link) {
  return `We're really sorry to hear that. We'd love to make it right privately — please tell us what happened: ${link}`;
}

function effectiveDelay(business) {
  return business.demoMode ? 10 : Number(business.delaySeconds) || 7200;
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// Starter message tone presets the owner can pick from before customizing.
export const MESSAGE_PRESETS = [
  {
    id: 'casual',
    label: 'Casual',
    template: 'Hey [customer name]! Hope you enjoyed [business name] today 😄 Drop us a quick Google review if you can: [google review link]',
  },
  {
    id: 'warm',
    label: 'Warm / Thankful',
    template: 'Hi [customer name], thank you so much for visiting [business name]! We would be grateful if you shared your experience: [google review link]',
  },
  {
    id: 'first_time',
    label: 'First-time visitor',
    template: 'Welcome to [business name], [customer name]! We hope it was love at first bite. If so, a 30-second Google review would mean the world: [google review link]',
  },
];

// Render the message a customer would receive.
// Uses the customer's custom override if set, otherwise the global template.
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

function latestRequest(db, customerId) {
  return db.data.requests
    .filter((r) => r.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

// Build the WhatsApp conversation bubbles for a customer given their stage.
function renderConversation(business, customer, request) {
  const bubbles = [];
  const initialMsg = (request && request.message) ? request.message : render(business, customer);
  if (request && request.status !== 'Scheduled') {
    bubbles.push({ from: 'business', type: 'text', text: initialMsg });
  }
  const awaitingReaction = customer.stage === 'opened';
  if (awaitingReaction) {
    bubbles.push({
      from: 'business',
      type: 'quickreply',
      text: 'How was your experience?',
      buttons: [
        { label: '👍 Great', value: 'positive' },
        { label: '👎 Not great', value: 'negative' },
      ],
    });
  }
  if (customer.sentiment === 'positive') {
    bubbles.push({ from: 'customer', type: 'reaction', text: '👍 Great' });
    bubbles.push({
      from: 'business',
      type: 'link',
      text: positiveFollowUp(business.googleReviewLink),
    });
  } else if (customer.sentiment === 'negative') {
    bubbles.push({ from: 'customer', type: 'reaction', text: '👎 Not great' });
    bubbles.push({
      from: 'business',
      type: 'link',
      text: negativeFollowUp(business.feedbackLink),
    });
    const fb = db.data.feedback.find((f) => f.customerId === customer.id);
    if (fb && fb.complaint) {
      bubbles.push({ from: 'customer', type: 'text', text: fb.complaint, private: true });
    }
  }
  if (customer.stage === 'reviewed') {
    bubbles.push({ from: 'business', type: 'text', text: 'Thanks for the Google review! 🙌' });
  }
  return bubbles;
}

// Queue a simulated WhatsApp send for a customer, persisted in pending_sends so it
// survives server restarts. The poller (queue.startSendPoller) delivers it after
// the configured delay (or 10s in demo mode).
function enqueueCustomerSend(db, business, customer) {
  const message = render(business, customer);
  const delaySeconds = effectiveDelay(business);
  return enqueueSend(db, {
    businessId: business.id,
    customerId: customer.id,
    phone: customer.phone,
    message,
    delaySeconds,
  });
}

// Immediately send (used by "Send now"): enqueue with a 0s delay so it is delivered
// on the next poller tick, then nudge the poller to fire immediately for a snappy demo.
async function performSendNow(db, business, customer, request) {
  request.message = render(business, customer);
  await db.write();
  const message = request.message;
  const row = enqueueSend(db, {
    businessId: business.id,
    customerId: customer.id,
    phone: customer.phone,
    message,
    delaySeconds: 0,
  });
  if (global.__reviewbotPollNow) global.__reviewbotPollNow();
  return row;
}

// On boot, re-arm any pending rows from a previous run (poller handles delivery).
export function resumeScheduledSends() {
  // No-op: pending_sends are persisted on disk and resumed by queue.resumePendingSends().
}

function buildWeekly(db, businessId) {
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const label = `W${weeks.length + 1}`;
    const count = db.data.requests.filter((r) => {
      const d = new Date(r.createdAt);
      return r.businessId === businessId && d >= start && d < end;
    }).length;
    weeks.push({ label, count });
  }
  return weeks;
}

// --- Auth ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = getDb();
  const business = db.data.businesses.find((b) => b.ownerEmail === email);
  if (!business || !verifyPassword(password || '', business.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = newToken();
  db.data.sessions.push({ token, businessId: business.id, createdAt: new Date().toISOString() });
  await db.write();
  res.json({ token, business: publicBusiness(business) });
});

// Demo button on the login page — no credentials needed, always logs into the seeded
// demo business (isDemo: true) so a prospect can see the product before they sign up.
router.post('/login/demo', async (req, res) => {
  const db = getDb();
  const business = db.data.businesses.find((b) => b.isDemo);
  if (!business) return res.status(404).json({ error: 'Demo account not available' });
  const token = newToken();
  db.data.sessions.push({ token, businessId: business.id, createdAt: new Date().toISOString() });
  await db.write();
  res.json({ token, business: publicBusiness(business) });
});

router.post('/logout', auth, async (req, res) => {
  const db = getDb();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  db.data.sessions = db.data.sessions.filter((s) => s.token !== token);
  await db.write();
  res.json({ ok: true });
});

// --- Admin auth (separate from client business auth entirely) ---
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = getDb();
  const admin = db.data.admins.find((a) => a.email === email);
  if (!admin || !verifyPassword(password || '', admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = newToken();
  db.data.adminSessions.push({ token, adminId: admin.id, createdAt: new Date().toISOString() });
  await db.write();
  res.json({ token, admin: { id: admin.id, email: admin.email } });
});

router.post('/admin/logout', adminAuth, async (req, res) => {
  const db = getDb();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  db.data.adminSessions = db.data.adminSessions.filter((s) => s.token !== token);
  await db.write();
  res.json({ ok: true });
});

// --- Dashboard ---
router.get('/dashboard', auth, (req, res) => {
  const db = getDb();
  const biz = req.business;
  const reqs = db.data.requests.filter((r) => r.businessId === biz.id);
  const sent = reqs.filter((r) => r.status !== 'Scheduled').length;
  const received = biz.reviewsReceived || 0;
  const failedSends = getFailedSends(db, biz.id).map((s) => ({
    id: s.id,
    customerId: s.customerId,
    customerName: db.data.customers.find((c) => c.id === s.customerId)?.name || s.phone,
    phone: s.phone,
    error: s.error,
    retryCount: s.retryCount,
  }));
  const recent = [...reqs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map((r) => {
      const cust = db.data.customers.find((c) => c.id === r.customerId);
      return {
        id: r.id,
        customerName: r.customerName,
        phone: r.phone,
        status: r.status,
        reaction: r.reaction || null,
        hasCustomMessage: !!(cust && cust.customMessage && cust.customMessage.trim()),
        createdAt: r.createdAt,
      };
    });
  res.json({
    stats: {
      totalSent: sent,
      totalReceived: received,
      conversionRate: sent ? Math.round((received / sent) * 1000) / 10 : 0,
    },
    weekly: buildWeekly(db, biz.id),
    recent,
    failedSends,
  });
});

// --- Customers ---
router.get('/customers', auth, (req, res) => {
  const db = getDb();
  const list = db.data.customers
    .filter((c) => c.businessId === req.business.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      customMessage: c.customMessage || '',
      hasCustomMessage: !!(c.customMessage && c.customMessage.trim()),
      stage: c.stage || 'to_send',
      sentiment: c.sentiment || null,
      complaint: c.complaint || '',
      createdAt: c.createdAt,
      lastRequestAt: c.lastRequestAt,
      lastRequestStatus: c.lastRequestStatus,
    }));
  res.json({ customers: list });
});

router.get('/customers/:id', auth, (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const requests = db.data.requests
    .filter((r) => r.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const request = requests[0];
  const conversation = renderConversation(req.business, customer, request);
  res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      customMessage: customer.customMessage || '',
      hasCustomMessage: !!(customer.customMessage && customer.customMessage.trim()),
      stage: customer.stage || 'to_send',
      sentiment: customer.sentiment || null,
      complaint: customer.complaint || '',
      createdAt: customer.createdAt,
    },
    requests,
    conversation,
    config: {
      googleReviewLink: req.business.googleReviewLink,
      feedbackLink: req.business.feedbackLink,
      messageTemplate: req.business.messageTemplate,
    },
  });
});

function createCustomerAndSchedule(db, business, name, phone) {
  const customer = {
    id: newId('cust'),
    businessId: business.id,
    name,
    phone,
    customMessage: '',
    stage: 'to_send',
    sentiment: null,
    complaint: '',
    createdAt: new Date().toISOString(),
    lastRequestAt: null,
    lastRequestStatus: null,
  };
  db.data.customers.push(customer);

  const request = {
    id: newId('req'),
    businessId: business.id,
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    message: '',
    status: 'Scheduled',
    createdAt: new Date().toISOString(),
    sentAt: null,
    openedAt: null,
    reviewedAt: null,
  };
  db.data.requests.push(request);
  enqueueCustomerSend(db, business, customer);
  return { customer, request };
}

router.post('/customers', auth, async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
  const db = getDb();
  const { customer } = createCustomerAndSchedule(db, req.business, name.trim(), phone.trim());
  await db.write();
  res.json({ customer });
});

router.post('/customers/import', auth, async (req, res) => {
  const rows = Array.isArray(req.body?.customers) ? req.body.customers : [];
  const db = getDb();
  const added = [];
  const skipped = [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const phone = String(row.phone || '').trim();
    if (!name || !phone) { skipped.push(row); continue; }
    const { customer } = createCustomerAndSchedule(db, req.business, name, phone);
    added.push(customer);
  }
  await db.write();
  res.json({ added: added.length, skipped: skipped.length, customers: added });
});

// Send (or re-send) the initial WhatsApp outreach for a customer.
router.post('/customers/:id/send', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  let request = db.data.requests.find((r) => r.customerId === customer.id && r.status === 'Scheduled');
  if (!request) {
    request = {
      id: newId('req'),
      businessId: req.business.id,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      message: '',
      status: 'Scheduled',
      createdAt: new Date().toISOString(),
      sentAt: null,
      openedAt: null,
      reviewedAt: null,
    };
    db.data.requests.push(request);
  }
  await db.write();
  await performSendNow(db, req.business, customer, request);
  res.json({ request, customer: { id: customer.id, stage: customer.stage } });
});

// Simulate the customer opening the message.
router.post('/customers/:id/open', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.stage !== 'sent' && customer.stage !== 'to_send') {
    return res.status(400).json({ error: `Cannot open from stage "${customer.stage}"` });
  }
  const request = latestRequest(db, customer.id) || db.data.requests.find((r) => r.customerId === customer.id);
  if (request) {
    if (!request.openedAt) request.openedAt = new Date().toISOString();
    if (request.status === 'Sent') request.status = 'Opened';
  }
  customer.stage = 'opened';
  customer.lastRequestStatus = 'Opened';
  await db.write();
  res.json({ customer: { id: customer.id, stage: customer.stage } });
});

// Simulate the customer tapping a quick-reply (positive / negative).
router.post('/customers/:id/reply', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.stage !== 'opened') {
    return res.status(400).json({ error: `Cannot reply from stage "${customer.stage}"` });
  }
  const { reaction } = req.body || {};
  if (reaction !== 'positive' && reaction !== 'negative') {
    return res.status(400).json({ error: 'reaction must be "positive" or "negative"' });
  }
  const request = latestRequest(db, customer.id);
  if (request) request.reaction = reaction;
  customer.sentiment = reaction;
  customer.reactedAt = new Date().toISOString();
  customer.stage = reaction; // 'positive' or 'negative'

  if (reaction === 'negative') {
    customer.stage = 'negative';
    const existing = db.data.feedback.find((f) => f.customerId === customer.id);
    if (!existing) {
      db.data.feedback.push({
        id: `fb_${customer.id}`,
        businessId: req.business.id,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        complaint: customer.complaint || '',
        createdAt: customer.reactedAt,
      });
    } else {
      existing.createdAt = customer.reactedAt;
    }
    await recordActivity(db, req.business.id, {
      type: 'negative_reply',
      customerName: customer.name,
      phone: customer.phone,
      message: negativeFollowUp(req.business.feedbackLink),
      status: 'Negative',
    });
  } else {
    customer.stage = 'positive';
    await recordActivity(db, req.business.id, {
      type: 'positive_reply',
      customerName: customer.name,
      phone: customer.phone,
      message: positiveFollowUp(req.business.googleReviewLink),
      status: 'Positive',
    });
  }
  await db.write();
  res.json({ customer: { id: customer.id, stage: customer.stage, sentiment: customer.sentiment } });
});

// Positive path: customer leaves a Google review.
router.post('/customers/:id/review', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.stage !== 'positive') {
    return res.status(400).json({ error: `Cannot review from stage "${customer.stage}"` });
  }
  const request = latestRequest(db, customer.id);
  const now = new Date().toISOString();
  if (request) {
    request.status = 'Reviewed';
    if (!request.reviewedAt) request.reviewedAt = now;
  }
  customer.stage = 'reviewed';
  customer.reviewedGoogleAt = now;
  customer.lastRequestStatus = 'Reviewed';

  const already = db.data.reviews.find((r) => r.customerId === customer.id);
  if (!already) {
    db.data.reviews.push({
      id: `rev_${customer.id}`,
      businessId: req.business.id,
      customerId: customer.id,
      customerName: customer.name,
      rating: 5,
      requestId: request ? request.id : null,
      sentAt: request ? request.sentAt : null,
      createdAt: now,
    });
    req.business.reviewsReceived = db.data.reviews.filter((r) => r.businessId === req.business.id).length;
  }
  await db.write();
  res.json({ customer: { id: customer.id, stage: customer.stage }, reviewsReceived: req.business.reviewsReceived });
});

// Negative path: customer submits private feedback (kept off Google).
router.post('/customers/:id/feedback', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.stage !== 'negative') {
    return res.status(400).json({ error: `Cannot submit feedback from stage "${customer.stage}"` });
  }
  const { complaint, name, phone } = req.body || {};
  const text = (complaint && String(complaint).trim()) || customer.complaint || '';
  let fb = db.data.feedback.find((f) => f.customerId === customer.id);
  const now = new Date().toISOString();
  if (!fb) {
    fb = {
      id: `fb_${customer.id}`,
      businessId: req.business.id,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      complaint: '',
      createdAt: now,
    };
    db.data.feedback.push(fb);
  }
  fb.complaint = text;
  fb.customerName = name ? String(name).trim() : customer.name;
  fb.phone = phone ? String(phone).trim() : customer.phone;
  fb.submittedAt = now;
  customer.complaint = text;
  customer.stage = 'negative';
  await db.write();
  res.json({ feedback: fb, customer: { id: customer.id, stage: customer.stage } });
});

// Reset a customer back to the start of the pipeline (To Send).
router.post('/customers/:id/reset', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  customer.stage = 'to_send';
  customer.sentiment = null;
  customer.complaint = '';
  customer.reactedAt = null;
  customer.reviewedGoogleAt = null;
  db.data.feedback = db.data.feedback.filter((f) => f.customerId !== customer.id);
  const hadReview = db.data.reviews.some((r) => r.customerId === customer.id);
  db.data.reviews = db.data.reviews.filter((r) => r.customerId !== customer.id);
  if (hadReview) req.business.reviewsReceived = db.data.reviews.filter((r) => r.businessId === req.business.id).length;
  const reqs = db.data.requests.filter((r) => r.customerId === customer.id);
  for (const r of reqs) {
    r.status = 'Scheduled';
    r.reaction = null;
    r.openedAt = null;
    r.reviewedAt = null;
  }
  await db.write();
  res.json({ customer: { id: customer.id, stage: customer.stage }, reviewsReceived: req.business.reviewsReceived });
});

// Update a customer (name, phone, or custom message override).
router.put('/customers/:id', auth, async (req, res) => {
  const db = getDb();
  const customer = db.data.customers.find((c) => c.id === req.params.id && c.businessId === req.business.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const { name, phone, customMessage } = req.body || {};
  if (typeof name === 'string' && name.trim()) customer.name = name.trim();
  if (typeof phone === 'string' && phone.trim()) customer.phone = phone.trim();
  if (typeof customMessage === 'string') customer.customMessage = customMessage;
  await db.write();
  res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      customMessage: customer.customMessage,
      hasCustomMessage: !!(customer.customMessage && customer.customMessage.trim()),
      stage: customer.stage,
      sentiment: customer.sentiment,
    },
  });
});

// Render a message for a customer using their override (if any) — used for live preview.
router.post('/render', auth, async (req, res) => {
  const db = getDb();
  const { customerId, template, customerName } = req.body || {};
  let customer = null;
  if (customerId) {
    customer = db.data.customers.find((c) => c.id === customerId && c.businessId === req.business.id);
  }
  const effectiveTemplate = template && template.trim()
    ? template
    : (customer && customer.customMessage && customer.customMessage.trim())
      ? customer.customMessage
      : req.business.messageTemplate;
  const message = renderTemplate(effectiveTemplate, {
    customerName: customerName || customer?.name || req.body?.fallbackName || 'Rahul Sharma',
    businessName: req.business.name,
    reviewLink: req.business.googleReviewLink,
  });
  res.json({ message, usingOverride: !!(customer && customer.customMessage && customer.customMessage.trim() && !template) });
});

// --- Private feedback (owner-only, never shown on Google) ---
router.get('/feedback', auth, (req, res) => {
  const db = getDb();
  const list = db.data.feedback
    .filter((f) => f.businessId === req.business.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ feedback: list, total: list.length });
});

// --- Reviews (real records, computed analytics) ---
router.get('/reviews', auth, (req, res) => {
  const db = getDb();
  const list = db.data.reviews
    .filter((r) => r.businessId === req.business.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reviews: list, total: list.length });
});

// Manually log a review (used during the demo before Google integration).
router.post('/reviews', auth, async (req, res) => {
  const db = getDb();
  const { customerId, customerName, rating } = req.body || {};
  const review = {
    id: newId('rev'),
    businessId: req.business.id,
    customerId: customerId || null,
    customerName: customerName || null,
    rating: Number.isFinite(Number(rating)) ? Number(rating) : 5,
    requestId: null,
    sentAt: null,
    createdAt: new Date().toISOString(),
  };
  db.data.reviews.push(review);
  req.business.reviewsReceived = db.data.reviews.filter((r) => r.businessId === req.business.id).length;
  await db.write();
  res.json({ review, total: req.business.reviewsReceived });
});

// Remove the most recent review (undo a manual log).
router.delete('/reviews/last', auth, async (req, res) => {
  const db = getDb();
  const mine = db.data.reviews
    .filter((r) => r.businessId === req.business.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (mine.length === 0) return res.status(404).json({ error: 'No reviews to remove' });
  const last = mine[0];
  db.data.reviews = db.data.reviews.filter((r) => r.id !== last.id);
  req.business.reviewsReceived = db.data.reviews.filter((r) => r.businessId === req.business.id).length;
  await db.write();
  res.json({ ok: true });
});

// --- Positive / negative review list for the dashboard ---
// Positive = rating >= 4 (from db.data.reviews). Negative = rating < 4 (also stored in
// db.data.reviews when synced from Google) OR an internal 👎-flow private feedback entry
// that hasn't been synced from Google yet.
router.get('/reviews/list', auth, (req, res) => {
  const db = getDb();
  const biz = req.business;
  const reviews = db.data.reviews.filter((r) => r.businessId === biz.id);
  const positive = reviews
    .filter((r) => (r.rating || 5) >= 4)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => ({ id: r.id, customerName: r.customerName || 'Anonymous', rating: r.rating, text: r.text || '', source: r.source || 'internal', createdAt: r.createdAt }));

  const negativeFromReviews = reviews
    .filter((r) => (r.rating || 5) < 4)
    .map((r) => ({ id: r.id, customerName: r.customerName || 'Anonymous', rating: r.rating, text: r.text || '', source: r.source || 'google', createdAt: r.createdAt }));
  const negativeFromFeedback = db.data.feedback
    .filter((f) => f.businessId === biz.id)
    .map((f) => ({ id: f.id, customerName: f.customerName || 'Anonymous', rating: null, text: f.complaint || '', source: 'internal', createdAt: f.createdAt }));
  const negative = [...negativeFromReviews, ...negativeFromFeedback]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ positive, negative });
});

// Pull real reviews from Google (Places API "Place Details" reviews field) and file
// each one as positive (rating >= 4) or negative (rating < 4), per the classification
// the business owner asked for. Requires GOOGLE_PLACES_API_KEY on the server and a
// placeId configured in Settings — if either is missing, respond with connected:false
// instead of erroring, so the dashboard can show a friendly "not connected yet" state.
router.post('/reviews/google/sync', auth, async (req, res) => {
  const db = getDb();
  const biz = req.business;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !biz.placeId) {
    return res.json({
      connected: false,
      message: !apiKey
        ? 'Google Places API key is not configured on the server yet.'
        : 'No Google Place ID is set for this business yet — add it in Settings.',
    });
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(biz.placeId)}&fields=review,rating,user_ratings_total&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status !== 'OK') {
      return res.json({ connected: false, message: `Google API error: ${data.status}` });
    }
    const googleReviews = data.result?.reviews || [];
    let added = 0;
    for (const gr of googleReviews) {
      const googleReviewId = `g_${gr.author_name}_${gr.time}`;
      const alreadyReview = db.data.reviews.find((r) => r.googleReviewId === googleReviewId);
      const alreadyFeedback = db.data.feedback.find((f) => f.googleReviewId === googleReviewId);
      if (alreadyReview || alreadyFeedback) continue;
      const createdAt = new Date(gr.time * 1000).toISOString();
      if (gr.rating >= 4) {
        db.data.reviews.push({
          id: newId('rev'),
          businessId: biz.id,
          customerId: null,
          customerName: gr.author_name,
          rating: gr.rating,
          text: gr.text || '',
          source: 'google',
          googleReviewId,
          requestId: null,
          sentAt: null,
          createdAt,
        });
      } else {
        db.data.reviews.push({
          id: newId('rev'),
          businessId: biz.id,
          customerId: null,
          customerName: gr.author_name,
          rating: gr.rating,
          text: gr.text || '',
          source: 'google',
          googleReviewId,
          requestId: null,
          sentAt: null,
          createdAt,
        });
        db.data.feedback.push({
          id: newId('fb'),
          businessId: biz.id,
          customerId: null,
          customerName: gr.author_name,
          phone: '',
          complaint: gr.text || `${gr.rating}★ Google review`,
          googleReviewId,
          createdAt,
        });
      }
      added++;
    }
    biz.reviewsReceived = db.data.reviews.filter((r) => r.businessId === biz.id && (r.rating || 5) >= 4).length;
    await db.write();
    res.json({ connected: true, added, total: googleReviews.length });
  } catch (err) {
    res.json({ connected: false, message: `Could not reach Google: ${err.message}` });
  }
});

// --- Failed sends (owner can retry from the dashboard) ---
router.get('/pending-sends/failed', auth, (req, res) => {
  const db = getDb();
  const list = getFailedSends(db, req.business.id).map((s) => ({
    id: s.id,
    customerId: s.customerId,
    phone: s.phone,
    error: s.error,
    retryCount: s.retryCount,
    customerName: db.data.customers.find((c) => c.id === s.customerId)?.name || s.phone,
  }));
  res.json({ failed: list });
});

router.post('/pending-sends/:id/retry', auth, async (req, res) => {
  const db = getDb();
  const row = await retrySend(db, req.params.id);
  if (!row) return res.status(404).json({ error: 'Pending send not found' });
  res.json({ ok: true, status: row.status });
});
router.get('/analytics', auth, (req, res) => {
  const db = getDb();
  const biz = req.business;
  const reqs = db.data.requests.filter((r) => r.businessId === biz.id);
  const reviews = db.data.reviews.filter((r) => r.businessId === biz.id);
  const customers = db.data.customers.filter((c) => c.businessId === biz.id);
  const feedback = db.data.feedback.filter((f) => f.businessId === biz.id);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const reviewsThisMonth = reviews.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  }).length;
  const reviewsLastMonth = reviews.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === lastYear && d.getMonth() === lastMonth;
  }).length;
  const momPct = reviewsLastMonth ? Math.round(((reviewsThisMonth - reviewsLastMonth) / reviewsLastMonth) * 1000) / 10 : (reviewsThisMonth ? 100 : 0);

  // Reviews per week, last 12 weeks (current week includes today up to now).
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const upper = i === 0 ? now : weekEnd;
    const count = reviews.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= weekStart && d < upper;
    }).length;
    weeks.push({ label: `W${12 - i}`, count });
  }

  // Reviews per day of week (0=Sun .. 6=Sat).
  const dow = [0, 0, 0, 0, 0, 0, 0];
  for (const r of reviews) dow[new Date(r.createdAt).getDay()]++;

  // Average time-to-review (only reviews linked to a request).
  const linked = reviews.filter((r) => r.sentAt && r.createdAt);
  let avgTimeToReview = null;
  if (linked.length) {
    const totalMs = linked.reduce((sum, r) => sum + (new Date(r.createdAt) - new Date(r.sentAt)), 0);
    avgTimeToReview = Math.round(totalMs / linked.length / 3600000); // hours
  }

  // Conversion funnel.
  const sent = reqs.filter((r) => r.status !== 'Scheduled').length;
  const opened = reqs.filter((r) => r.status === 'Opened' || r.status === 'Reviewed').length;
  const reviewed = reviews.length;
  const funnel = {
    sent,
    opened,
    reviewed,
    sentToOpenedPct: sent ? Math.round((opened / sent) * 1000) / 10 : 0,
    openedToReviewedPct: opened ? Math.round((reviewed / opened) * 1000) / 10 : 0,
    sentToReviewedPct: sent ? Math.round((reviewed / sent) * 1000) / 10 : 0,
  };

  // --- Sentiment breakdown ---
  const positives = customers.filter((c) => c.sentiment === 'positive').length;
  const negatives = customers.filter((c) => c.sentiment === 'negative').length;
  const totalReacted = positives + negatives;
  const positiveRate = totalReacted ? Math.round((positives / totalReacted) * 1000) / 10 : 0;

  // Positive rate over the last 12 weeks (by reaction date).
  const sentimentWeeks = [];
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const upper = i === 0 ? now : weekEnd;
    const pos = customers.filter((c) => {
      if (c.sentiment !== 'positive') return false;
      const d = new Date(c.reactedAt || c.createdAt);
      return d >= weekStart && d < upper;
    }).length;
    const neg = customers.filter((c) => {
      if (c.sentiment !== 'negative') return false;
      const d = new Date(c.reactedAt || c.createdAt);
      return d >= weekStart && d < upper;
    }).length;
    const tot = pos + neg;
    sentimentWeeks.push({
      label: `W${12 - i}`,
      positive: pos,
      negative: neg,
      rate: tot ? Math.round((pos / tot) * 1000) / 10 : null,
    });
  }

  const keptOffGoogleThisMonth = feedback.filter((f) => {
    const d = new Date(f.createdAt);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  }).length;

  const recentFeedback = feedback
    .slice(0, 8)
    .map((f) => ({
      id: f.id,
      customerName: f.customerName,
      phone: f.phone,
      complaint: f.complaint,
      date: f.createdAt,
    }));

  res.json({
    total: reviews.length,
    reviewsThisMonth,
    reviewsLastMonth,
    momPct,
    weeks,
    dow,
    dowLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    avgTimeToReview,
    funnel,
    sentiment: {
      positives,
      negatives,
      totalReacted,
      positiveRate,
      weeks: sentimentWeeks,
      keptOffGoogleThisMonth,
      recentFeedback,
    },
  });
});

// --- Activity feed ---
router.get('/activity', auth, (req, res) => {
  const db = getDb();
  const list = db.data.activities
    .filter((a) => a.businessId === req.business.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);
  res.json({ activities: list });
});

// --- Settings ---
router.get('/settings', auth, (req, res) => {
  const b = req.business;
  res.json({
    businessName: b.name,
    googleReviewLink: b.googleReviewLink,
    feedbackLink: b.feedbackLink,
    messageTemplate: b.messageTemplate,
    delaySeconds: b.delaySeconds,
    demoMode: b.demoMode,
    reviewsReceived: b.reviewsReceived || 0,
    placeId: b.placeId || '',
    whatsappStatus: b.whatsapp?.status || 'not_connected',
    whatsappBsp: b.whatsapp?.bsp || '',
  });
});

router.put('/settings', auth, async (req, res) => {
  const db = getDb();
  const b = req.business;
  const { businessName, googleReviewLink, feedbackLink, messageTemplate, delaySeconds, demoMode, placeId } = req.body || {};
  if (typeof businessName === 'string' && businessName.trim()) b.name = businessName.trim();
  if (typeof googleReviewLink === 'string') b.googleReviewLink = googleReviewLink.trim();
  if (typeof feedbackLink === 'string') b.feedbackLink = feedbackLink.trim();
  if (typeof messageTemplate === 'string' && messageTemplate.trim()) b.messageTemplate = messageTemplate.trim();
  if (Number.isFinite(Number(delaySeconds))) b.delaySeconds = Number(delaySeconds);
  if (typeof demoMode === 'boolean') b.demoMode = demoMode;
  if (typeof placeId === 'string') b.placeId = placeId.trim();
  await db.write();
  res.json({
    businessName: b.name,
    googleReviewLink: b.googleReviewLink,
    feedbackLink: b.feedbackLink,
    messageTemplate: b.messageTemplate,
    delaySeconds: b.delaySeconds,
    demoMode: b.demoMode,
    reviewsReceived: b.reviewsReceived || 0,
    placeId: b.placeId || '',
    whatsappStatus: b.whatsapp?.status || 'not_connected',
    whatsappBsp: b.whatsapp?.bsp || '',
  });
});

router.get('/message-preview', auth, (req, res) => {
  const b = req.business;
  const message = renderTemplate(b.messageTemplate, {
    customerName: 'Rahul Sharma',
    businessName: b.name,
    reviewLink: b.googleReviewLink,
  });
  res.json({ message, effectiveDelay: effectiveDelay(b) });
});

// --- Reviews counter (manual, backed by the reviews collection) ---
router.post('/reviews/increment', auth, async (req, res) => {
  const db = getDb();
  const review = {
    id: newId('rev'),
    businessId: req.business.id,
    customerId: null,
    customerName: null,
    rating: 5,
    requestId: null,
    sentAt: null,
    createdAt: new Date().toISOString(),
  };
  db.data.reviews.push(review);
  req.business.reviewsReceived = db.data.reviews.filter((r) => r.businessId === req.business.id).length;
  await db.write();
  res.json({ reviewsReceived: req.business.reviewsReceived });
});

router.post('/reviews/decrement', auth, (req, res) => {
  const db = getDb();
  const mine = db.data.reviews
    .filter((r) => r.businessId === req.business.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (mine.length > 0) db.data.reviews = db.data.reviews.filter((r) => r.id !== mine[0].id);
  req.business.reviewsReceived = db.data.reviews.filter((r) => r.businessId === req.business.id).length;
  db.write();
  res.json({ reviewsReceived: req.business.reviewsReceived });
});

// --- Admin: manage client businesses (was previously unauthenticated — fixed) ---
router.get('/admin/businesses', adminAuth, (req, res) => {
  const db = getDb();
  const list = db.data.businesses.map((b) => ({
    id: b.id,
    name: b.name,
    ownerEmail: b.ownerEmail,
    subscriptionStatus: b.subscriptionStatus,
    isDemo: !!b.isDemo,
    requestsSent: db.data.requests.filter((r) => r.businessId === b.id && r.status !== 'Scheduled').length,
    customersCount: db.data.customers.filter((c) => c.businessId === b.id).length,
    createdAt: b.createdAt,
    whatsapp: { bsp: b.whatsapp?.bsp || '', status: b.whatsapp?.status || 'not_connected', phoneNumberId: b.whatsapp?.phoneNumberId || '' },
    placeId: b.placeId || '',
    googleReviewLink: b.googleReviewLink || '',
  }));
  res.json({ businesses: list });
});

// Add a new client. The admin sets an initial password the owner can change later
// from their own Settings — a future "reset password" flow can replace this.
router.post('/admin/businesses', adminAuth, async (req, res) => {
  const db = getDb();
  const { name, ownerEmail, password, googleReviewLink } = req.body || {};
  if (!name || !ownerEmail || !password) {
    return res.status(400).json({ error: 'name, ownerEmail and password are required' });
  }
  if (db.data.businesses.some((b) => b.ownerEmail === ownerEmail)) {
    return res.status(409).json({ error: 'A business with that owner email already exists' });
  }
  const business = {
    id: newId('biz'),
    name: String(name).trim(),
    ownerEmail: String(ownerEmail).trim(),
    passwordHash: hashPassword(password),
    isDemo: false,
    googleReviewLink: googleReviewLink ? String(googleReviewLink).trim() : '',
    feedbackLink: '',
    address: '',
    phone: '',
    description: '',
    messageTemplate: defaultTemplate,
    delaySeconds: 7200,
    demoMode: false,
    subscriptionStatus: 'trial',
    createdAt: new Date().toISOString(),
    reviewsReceived: 0,
    placeId: '',
    whatsapp: { bsp: '', apiKey: '', phoneNumberId: '', status: 'not_connected' },
  };
  db.data.businesses.push(business);
  await db.write();
  res.json({ business: { id: business.id, name: business.name, ownerEmail: business.ownerEmail } });
});

// Remove a client and all of their data. The seeded demo business can't be removed.
router.delete('/admin/businesses/:id', adminAuth, async (req, res) => {
  const db = getDb();
  const business = db.data.businesses.find((b) => b.id === req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  if (business.isDemo) return res.status(400).json({ error: 'The demo account cannot be removed' });
  const id = business.id;
  db.data.businesses = db.data.businesses.filter((b) => b.id !== id);
  db.data.customers = db.data.customers.filter((c) => c.businessId !== id);
  db.data.requests = db.data.requests.filter((r) => r.businessId !== id);
  db.data.reviews = db.data.reviews.filter((r) => r.businessId !== id);
  db.data.feedback = db.data.feedback.filter((f) => f.businessId !== id);
  db.data.activities = db.data.activities.filter((a) => a.businessId !== id);
  db.data.pendingSends = db.data.pendingSends.filter((s) => s.businessId !== id);
  db.data.sessions = db.data.sessions.filter((s) => s.businessId !== id);
  await db.write();
  res.json({ ok: true });
});

// Onboard (or update) a client's WhatsApp Business API connection. The API key never
// gets sent back down to the client dashboard — see publicBusiness() in auth.js.
router.put('/admin/businesses/:id/whatsapp', adminAuth, async (req, res) => {
  const db = getDb();
  const business = db.data.businesses.find((b) => b.id === req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const { bsp, apiKey, phoneNumberId, status } = req.body || {};
  business.whatsapp = {
    bsp: typeof bsp === 'string' ? bsp.trim() : (business.whatsapp?.bsp || ''),
    apiKey: typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : (business.whatsapp?.apiKey || ''),
    phoneNumberId: typeof phoneNumberId === 'string' ? phoneNumberId.trim() : (business.whatsapp?.phoneNumberId || ''),
    status: status || (apiKey ? 'connected' : (business.whatsapp?.status || 'not_connected')),
  };
  await db.write();
  res.json({ whatsapp: { bsp: business.whatsapp.bsp, status: business.whatsapp.status, phoneNumberId: business.whatsapp.phoneNumberId } });
});

// Set (or update) the Google Place ID used to pull real reviews for a client.
router.put('/admin/businesses/:id/google', adminAuth, async (req, res) => {
  const db = getDb();
  const business = db.data.businesses.find((b) => b.id === req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const { placeId, googleReviewLink } = req.body || {};
  if (typeof placeId === 'string') business.placeId = placeId.trim();
  if (typeof googleReviewLink === 'string' && googleReviewLink.trim()) business.googleReviewLink = googleReviewLink.trim();
  await db.write();
  res.json({ placeId: business.placeId, googleReviewLink: business.googleReviewLink });
});

// --- Reset demo data ---
router.post('/reset-db', auth, async (req, res) => {
  const db = getDb();
  const fresh = (await import('./db.js')).buildSeedExport();
  db.data = fresh;
  await db.write();
  resumeScheduledSends();
  res.json({ ok: true });
});

export default router;
