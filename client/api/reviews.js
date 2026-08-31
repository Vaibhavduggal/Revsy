import { supabase, auth, cors, generateId } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('reviews').select('*').eq('business_id', business.id).order('created_at', { ascending: false });
    return res.json({ reviews: data || [], total: (data || []).length });
  }
  if (req.method === 'POST') {
    const { customerId, customerName, rating } = req.body || {};
    const review = { id: generateId('rev'), business_id: business.id, customer_id: customerId || null, customer_name: customerName || null, rating: Number.isFinite(Number(rating)) ? Number(rating) : 5, request_id: null, sent_at: null, created_at: new Date().toISOString() };
    await supabase.from('reviews').insert(review);
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
    return res.json({ review, total: count });
  }
  if (req.method === 'DELETE') {
    const { data: mine } = await supabase.from('reviews').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(1);
    if (mine?.length) await supabase.from('reviews').delete().eq('id', mine[0].id);
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
    return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
