import { supabase } from '../../_lib/supabase.js';
import { adminAuth, cors } from '../../_lib/auth.js';
import bcrypt from 'bcryptjs';

const DEFAULT_TEMPLATE = 'Hi [customer name], thank you for visiting [business name]! We\'d love to hear about your experience. It only takes 30 seconds: [google review link]';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const adminId = await adminAuth(req, res);
  if (!adminId) return;

  if (req.method === 'POST') {
    const { businessName, ownerEmail, initialPassword } = req.body || {};
    if (!businessName || !ownerEmail || !initialPassword) return res.status(400).json({ error: 'Business name, owner email and initial password are required' });
    const { data: existing } = await supabase.from('businesses').select('*').eq('owner_email', ownerEmail).single();
    if (existing) return res.status(409).json({ error: 'A business with this email already exists' });
    const hashedPwd = bcrypt.hashSync(initialPassword, 10);
    const id = `biz_${Date.now()}`;
    await supabase.from('businesses').insert({ id, name: businessName, owner_email: ownerEmail, password: hashedPwd, message_template: DEFAULT_TEMPLATE, delay_seconds: 7200, created_at: new Date().toISOString() });
    return res.json({ id, name: businessName, ownerEmail });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
