import { supabase } from '../../_lib/supabase.js';
import { adminAuth, cors } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const adminId = await adminAuth(req, res);
  if (!adminId) return;

  const { data: businesses } = await supabase.from('businesses').select('*');
  const { data: allReqs } = await supabase.from('requests').select('business_id, status');
  const { data: allCustomers } = await supabase.from('customers').select('business_id');

  const list = (businesses || []).map(b => ({
    id: b.id, name: b.name, ownerEmail: b.owner_email, subscriptionStatus: b.subscription_status,
    requestsSent: (allReqs || []).filter(r => r.business_id === b.id && r.status !== 'Scheduled').length,
    customersCount: (allCustomers || []).filter(c => c.business_id === b.id).length,
    createdAt: b.created_at,
  }));

  res.json({ businesses: list });
}
