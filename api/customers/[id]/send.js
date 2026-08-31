import { supabase } from '../../../_lib/supabase.js';
import { auth, cors } from '../../../_lib/auth.js';

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;
  const { id } = req.query;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', business.id).single();
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  let { data: request } = await supabase.from('requests').select('*').eq('customer_id', id).eq('status', 'Scheduled').single();
  const message = renderTemplate(business.message_template || business.messageTemplate, { customerName: customer.name, businessName: business.name, reviewLink: business.google_review_link || business.googleReviewLink });

  if (!request) {
    request = { id: `req_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, business_id: business.id, customer_id: id, customer_name: customer.name, phone: customer.phone, message, status: 'Scheduled' };
    await supabase.from('requests').insert(request);
  }

  // Enqueue send immediately (0 delay)
  const psId = `ps_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await supabase.from('pending_sends').insert({
    id: psId, business_id: business.id, customer_id: id, phone: customer.phone, message,
    scheduled_time: new Date().toISOString(), status: 'pending',
  });

  await supabase.from('requests').update({ message, sent_at: new Date().toISOString(), status: 'Sent' }).eq('id', request.id);
  await supabase.from('customers').update({ stage: 'sent', last_request_at: new Date().toISOString(), last_request_status: 'Sent' }).eq('id', id);

  res.json({ request: { ...request, status: 'Sent' }, customer: { id, stage: 'sent' } });
}
