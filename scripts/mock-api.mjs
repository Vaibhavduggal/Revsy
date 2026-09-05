import express from 'express';
import {
  detectSentimentReply,
  isNoComplaintReply,
} from '../server/src/sentimentFlow.js';
import {
  getCopy,
  HAPPY_FOLLOWUP,
  SAD_FOLLOWUP,
  SUGGESTION_THANKS,
  googleReviewAsk,
} from '../server/src/categoryCopy.js';

const app = express();
app.use(express.json());

const tokens = new Map();
const businesses = {
  setup: {
    id: 'biz_burn_onboard',
    name: 'Burn Gym, Ghumar Mandi',
    ownerEmail: 'setup@burngym.com',
    category: 'restaurant',
    categorySet: false,
    onboardingCompleted: false,
    googleConnected: false,
    approvalStatus: 'pending_approval',
    isDemo: false,
    googleReviewLink: '',
    messageTemplate: 'Hi [customer name]…',
    delaySeconds: 1800,
    demoMode: false,
    address: '',
    phone: '',
  },
  gym: {
    id: 'biz_burn_gym',
    name: 'Burn Gym, Ghumar Mandi',
    ownerEmail: 'owner@burngym.com',
    category: 'gym',
    categorySet: true,
    onboardingCompleted: true,
    googleConnected: true,
    approvalStatus: 'approved',
    isDemo: false,
    googleReviewLink: 'https://search.google.com/local/writereview?placeid=ChIJBurnGymGhumarMandi',
    messageTemplate: 'Hi [customer name], thanks for working out at [business name] today!',
    delaySeconds: 1800,
    demoMode: true,
    address: 'Plot No. B-19/186, 3rd-4th Floor, Rani Jhansi Road, Ghumar Mandi, Ludhiana, Punjab 141001',
    phone: '+91 99887 77999',
  },
};

const customers = [];
const nowIso = new Date().toISOString();
const feedback = [
  {
    id: 'fb_seed_sug',
    type: 'suggestion',
    customerName: 'Priya Malhotra',
    phone: '+91 98111 10001',
    complaint: 'Please add more squat racks near the windows.',
    createdAt: nowIso,
  },
  {
    id: 'fb_seed_cmp',
    type: 'complaint',
    customerName: 'Harpreet Kaur',
    phone: '+91 98111 10003',
    complaint: 'My 30-day challenge was postponed again and nobody told me.',
    createdAt: nowIso,
  },
];
const requests = [];

function bizFromToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return tokens.get(token) || null;
}

function auth(req, res, next) {
  req.business = bizFromToken(req);
  if (!req.business) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/login', (req, res) => {
  const email = String(req.body?.email || '').toLowerCase();
  const password = String(req.body?.password || '');
  if (password !== 'demo123') return res.status(401).json({ error: 'Invalid email or password' });
  const key = email === 'setup@burngym.com' ? 'setup' : email === 'owner@burngym.com' ? 'gym' : null;
  if (!key) return res.status(401).json({ error: 'Invalid email or password' });
  const token = `tok_${key}_${Date.now()}`;
  tokens.set(token, businesses[key]);
  res.json({ token, business: businesses[key] });
});

app.get('/api/settings', auth, (req, res) => {
  const b = req.business;
  res.json({
    businessId: b.id,
    businessName: b.name,
    googleReviewLink: b.googleReviewLink,
    messageTemplate: b.messageTemplate,
    delaySeconds: b.delaySeconds,
    demoMode: b.demoMode,
    category: b.category,
    categorySet: b.categorySet,
    onboardingCompleted: b.onboardingCompleted,
    googleConnected: b.googleConnected,
    approvalStatus: b.approvalStatus,
    isDemo: false,
    address: b.address,
    phone: b.phone,
  });
});

app.get('/api/onboarding/status', auth, (req, res) => {
  const b = req.business;
  res.json({
    onboardingCompleted: b.onboardingCompleted,
    googleConnected: b.googleConnected,
    category: b.category,
    categorySet: b.categorySet,
    name: b.name,
    address: b.address,
    phone: b.phone,
    approvalStatus: b.approvalStatus,
    whatsappConnected: false,
    needsLocation: false,
  });
});

app.post('/api/onboarding/profile', auth, (req, res) => {
  const b = req.business;
  b.category = req.body.category;
  b.categorySet = true;
  if (req.body.name) b.name = req.body.name;
  if (req.body.address) b.address = req.body.address;
  if (req.body.phone) b.phone = req.body.phone;
  res.json({ ok: true, category: b.category, categorySet: true, name: b.name, address: b.address, phone: b.phone });
});

app.get('/api/dashboard', auth, (_req, res) => {
  res.json({
    stats: { totalSent: requests.length, totalReceived: 10, conversionRate: 40 },
    weekly: [],
    recent: requests.slice(-10).reverse(),
    failedSends: [],
  });
});

app.get('/api/analytics', auth, (_req, res) => {
  res.json({
    total: 10,
    reviewsThisMonth: 4,
    reviewsLastMonth: 6,
    momPct: -33,
    weeks: Array.from({ length: 12 }, (_, i) => ({ label: `W${i + 1}`, count: i % 3, positive: 1, negative: 1 })),
    avgTimeToReview: 8,
    funnel: { sent: 3, opened: 3, reviewed: 0, sentToOpenedPct: 100, openedToReviewedPct: 0, sentToReviewedPct: 0 },
    sentiment: {
      positives: 2,
      negatives: 1,
      totalReacted: 3,
      positiveRate: 66.7,
      weeks: [],
      keptOffGoogleThisMonth: 1,
      recentFeedback: feedback.filter((f) => f.type !== 'suggestion').map((f) => ({ ...f, date: f.createdAt })),
      recentSuggestions: feedback.filter((f) => f.type === 'suggestion').map((f) => ({ ...f, date: f.createdAt })),
    },
  });
});

app.get('/api/reviews/list', auth, (_req, res) => {
  res.json({
    positive: [
      { id: 'rev_burn_7', customerName: 'Anmol Sharma', rating: 5, text: 'Trainer Rahul actually cares about form. I have lost 6kg in two months.', source: 'google', createdAt: new Date().toISOString(), isRead: false },
    ],
    negative: [
      { id: 'rev_burn_2', customerName: 'Simran Kaur', rating: 1, text: 'The 30-day challenge keeps getting postponed.', source: 'google', createdAt: new Date().toISOString(), isRead: false, aiFlag: 'repeated' },
    ],
    suggestions: feedback.filter((f) => f.type === 'suggestion'),
    complaints: feedback.filter((f) => f.type !== 'suggestion'),
  });
});

app.get('/api/reviews/summaries', auth, (_req, res) => {
  res.json({
    current: {
      issues: [
        { id: 'iss_burn_equipment', theme: 'Dated equipment and ambience vs other branches', occurrences: 3, improvement: 'Refresh high-use machines.', is_read: false },
        { id: 'iss_burn_pt', theme: 'Inconsistent trainer / 30-day challenge scheduling', occurrences: 2, improvement: 'Lock the 30-day challenge calendar.', is_read: false },
      ],
    },
  });
});

app.get('/api/pending-sends/failed', auth, (_req, res) => res.json({ failed: [] }));
app.get('/api/feedback', auth, (_req, res) => {
  const suggestions = feedback.filter((f) => f.type === 'suggestion');
  const complaints = feedback.filter((f) => f.type !== 'suggestion');
  res.json({ feedback, suggestions, complaints, total: feedback.length });
});

app.post('/api/customers', auth, (req, res) => {
  const customer = {
    id: `cust_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    name: req.body.name,
    phone: req.body.phone,
    stage: 'sent',
    waStep: 'awaiting_sentiment',
    sentiment: null,
    complaint: '',
  };
  customers.push(customer);
  requests.push({
    id: `req_${customer.id}`,
    customerName: customer.name,
    phone: customer.phone,
    status: 'Sent',
    createdAt: new Date().toISOString(),
  });
  res.json({ customer });
});

function runInbound(customer, business, text) {
  const copy = getCopy(business.category);
  void copy;
  let step = customer.waStep || 'awaiting_sentiment';
  if (step === 'awaiting_sentiment') {
    const sentiment = detectSentimentReply(text);
    if (sentiment === 'positive') {
      customer.waStep = 'awaiting_happy_detail';
      customer.stage = 'positive';
      customer.sentiment = 'positive';
      return { step: 'awaiting_happy_detail', replies: [HAPPY_FOLLOWUP] };
    }
    if (sentiment === 'negative') {
      customer.waStep = 'awaiting_complaint';
      customer.stage = 'negative';
      customer.sentiment = 'negative';
      return { step: 'awaiting_complaint', replies: [SAD_FOLLOWUP] };
    }
    return { step: 'awaiting_sentiment', replies: [] };
  }
  if (step === 'awaiting_happy_detail') {
    if (isNoComplaintReply(text)) {
      customer.waStep = 'done';
      return { step: 'done', googleLinkSent: true, replies: [googleReviewAsk(business.googleReviewLink)] };
    }
    const fb = { id: `fb_s_${customer.id}`, type: 'suggestion', customerName: customer.name, phone: customer.phone, complaint: text, createdAt: new Date().toISOString() };
    feedback.push(fb);
    customer.waStep = 'done';
    return { step: 'done', suggestion: fb, googleLinkSent: false, replies: [SUGGESTION_THANKS] };
  }
  if (step === 'awaiting_complaint') {
    const fb = { id: `fb_c_${customer.id}`, type: 'complaint', customerName: customer.name, phone: customer.phone, complaint: text, createdAt: new Date().toISOString() };
    feedback.push(fb);
    customer.waStep = 'done';
    customer.stage = 'negative';
    return { step: 'done', complaint: fb, googleLinkSent: false, replies: [] };
  }
  return { step, ignored: true };
}

app.post('/api/customers/:id/reply', auth, (req, res) => {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const text = req.body.text || (req.body.reaction === 'positive' ? '😊' : '😞');
  const result = runInbound(customer, req.business, text);
  res.json({ customer, ...result });
});

app.post('/api/customers/:id/inbound', auth, (req, res) => {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const result = runInbound(customer, req.business, String(req.body.text || ''));
  res.json({ customer, ...result });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('mock API on', PORT));
