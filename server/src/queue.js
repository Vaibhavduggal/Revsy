import { getDb, getBusiness } from './db.js';

// Single seam for actually delivering a WhatsApp message. Today it is a simulated
// no-op (we have no live WhatsApp API). Swap the body for a real AiSensy/Twilio
// call later without touching the scheduler/poller logic.
export async function sendWhatsAppMessage(phone, message) {
  // Simulated delivery. Replace with: await aisensy.send({ phone, message });
  // Test seam: a message containing this marker forces a delivery failure so the
  // retry/backoff/failed transition can be exercised without a real API.
  if (message && message.includes('__FORCE_FAIL__')) {
    throw new Error('Simulated delivery failure');
  }
  if (!phone || !message) throw new Error('Missing phone or message');
  return { delivered: true, at: new Date().toISOString() };
}

// Ensure the persistent pending_sends table exists on the data model.
export function ensurePendingSends(db) {
  if (!db.data.pendingSends) db.data.pendingSends = [];
}

export function getDueSends(db) {
  ensurePendingSends(db);
  const nowIso = new Date().toISOString();
  return db.data.pendingSends.filter(
    (s) => s.status === 'pending' && s.scheduledTime <= nowIso
  );
}

// Enqueue a scheduled send. Returns the created row.
export function enqueueSend(db, { businessId, customerId, phone, message, delaySeconds }) {
  ensurePendingSends(db);
  const delay = Number.isFinite(delaySeconds) ? Math.max(0, delaySeconds) : 0;
  const scheduledTime = new Date(Date.now() + delay * 1000).toISOString();
  const row = {
    id: `ps_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    businessId,
    customerId,
    phone,
    message,
    scheduledTime,
    status: 'pending',
    retryCount: 0,
    error: null,
    createdAt: new Date().toISOString(),
  };
  db.data.pendingSends.push(row);
  return row;
}

function backoffMs(retryCount) {
  // 1m, 5m, 15m — exponential, capped well under the 3-retry limit.
  return Math.min(15 * 60 * 1000, 60 * 1000 * Math.pow(5, retryCount));
}

// Process a single row immediately (used by the manual nudge from the API).
export async function processDueNow(row) {
  const db = getDb();
  const nowIso = new Date().toISOString();
  // Treat rows scheduled within the next 5s as due, so a just-enqueued 0s-delay
  // "send now" row is delivered immediately rather than waiting for the poller.
  const due = row.status === 'pending' && row.scheduledTime <= new Date(Date.now() + 5000).toISOString();
  if (!due) return;
  await processRow(db, row);
}

// Process a single due row: deliver, mark sent on success, or retry/fail on error.
async function processRow(db, row) {
  const business = getBusiness(row.businessId);
  const customer = db.data.customers.find((c) => c.id === row.customerId);
  try {
    await sendWhatsAppMessage(row.phone, row.message);
    row.status = 'sent';
    row.sentAt = new Date().toISOString();
    row.error = null;
    // Reflect the send on the customer record.
    const request = db.data.requests.find((r) => r.customerId === row.customerId && r.status === 'Scheduled');
    if (request) {
      request.status = 'Sent';
      request.sentAt = row.sentAt;
      request.message = row.message;
    }
    if (customer) {
      customer.stage = 'sent';
      customer.lastRequestAt = row.sentAt;
      customer.lastRequestStatus = 'Sent';
    }
    if (business) {
      recordActivityLocal(db, business.id, {
        type: 'message_sent',
        customerName: customer?.name || row.phone,
        phone: row.phone,
        message: row.message,
        status: 'Sent',
      });
    }
  } catch (e) {
    row.retryCount += 1;
    row.error = e.message || String(e);
    if (row.retryCount >= 3) {
      row.status = 'failed';
    } else {
      // Retry with exponential backoff by pushing the scheduled time forward.
      row.scheduledTime = new Date(Date.now() + backoffMs(row.retryCount)).toISOString();
    }
  }
}

function recordActivityLocal(db, businessId, data) {
  db.data.activities.push({
    id: `act_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    businessId,
    createdAt: new Date().toISOString(),
    ...data,
  });
}

// Cron-style poller: every 60s, process all due rows, then persist.
let timer = null;
export function startSendPoller(intervalMs = 60000) {
  const db = getDb();
  ensurePendingSends(db);
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    try {
      const due = getDueSends(db);
      if (due.length === 0) return;
      for (const row of due) await processRow(db, row);
      await db.write();
    } catch (e) {
      console.error('Send poller error', e);
    }
  }, intervalMs);
  return timer;
}

// Re-arm any pending rows from a previous run (survives restarts because they are
// stored on disk in db.json, not in memory).
export function resumePendingSends() {
  const db = getDb();
  ensurePendingSends(db);
  const due = getDueSends(db);
  if (due.length > 0) {
    // Kick the poller immediately; it will process and persist.
    (async () => {
      for (const row of due) await processRow(db, row);
      await db.write();
    })();
  }
}

// Manual retry of a failed row from the dashboard.
export async function retrySend(db, rowId) {
  const row = db.data.pendingSends.find((r) => r.id === rowId);
  if (!row) return null;
  row.status = 'pending';
  row.scheduledTime = new Date().toISOString(); // send now
  row.retryCount = 0;
  row.error = null;
  await processRow(db, row);
  await db.write();
  return row;
}

export function getFailedSends(db, businessId) {
  ensurePendingSends(db);
  return db.data.pendingSends.filter(
    (s) => s.status === 'failed' && (!businessId || s.businessId === businessId)
  );
}
