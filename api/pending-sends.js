import { supabase } from '../_lib/supabase.js';
import { auth, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;

  if (req.method === 'GET') {
    const { data } = await supabase.from('pending_sends').select('*').eq('business_id', business.id).eq('status', 'failed');
    const { data: customers } = await supabase.from('customers').select('*').eq('business_id', business.id);
    const list = (data || []).map(s => ({ id: s.id, customerId: s.customer_id, phone: s.phone, error: s.error, retryCount: s.retry_count, customerName: (customers || []).find(c => c.id === s.customer_id)?.name || s.phone }));
    return res.json({ failed: list });
  }

  if (req.method === 'POST' && req.url?.includes('/retry')) {
    const urlParts = req.url.split('/');
    const id = urlParts[urlParts.length - 2]; // get id before 'retry'
    const { data: row } = await supabase.from('pending_sends').select('*').eq('id', id).single();
    if (!row) return res.status(404).json({ error: 'Pending send not found' });
    await supabase.from('pending_sends').update({ status: 'pending', scheduled_time: new Date().toISOString(), retry_count: 0, error: null }).eq('id', id);
    return res.json({ ok: true, status: 'pending' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
