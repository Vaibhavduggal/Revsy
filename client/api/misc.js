import { supabase, adminAuth, cors, generateId } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = req.url || '';
  if (url.includes('/sync-reviews')) {
    const adminId = await adminAuth(req, res);
    if (!adminId) return;
    const { placeId, apiKey } = req.body || {};
    const { data: business } = await supabase.from('businesses').select('*').eq('id', adminId).single();
    if (!business) return res.status(404).json({ error: 'Business not found' });
    if (!placeId || !apiKey) return res.json({ connected: false, error: 'Place ID and API key required' });
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`);
      const data = await response.json();
      if (data.status !== 'OK') return res.json({ connected: false, error: 'Failed to fetch reviews' });
      const { data: existing } = await supabase.from('reviews').select('customer_id').eq('business_id', business.id);
      const existingIds = (existing || []).map(r => r.customer_id).filter(Boolean);
      const newReviews = [];
      for (const rev of (data.result.reviews || [])) {
        if (existingIds.includes(rev.author_name)) continue;
        newReviews.push({ id: `google_rev_${rev.author_name}`, business_id: business.id, customer_id: rev.author_name, customer_name: rev.author_name, rating: rev.rating, sentiment: rev.rating >= 4 ? 'positive' : 'negative', created_at: new Date().toISOString(), from_google: true });
        existingIds.push(rev.author_name);
      }
      if (newReviews.length) await supabase.from('reviews').insert(newReviews);
      const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
      await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
      return res.json({ connected: true, synced: newReviews.length, total: count });
    } catch { return res.status(500).json({ connected: false, error: 'Error syncing' }); }
  }

  if (url.includes('/reset-db')) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const { data } = await supabase.from('tokens').select('business_id').eq('token', token).single();
    if (!data) return res.status(401).json({ error: 'Auth required' });
    const bid = data.business_id;
    await supabase.from('pending_sends').delete().eq('business_id', bid);
    await supabase.from('activities').delete().eq('business_id', bid);
    await supabase.from('feedback').delete().eq('business_id', bid);
    await supabase.from('reviews').delete().eq('business_id', bid);
    await supabase.from('requests').delete().eq('business_id', bid);
    await supabase.from('customers').delete().eq('business_id', bid);
    await supabase.from('businesses').update({ reviews_received: 0 }).eq('id', bid);
    const SAMPLE = ['Aarav Sharma', 'Vivaan Patel', 'Aditya Gupta'];
    const PFX = ['981', '982', '983'];
    let seed = 20260829;
    function rng() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    const stages = ['to_send', 'sent', 'opened', 'positive', 'negative', 'reviewed'];
    const custs = SAMPLE.map((name, i) => ({ id: generateId('cust'), business_id: bid, name, phone: `+91 ${PFX[i]}${String(Math.floor(rng() * 10000000)).padStart(7, '0')}`, stage: stages[Math.floor(rng() * stages.length)], created_at: new Date().toISOString() }));
    await supabase.from('customers').insert(custs);
    return res.json({ ok: true });
  }

  res.status(404).json({ error: 'Unknown endpoint' });
}
