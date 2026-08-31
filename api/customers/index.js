import { supabase } from '../../_lib/supabase.js';
import { auth, cors } from '../../_lib/auth.js';

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('customers').select('*').eq('business_id', business.id).order('created_at', { ascending: false });
    const customers = (data || []).map(c => ({
      id: c.id, name: c.name, phone: c.phone, customMessage: c.custom_message,
      hasCustomMessage: !!(c.custom_message && c.custom_message.trim()),
      stage: c.stage || 'to_send', sentiment: c.sentiment, complaint: c.complaint,
      createdAt: c.created_at, lastRequestAt: c.last_request_at, lastRequestStatus: c.last_request_status,
    }));
    return res.json({ customers });
  }

  if (req.method === 'POST') {
    const { name, phone } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });
    const id = `cust_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const reqId = `req_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const message = renderTemplate(business.message_template || business.messageTemplate, { customerName: name.trim(), businessName: business.name, reviewLink: business.google_review_link || business.googleReviewLink });

    await supabase.from('customers').insert({
      id, business_id: business.id, name: name.trim(), phone: phone.trim(), stage: 'to_send',
    });
    await supabase.from('requests').insert({
      id: reqId, business_id: business.id, customer_id: id, customer_name: name.trim(),
      phone: phone.trim(), message, status: 'Scheduled',
    });
    // Enqueue a pending send
    const delay = business.demo_mode ? 10 : (business.delay_seconds || business.delaySeconds || 7200);
    await supabase.from('pending_sends').insert({
      id: `ps_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      business_id: business.id, customer_id: id, phone: phone.trim(), message,
      scheduled_time: new Date(Date.now() + delay * 1000).toISOString(), status: 'pending',
    });

    return res.json({ customer: { id, name: name.trim(), phone: phone.trim(), stage: 'to_send' } });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
