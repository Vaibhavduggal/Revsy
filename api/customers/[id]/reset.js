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

  await supabase.from('customers').update({ stage: 'to_send', sentiment: null, complaint: '', reacted_at: null, reviewed_google_at: null }).eq('id', id);
  await supabase.from('feedback').delete().eq('customer_id', id);

  const { data: oldReviews } = await supabase.from('reviews').select('*').eq('customer_id', id);
  await supabase.from('reviews').delete().eq('customer_id', id);

  const { data: reqs } = await supabase.from('requests').select('*').eq('customer_id', id);
  for (const r of (reqs || [])) {
    await supabase.from('requests').update({ status: 'Scheduled', reaction: null, opened_at: null, reviewed_at: null }).eq('id', r.id);
  }

  let reviewsReceived = business.reviews_received || 0;
  if (oldReviews && oldReviews.length > 0) {
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    reviewsReceived = count;
    await supabase.from('businesses').update({ reviews_received: reviewsReceived }).eq('id', business.id);
  }

  res.json({ customer: { id, stage: 'to_send' }, reviewsReceived });
}
