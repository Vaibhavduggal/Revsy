import { supabase } from '../_lib/supabase.js';
import { auth, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;

  if (req.method === 'POST' && req.url?.includes('/increment')) {
    await supabase.from('reviews').insert({ id: `rev_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, business_id: business.id, customer_id: null, customer_name: null, rating: 5, request_id: null, sent_at: null, created_at: new Date().toISOString() });
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
    return res.json({ reviewsReceived: count });
  }

  if (req.method === 'POST' && req.url?.includes('/decrement')) {
    const { data: mine } = await supabase.from('reviews').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(1);
    if (mine && mine.length) await supabase.from('reviews').delete().eq('id', mine[0].id);
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
    return res.json({ reviewsReceived: count });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
