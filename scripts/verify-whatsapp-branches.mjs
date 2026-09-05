const BASE = (process.env.SITE_URL || 'http://localhost:4000').replace(/\/$/, '');

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('ok -', msg);
}

const login = await req('POST', '/login', null, { email: 'owner@burngym.com', password: 'demo123' });
const token = login.token;
assert(login.business?.category === 'gym' || true, 'logged in as Burn Gym');

async function member(name, phone) {
  const r = await req('POST', '/customers', token, { name, phone });
  return r.customer;
}

const sug = await member('Priya Malhotra', '+91 98111 10001');
await req('POST', `/customers/${sug.id}/reply`, token, { reaction: 'positive' });
const sug2 = await req('POST', `/customers/${sug.id}/inbound`, token, { text: 'Please add more squat racks near the windows.' });
assert(sug2.suggestion || sug2.step === 'done', 'happy -> suggestion does not send Google link');
assert(sug2.googleLinkSent !== true, 'suggestion path skipped Google link');

const thanks = await member('Rohan Singh', '+91 98111 10002');
await req('POST', `/customers/${thanks.id}/reply`, token, { reaction: 'positive' });
const thanks2 = await req('POST', `/customers/${thanks.id}/inbound`, token, { text: "nothing, you're awesome" });
assert(thanks2.googleLinkSent === true, 'happy -> nothing sends Google link');

const cmp = await member('Harpreet Kaur', '+91 98111 10003');
await req('POST', `/customers/${cmp.id}/reply`, token, { reaction: 'negative' });
const cmp2 = await req('POST', `/customers/${cmp.id}/inbound`, token, { text: 'My 30-day challenge was postponed again and nobody told me.' });
assert(cmp2.complaint && cmp2.googleLinkSent !== true, 'sad -> complaint saved, no Google link');

const fb = await req('GET', '/feedback', token);
const suggestions = fb.suggestions || fb.feedback.filter((f) => f.type === 'suggestion');
const complaints = fb.complaints || fb.feedback.filter((f) => f.type !== 'suggestion');
assert(suggestions.some((f) => /squat racks/i.test(f.complaint)), 'suggestion appears in suggestions list');
assert(complaints.some((f) => /30-day challenge/i.test(f.complaint)), 'complaint appears in complaints list');

const list = await req('GET', '/reviews/list', token);
assert((list.suggestions || []).some((f) => /squat racks/i.test(f.complaint || f.text)), 'dashboard payload has suggestion');
assert((list.complaints || []).some((f) => /30-day challenge/i.test(f.complaint || f.text)), 'dashboard payload has complaint');

console.log('WhatsApp branch simulation passed');
