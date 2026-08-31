import { supabase, adminAuth, cors, generateId } from './_lib.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const adminId = await adminAuth(req, res);
  if (!adminId) return;

  if (req.method === 'GET') {
    const { data: businesses } = await supabase.from('businesses').select('*');
    const { data: allReqs } = await supabase.from('requests').select('business_id, status');
    const { data: allCustomers } = await supabase.from('customers').select('business_id');
    return res.json({ businesses: (businesses || []).map(b => ({ id: b.id, name: b.name, ownerEmail: b.owner_email, subscriptionStatus: b.subscription_status, requestsSent: (allReqs || []).filter(r => r.business_id === b.id && r.status !== 'Scheduled').length, customersCount: (allCustomers || []).filter(c => c.business_id === b.id).length, createdAt: b.created_at })) });
  }
  if (req.method === 'POST') {
    const { businessName, ownerEmail, initialPassword } = req.body || {};
    if (!businessName || !ownerEmail || !initialPassword) return res.status(400).json({ error: 'Required fields missing' });
    const { data: existing } = await supabase.from('businesses').select('*').eq('owner_email', ownerEmail).single();
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const id = generateId('biz');
    await supabase.from('businesses').insert({ id, name: businessName, owner_email: ownerEmail, password: bcrypt.hashSync(initialPassword, 10), message_template: 'Hi [customer name], thank you for visiting [business name]!', delay_seconds: 7200, created_at: new Date().toISOString() });
    return res.json({ id, name: businessName, ownerEmail });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
