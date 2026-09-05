import { getDb, getBusiness, mapPendingSend, mapCustomer } from './db.js';
import { recordActivity } from './auth.js';
import { sendBusinessWhatsApp } from './whatsapp.js';

export async function getDueSends() {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from('pending_sends')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_time', nowIso);
  return (data || []).map(mapPendingSend);
}

export async function enqueueSend({ businessId, customerId, phone, message, delaySeconds }) {
  const db = getDb();
  const delay = Number.isFinite(delaySeconds) ? Math.max(0, delaySeconds) : 0;
  const scheduledTime = new Date(Date.now() + delay * 1000).toISOString();
  const row = {
    id: `ps_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    business_id: businessId,
    customer_id: customerId,
    phone,
    message,
    scheduled_time: scheduledTime,
    status: 'pending',
    retry_count: 0,
    error: null,
    created_at: new Date().toISOString(),
    sent_at: null,
  };
  await db.from('pending_sends').insert(row);
  if (customerId) {
    await db.from('customers').update({ wa_delivery_status: 'queued' }).eq('id', customerId);
  }
  return mapPendingSend(row);
}

function backoffMs(retryCount) {
  return Math.min(15 * 60 * 1000, 60 * 1000 * Math.pow(5, retryCount));
}

export async function processDueNow(row) {
  const nowIso = new Date().toISOString();
  const due = row.status === 'pending' && row.scheduledTime <= new Date(Date.now() + 5000).toISOString();
  if (!due) return;
  await processRow(row);
}

async function processRow(row) {
  const db = getDb();
  const business = await getBusiness(row.businessId);
  const { data: custData } = await db
    .from('customers')
    .select('*')
    .eq('id', row.customerId)
    .single();
  const customer = custData ? mapCustomer(custData) : null;

  try {
    if (!business) throw new Error('Business not found for pending send');
    await sendBusinessWhatsApp(business, {
      phone: row.phone,
      message: row.message,
      customerName: customer?.name,
    });
    // Update pending_sends row
    await db.from('pending_sends').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      error: null,
    }).eq('id', row.id);

    // Update the request
    const { data: reqData } = await db
      .from('requests')
      .select('*')
      .eq('customer_id', row.customerId)
      .eq('status', 'Scheduled')
      .single();
    if (reqData) {
      await db.from('requests').update({
        status: 'Sent',
        sent_at: new Date().toISOString(),
        message: row.message,
      }).eq('id', reqData.id);
    }

    // Update customer
    if (customer) {
      const history = Array.isArray(customer.waHistory) ? [...customer.waHistory] : [];
      history.push({ from: 'business', type: 'text', text: row.message, at: new Date().toISOString() });
      await db.from('customers').update({
        stage: 'sent',
        last_request_at: new Date().toISOString(),
        last_request_status: 'Sent',
        wa_delivery_status: 'sent',
        wa_step: customer.waStep === 'idle' ? 'awaiting_sentiment' : customer.waStep,
        wa_history: history,
      }).eq('id', customer.id);
    }

    // Record activity
    if (business) {
      await recordActivity(business.id, {
        type: 'message_sent',
        customerName: customer?.name || row.phone,
        phone: row.phone,
        message: row.message,
        status: 'Sent',
      });
    }
  } catch (e) {
    const retryCount = (row.retryCount || 0) + 1;
    const update = {
      retry_count: retryCount,
      error: e.message || String(e),
    };
    if (retryCount >= 3) {
      update.status = 'failed';
    } else {
      update.scheduled_time = new Date(Date.now() + backoffMs(retryCount)).toISOString();
    }
    await db.from('pending_sends').update(update).eq('id', row.id);
    if (update.status === 'failed' && row.customerId) {
      await db.from('customers').update({ wa_delivery_status: 'failed' }).eq('id', row.customerId);
    }
  }
}

let timer = null;
export function startSendPoller(intervalMs = 60000) {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    try {
      const due = await getDueSends();
      if (due.length === 0) return;
      for (const row of due) await processRow(row);
    } catch (e) {
      console.error('Send poller error', e);
    }
  }, intervalMs);
  return timer;
}

export async function processDueSends() {
  const due = await getDueSends();
  const results = [];
  for (const row of due) {
    try {
      await processRow(row);
      results.push({ id: row.id, ok: true });
    } catch (e) {
      results.push({ id: row.id, ok: false, error: e.message });
    }
  }
  return { processed: results.length, results };
}

export async function resumePendingSends() {
  return processDueSends();
}

export async function retrySend(rowId) {
  const db = getDb();
  const { data } = await db
    .from('pending_sends')
    .select('*')
    .eq('id', rowId)
    .single();
  if (!data) return null;
  const row = mapPendingSend(data);
  await db.from('pending_sends').update({
    status: 'pending',
    scheduled_time: new Date().toISOString(),
    retry_count: 0,
    error: null,
  }).eq('id', row.id);
  await processRow({ ...row, status: 'pending', scheduledTime: new Date().toISOString(), retryCount: 0, error: null });
  return { ...row, status: 'pending', scheduledTime: new Date().toISOString(), retryCount: 0, error: null };
}

export async function getFailedSends(businessId) {
  const db = getDb();
  let query = db.from('pending_sends').select('*').eq('status', 'failed');
  if (businessId) query = query.eq('business_id', businessId);
  const { data } = await query;
  return (data || []).map(mapPendingSend);
}
