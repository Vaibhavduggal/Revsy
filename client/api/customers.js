import { supabase, auth, cors, generateId } from './_lib.js';

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('customers').select('*').eq('business_id', business.id).order('created_at', { ascending: false });
    return res.json({ customers: (data || []).map(c => ({ id: c.id, name: c.name, phone: c.phone, customMessage: c.custom_message, hasCustomMessage: !!(c.custom_message && c.custom_message.trim()), stage: c.stage || 'to_send', sentiment: c.sentiment, complaint: c.complaint, createdAt: c.created_at, lastRequestAt: c.last_request_at, lastRequestStatus: c.last_request_status })) });
  }

  if (req.method === 'POST') {
    const { name, phone } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    const id = generateId('cust');
    const reqId = generateId('req');
    const message = renderTemplate(business.message_template || 'Hi [customer name], thank you for visiting [business name]!', { customerName: name.trim(), businessName: business.name, reviewLink: business.google_review_link || '' });
    await supabase.from('customers').insert({ id, business_id: business.id, name: name.trim(), phone: phone.trim(), stage: 'to_send' });
    await supabase.from('requests').insert({ id: reqId, business_id: business.id, customer_id: id, customer_name: name.trim(), phone: phone.trim(), message, status: 'Scheduled' });
    const delay = business.demo_mode ? 10 : (business.delay_seconds || 7200);
    await supabase.from('pending_sends').insert({ id: generateId('ps'), business_id: business.id, customer_id: id, phone: phone.trim(), message, scheduled_time: new Date(Date.now() + delay * 1000).toISOString(), status: 'pending' });
    return res.json({ customer: { id, name: name.trim(), phone: phone.trim(), stage: 'to_send' } });
  }

  if (req.method === 'POST' && req.body?.customers) {
    const rows = Array.isArray(req.body.customers) ? req.body.customers : [];
    let added = 0, skipped = 0;
    for (const row of rows) {
      const n = String(row.name || '').trim(), p = String(row.phone || '').trim();
      if (!n || !p) { skipped++; continue; }
      const id = generateId('cust');
      await supabase.from('customers').insert({ id, business_id: business.id, name: n, phone: p, stage: 'to_send' });
      const message = renderTemplate(business.message_template || 'Hi [customer name]!', { customerName: n, businessName: business.name, reviewLink: business.google_review_link || '' });
      await supabase.from('requests').insert({ id: generateId('req'), business_id: business.id, customer_id: id, customer_name: n, phone: p, message, status: 'Scheduled' });
      added++;
    }
    return res.json({ added, skipped });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
