import { supabase } from '../_lib/supabase.js';
import { auth, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;

  const { data } = await supabase.from('feedback').select('*').eq('business_id', business.id).order('created_at', { ascending: false });
  res.json({ feedback: data || [], total: (data || []).length });
}
