import { getDb, getBusiness, mapCustomer } from './db.js';
import { recordActivity } from './auth.js';
import { sendBusinessWhatsApp } from './whatsapp.js';
import { classifyOneReview } from './ai.js';
import {
  getCopy,
  HAPPY_FOLLOWUP,
  SAD_FOLLOWUP,
  SUGGESTION_THANKS,
  googleReviewAsk,
} from './categoryCopy.js';
import { detectSentimentReply, isNoComplaintReply, phoneTail } from './sentimentFlow.js';

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function historyOf(customer) {
  return Array.isArray(customer.waHistory) ? [...customer.waHistory] : [];
}

async function persistCustomer(customerId, patch, history) {
  const db = getDb();
  const updates = { ...patch };
  if (history) updates.wa_history = history;
  await db.from('customers').update(updates).eq('id', customerId);
}

async function deliver(business, { phone, message, customerName }) {
  try {
    return await sendBusinessWhatsApp(business, { phone, message, customerName, session: true });
  } catch (e) {
    return { ok: false, error: e.message, simulated: !business.whatsapp?.apiKey };
  }
}

async function saveFeedback({ business, customer, text, type }) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `fb_${type}_${customer.id}_${Date.now()}`;
  await db.from('feedback').insert({
    id,
    business_id: business.id,
    customer_id: customer.id,
    customer_name: customer.name,
    phone: customer.phone,
    complaint: text,
    type,
    created_at: now,
    submitted_at: now,
  });
  return { id, type, complaint: text, createdAt: now, customerName: customer.name, phone: customer.phone };
}

async function feedComplaintToAi(business, customer, text, feedbackId) {
  const db = getDb();
  const now = new Date().toISOString();
  const reviewId = `rev_fb_${feedbackId}`;
  const review = {
    id: reviewId,
    business_id: business.id,
    customer_id: customer.id,
    customer_name: customer.name,
    rating: 2,
    text,
    source: 'internal',
    created_at: now,
    is_read: false,
  };
  await db.from('reviews').insert(review);
  try {
    await classifyOneReview(business.id, { id: reviewId, rating: 2, text, complaint: text });
  } catch (e) {
    console.error('classify complaint failed (will retry on cron):', e.message);
  }
}

async function markOpened(customer) {
  const db = getDb();
  const { data: reqData } = await db
    .from('requests')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reqData) {
    const updates = {};
    if (!reqData.opened_at) updates.opened_at = new Date().toISOString();
    if (reqData.status === 'Sent' || reqData.status === 'Scheduled') updates.status = 'Opened';
    if (Object.keys(updates).length) await db.from('requests').update(updates).eq('id', reqData.id);
  }
}

export async function findCustomerForInbound(phone) {
  const db = getDb();
  const tail = phoneTail(phone);
  if (!tail) return null;
  const { data } = await db.from('customers').select('*').order('created_at', { ascending: false }).limit(400);
  const matches = (data || [])
    .map(mapCustomer)
    .filter((c) => phoneTail(c.phone) === tail);
  if (!matches.length) return null;
  const active = matches.find((c) => c.waStep && c.waStep !== 'idle' && c.waStep !== 'done');
  return active || matches[0];
}

export async function handleCustomerInbound(business, customer, text, { skipSend = false } = {}) {
  const copy = getCopy(business.category);
  const history = historyOf(customer);
  history.push({ from: 'customer', type: 'text', text, at: new Date().toISOString() });

  let step = customer.waStep || 'idle';
  if (step === 'idle' && (customer.stage === 'sent' || customer.stage === 'opened' || customer.stage === 'to_send')) {
    step = 'awaiting_sentiment';
  }

  const replies = [];
  const pushBiz = (message, type = 'text') => {
    history.push({ from: 'business', type, text: message, at: new Date().toISOString() });
    replies.push(message);
  };

  await markOpened(customer);

  if (step === 'awaiting_sentiment' || step === 'idle') {
    const sentiment = detectSentimentReply(text);
    if (!sentiment) {
      const hint = 'Please reply 1 for 😊 or 2 for 😞 so we know how your experience was.';
      pushBiz(hint);
      await persistCustomer(customer.id, { wa_step: 'awaiting_sentiment', stage: 'opened' }, history);
      if (!skipSend) await deliver(business, { phone: customer.phone, message: hint, customerName: customer.name });
      return { step: 'awaiting_sentiment', sentiment: null, replies, history };
    }

    const db = getDb();
    const { data: reqData } = await db
      .from('requests')
      .select('id')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reqData) await db.from('requests').update({ reaction: sentiment }).eq('id', reqData.id);

    if (sentiment === 'positive') {
      pushBiz(HAPPY_FOLLOWUP);
      await persistCustomer(customer.id, {
        wa_step: 'awaiting_happy_detail',
        stage: 'positive',
        sentiment: 'positive',
      }, history);
      await recordActivity(business.id, {
        type: 'positive_reply',
        customerName: customer.name,
        phone: customer.phone,
        message: HAPPY_FOLLOWUP,
        status: 'Positive',
      });
      if (!skipSend) await deliver(business, { phone: customer.phone, message: HAPPY_FOLLOWUP, customerName: customer.name });
      return { step: 'awaiting_happy_detail', sentiment, replies, history };
    }

    pushBiz(SAD_FOLLOWUP);
    await persistCustomer(customer.id, {
      wa_step: 'awaiting_complaint',
      stage: 'negative',
      sentiment: 'negative',
    }, history);
    await recordActivity(business.id, {
      type: 'negative_reply',
      customerName: customer.name,
      phone: customer.phone,
      message: SAD_FOLLOWUP,
      status: 'Negative',
    });
    if (!skipSend) await deliver(business, { phone: customer.phone, message: SAD_FOLLOWUP, customerName: customer.name });
    return { step: 'awaiting_complaint', sentiment, replies, history };
  }

  if (step === 'awaiting_happy_detail') {
    if (isNoComplaintReply(text)) {
      const ask = googleReviewAsk(business.googleReviewLink);
      pushBiz(ask, 'link');
      await persistCustomer(customer.id, {
        wa_step: 'done',
        stage: 'positive',
        sentiment: 'positive',
      }, history);
      await recordActivity(business.id, {
        type: 'google_link_sent',
        customerName: customer.name,
        phone: customer.phone,
        message: ask,
        status: 'Positive',
      });
      if (!skipSend) await deliver(business, { phone: customer.phone, message: ask, customerName: customer.name });
      return { step: 'done', sentiment: 'positive', googleLinkSent: true, replies, history };
    }

    const fb = await saveFeedback({ business, customer, text, type: 'suggestion' });
    pushBiz(SUGGESTION_THANKS);
    await persistCustomer(customer.id, {
      wa_step: 'done',
      stage: 'positive',
      sentiment: 'positive',
      complaint: text,
    }, history);
    await recordActivity(business.id, {
      type: 'suggestion',
      customerName: customer.name,
      phone: customer.phone,
      message: text,
      status: 'Suggestion',
    });
    if (!skipSend) await deliver(business, { phone: customer.phone, message: SUGGESTION_THANKS, customerName: customer.name });
    return { step: 'done', sentiment: 'positive', suggestion: fb, googleLinkSent: false, replies, history };
  }

  if (step === 'awaiting_complaint') {
    const fb = await saveFeedback({ business, customer, text, type: 'complaint' });
    await persistCustomer(customer.id, {
      wa_step: 'done',
      stage: 'negative',
      sentiment: 'negative',
      complaint: text,
    }, history);
    await recordActivity(business.id, {
      type: 'complaint',
      customerName: customer.name,
      phone: customer.phone,
      message: text,
      status: 'Complaint',
    });
    await feedComplaintToAi(business, customer, text, fb.id);
    return { step: 'done', sentiment: 'negative', complaint: fb, googleLinkSent: false, replies, history };
  }

  await persistCustomer(customer.id, {}, history);
  return { step, ignored: true, replies, history, copy };
}

export async function handleInboundText(phone, text) {
  const customer = await findCustomerForInbound(phone);
  if (!customer) return { ok: false, error: 'No matching member/customer' };
  const business = await getBusiness(customer.businessId);
  if (!business) return { ok: false, error: 'Business not found' };
  const result = await handleCustomerInbound(business, customer, text);
  return { ok: true, customerId: customer.id, businessId: business.id, ...result };
}
