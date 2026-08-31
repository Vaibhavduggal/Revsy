import { supabase } from '../../_lib/supabase.js';
import { adminAuth, cors } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const adminId = await adminAuth(req, res);
  if (!adminId) return;
  const { id } = req.query;

  if (id === 'biz_1') return res.status(403).json({ error: 'Cannot remove the demo account' });
  const { data: biz } = await supabase.from('businesses').select('*').eq('id', id).single();
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  await supabase.from('pending_sends').delete().eq('business_id', id);
  await supabase.from('activities').delete().eq('business_id', id);
  await supabase.from('feedback').delete().eq('business_id', id);
  await supabase.from('reviews').delete().eq('business_id', id);
  await supabase.from('requests').delete().eq('business_id', id);
  await supabase.from('customers').delete().eq('business_id', id);
  await supabase.from('tokens').delete().eq('business_id', id);
  await supabase.from('businesses').delete().eq('id', id);

  res.json({ ok: true });
}
