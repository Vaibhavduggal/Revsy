import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export async function auth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return null; }
  const { data, error } = await supabase.from('tokens').select('business_id').eq('token', token).single();
  if (error || !data) { res.status(401).json({ error: 'Invalid token' }); return null; }
  const { data: business } = await supabase.from('businesses').select('*').eq('id', data.business_id).single();
  if (!business) { res.status(401).json({ error: 'Business not found' }); return null; }
  return business;
}

export async function adminAuth(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) { res.status(401).json({ error: 'Admin auth required' }); return null; }
  const { data } = await supabase.from('tokens').select('business_id').eq('token', token).single();
  if (!data || data.business_id !== 'admin_1') { res.status(401).json({ error: 'Admin auth required' }); return null; }
  return data.business_id;
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
}
