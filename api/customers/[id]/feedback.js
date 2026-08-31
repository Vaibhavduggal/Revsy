import { supabase } from '../../../_lib/supabase.js';
import { auth, cors } from '../../../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;
  const { id } = req.query;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', business.id).single();
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.stage !== 'negative') return res.status(400).json({ error: `Cannot submit feedback from stage "${customer.stage}"` });

  const { complaint, name, phone } = req.body || {};
  const text = (complaint && String(complaint).trim()) || customer.complaint || '';
  const now = new Date().toISOString();

  const { data: existing } = await supabase.from('feedback').select('*').eq('customer_id', id).single();
  if (!existing) {
    await supabase.from('feedback').insert({ id: `fb_${customer.id}`, business_id: business.id, customer_id: id, customer_name: customer.name, phone: customer.phone, complaint: text, created_at: now, submitted_at: now });
  } else {
    await supabase.from('feedback').update({ complaint: text, customer_name: name ? String(name).trim() : customer.name, phone: phone ? String(phone).trim() : customer.phone, submitted_at: now }).eq('id', existing.id);
  }
  await supabase.from('customers').update({ complaint: text, stage: 'negative' }).eq('id', id);

  res.json({ feedback: { id: `fb_${customer.id}`, complaint: text }, customer: { id, stage: 'negative' } });
}
