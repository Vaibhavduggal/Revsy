import { supabase } from '../_lib/supabase.js';
import { auth, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;

  // Seed fresh demo data
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.default.hashSync('demo123', 10);
  const adminHash = bcrypt.default.hashSync('admin123', 10);

  // Clear existing data
  await supabase.from('pending_sends').delete().eq('business_id', business.id);
  await supabase.from('activities').delete().eq('business_id', business.id);
  await supabase.from('feedback').delete().eq('business_id', business.id);
  await supabase.from('reviews').delete().eq('business_id', business.id);
  await supabase.from('requests').delete().eq('business_id', business.id);
  await supabase.from('customers').delete().eq('business_id', business.id);

  // Reset business
  await supabase.from('businesses').update({ reviews_received: 0, password: hash }).eq('id', business.id);

  // Seed customers
  const SAMPLE_NAMES = ['Aarav Sharma', 'Vivaan Patel', 'Aditya Gupta', 'Vihaan Reddy', 'Arjun Nair', 'Sai Kumar', 'Rohan Mehta', 'Karan Singh', 'Ananya Iyer', 'Diya Verma'];
  const PHONE_PREFIXES = ['981', '982', '983', '984', '985', '986', '987', '988', '989', '990'];
  const stages = ['to_send', 'sent', 'opened', 'positive', 'negative', 'reviewed'];
  let seed = 20260829;
  function rng() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

  const customers = [];
  for (let i = 0; i < 10; i++) {
    const stage = stages[Math.floor(rng() * stages.length)];
    const phone = `+91 ${PHONE_PREFIXES[i]}${String(Math.floor(rng() * 10000000)).padStart(7, '0')}`;
    const cid = `cust_${i + 1}`;
    customers.push({ id: cid, business_id: business.id, name: SAMPLE_NAMES[i], phone, stage, sentiment: stage === 'positive' ? 'positive' : stage === 'negative' ? 'negative' : null, complaint: stage === 'negative' ? 'Food took a while.' : '', created_at: new Date(Date.now() - Math.floor(rng() * 84) * 86400000).toISOString() });
  }
  await supabase.from('customers').insert(customers);

  res.json({ ok: true, message: 'Database reset with demo data' });
}
