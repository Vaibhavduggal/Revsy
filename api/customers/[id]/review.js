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
  if (customer.stage !== 'positive') return res.status(400).json({ error: `Cannot review from stage "${customer.stage}"` });

  const { data: requests } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
  const request = requests?.[0];
  const now = new Date().toISOString();
  if (request) await supabase.from('requests').update({ status: 'Reviewed', reviewed_at: now }).eq('id', request.id);
  await supabase.from('customers').update({ stage: 'reviewed', reviewed_google_at: now, last_request_status: 'Reviewed' }).eq('id', id);

  const { data: existing } = await supabase.from('reviews').select('*').eq('customer_id', id).single();
  if (!existing) {
    await supabase.from('reviews').insert({ id: `rev_${customer.id}`, business_id: business.id, customer_id: id, customer_name: customer.name, rating: 5, request_id: request?.id || null, sent_at: request?.sent_at || null, created_at: now });
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
    return res.json({ customer: { id, stage: 'reviewed' }, reviewsReceived: count });
  }
  const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
  res.json({ customer: { id, stage: 'reviewed' }, reviewsReceived: count });
}
