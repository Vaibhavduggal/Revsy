import { supabase, cors, generateId } from './_lib.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  const { data: business, error } = await supabase.from('businesses').select('*').eq('owner_email', email).single();
  if (error || !business) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(password, business.password)) return res.status(401).json({ error: 'Invalid email or password' });

  const token = `tkn${Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('')}`;
  await supabase.from('tokens').insert({ token, business_id: business.id });
  res.json({ token, business: { id: business.id, name: business.name, ownerEmail: business.owner_email, isAdmin: business.id === 'admin_1' } });
}
