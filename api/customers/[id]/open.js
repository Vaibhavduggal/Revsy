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
  if (customer.stage !== 'sent' && customer.stage !== 'to_send') return res.status(400).json({ error: `Cannot open from stage "${customer.stage}"` });

  const { data: requests } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
  const request = requests?.[0];
  if (request) {
    const updates = {};
    if (!request.opened_at) updates.opened_at = new Date().toISOString();
    if (request.status === 'Sent') updates.status = 'Opened';
    await supabase.from('requests').update(updates).eq('id', request.id);
  }

  await supabase.from('customers').update({ stage: 'opened', last_request_status: 'Opened' }).eq('id', id);
  res.json({ customer: { id, stage: 'opened' } });
}
