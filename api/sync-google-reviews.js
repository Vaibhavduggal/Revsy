import { supabase } from '../_lib/supabase.js';
import { adminAuth, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const adminId = await adminAuth(req, res);
  if (!adminId) return;

  const { placeId, apiKey } = req.body || {};
  const { data: business } = await supabase.from('businesses').select('*').eq('id', adminId).single();
  if (!business) return res.status(404).json({ error: 'Business not found' });
  if (!placeId || !apiKey) return res.json({ connected: false, error: 'Place ID and API key are required' });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`);
    const data = await response.json();
    if (data.status !== 'OK') return res.json({ connected: false, error: 'Failed to fetch Google reviews.' });
    const fetchedReviews = data.result.reviews || [];
    const { data: existing } = await supabase.from('reviews').select('customer_id').eq('business_id', business.id);
    const existingIds = (existing || []).map(r => r.customer_id).filter(Boolean);
    const newReviews = [];
    for (const rev of fetchedReviews) {
      if (existingIds.includes(rev.author_name)) continue;
      newReviews.push({ id: `google_rev_${rev.author_name}`, business_id: business.id, customer_id: rev.author_name, customer_name: rev.author_name, rating: rev.rating, sentiment: rev.rating >= 4 ? 'positive' : 'negative', request_id: null, sent_at: null, created_at: new Date().toISOString(), from_google: true });
      existingIds.push(rev.author_name);
    }
    if (newReviews.length) await supabase.from('reviews').insert(newReviews);
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
    res.json({ connected: true, synced: newReviews.length, total: count });
  } catch (err) {
    res.status(500).json({ connected: false, error: 'Error syncing Google reviews' });
  }
}
