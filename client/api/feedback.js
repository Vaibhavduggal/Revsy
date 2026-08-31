import { supabase, auth, cors } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;
  const { data } = await supabase.from('feedback').select('*').eq('business_id', business.id).order('created_at', { ascending: false });
  res.json({ feedback: data || [], total: (data || []).length });
}
