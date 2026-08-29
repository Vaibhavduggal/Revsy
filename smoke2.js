const BASE = 'http://localhost:4000/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const login = await fetch(`${BASE}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@business.com', password: 'demo123' }),
  }).then((r) => r.json());
  const token = login.token;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const call = (method, path, body) => fetch(`${BASE}${path}`, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

  // Apply the new seed (old persisted db.json lacked feedback/stage fields).
  const rb = await call('POST', '/reset-db');
  console.log('reset-db', rb.status, rb.data.ok ? 'ok' : JSON.stringify(rb.data));

  // Customers + stage distribution
  const custRes = await call('GET', '/customers');
  const custs = custRes.data.customers;
  const dist = {};
  for (const c of custs) dist[c.stage] = (dist[c.stage] || 0) + 1;
  console.log('CUSTOMERS total', custs.length, 'dist', JSON.stringify(dist));
  const withSentiment = custs.filter((c) => c.sentiment).length;
  console.log('withSentiment', withSentiment);

  // Feedback collection
  const fbRes = await call('GET', '/feedback');
  const fb = fbRes.data;
  console.log('FEEDBACK', fb.total);

  // Pick a To Send customer and run the full positive flow
  const toSend = custs.find((c) => c.stage === 'to_send');
  if (toSend) {
    await call('POST', `/customers/${toSend.id}/send`);
    let r = await call('POST', `/customers/${toSend.id}/open`);
    console.log('open ->', r.data.customer?.stage);
    r = await call('POST', `/customers/${toSend.id}/reply`, { reaction: 'positive' });
    console.log('reply positive ->', r.data.customer?.stage, r.data.customer?.sentiment);
    const detail = await call('GET', `/customers/${toSend.id}`);
    console.log('conversation bubbles', detail.data.conversation.map((b) => b.type).join(','));
    r = await call('POST', `/customers/${toSend.id}/review`);
    console.log('review ->', r.data.customer?.stage, 'reviewsReceived', r.data.reviewsReceived);
  }

  // Negative flow on a Sent customer
  const sent = custs.find((c) => c.stage === 'sent');
  if (sent) {
    await call('POST', `/customers/${sent.id}/open`);
    await call('POST', `/customers/${sent.id}/reply`, { reaction: 'negative' });
    const fb2 = await call('POST', `/customers/${sent.id}/feedback`, { complaint: 'Test complaint private.' });
    console.log('negative feedback saved ->', fb2.data.feedback?.complaint, 'stage', fb2.data.customer?.stage);
  }

  // Analytics sentiment
  const { data: an } = await call('GET', '/analytics');
  console.log('SENTIMENT', JSON.stringify(an.sentiment).slice(0, 400));
  console.log('weeksSum', an.weeks.reduce((s, w) => s + w.count, 0), 'total', an.total, 'dowSum', an.dow.reduce((s, d) => s + d, 0));

  // Reset the positive test customer back to to_send to keep data sane
  if (toSend) await call('POST', `/customers/${toSend.id}/reset`);
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
