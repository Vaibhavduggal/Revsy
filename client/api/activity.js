import { supabase, auth, cors } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;
  const { data } = await supabase.from('activities').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(30);
  res.json({ activities: data || [] });
}
