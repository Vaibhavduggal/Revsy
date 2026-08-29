// In-process queue unit test: forced failure -> 3 retries -> failed -> manual retry -> sent.
// Imports the live queue.js (no server needed) so we can drive sendWhatsAppMessage failures.
import { initDb, getDb, buildSeedExport } from './src/db.js';
import { enqueueSend, retrySend, getFailedSends, processDueNow, startSendPoller } from './src/queue.js';

function assert(cond, msg) {
  if (!cond) { throw new Error('ASSERT FAIL: ' + msg); }
  console.log('ok -', msg);
}

async function main() {
  await initDb();
  const db = getDb();
  db.data = buildSeedExport();

  // 1) Enqueue a forced-fail send (message contains the failure seam marker).
  const row = enqueueSend(db, {
    businessId: 'biz_1', customerId: 'cust_1', phone: '+9199999',
    message: 'x __FORCE_FAIL__ y', delaySeconds: 0,
  });

  // 2) Process 3 times: each increments retryCount; on the 3rd it becomes failed.
  // Between attempts we reset scheduledTime to now to simulate the poller re-finding
  // the row due again after its backoff window elapsed.
  await processDueNow(row);
  assert(row.status === 'pending' && row.retryCount === 1, 'after 1st attempt: pending, retryCount=1');
  row.scheduledTime = new Date().toISOString();
  await processDueNow(row);
  assert(row.status === 'pending' && row.retryCount === 2, 'after 2nd attempt: pending, retryCount=2');
  row.scheduledTime = new Date().toISOString();
  await processDueNow(row);
  assert(row.status === 'failed' && row.retryCount === 3, 'after 3rd attempt: failed, retryCount=3');

  // 3) It shows up in getFailedSends.
  const failed = getFailedSends(db, 'biz_1');
  assert(failed.length === 1 && failed[0].id === row.id, 'getFailedSends returns the failed row');

  // 4) Manual retry on the failed row: flip the message to a good one so it succeeds.
  row.message = 'a good message';
  const retried = await retrySend(db, row.id);
  assert(retried.status === 'sent', 'manual retry delivers and marks sent');

  // 5) Poller boots without error and finds nothing due now.
  const t = startSendPoller(100);
  clearInterval(t);

  console.log('QUEUE_UNIT_OK');
}

main().catch((e) => { console.error('QUEUE_UNIT_FAIL', e); process.exit(1); });
