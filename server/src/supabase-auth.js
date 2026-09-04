import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function authSecret() {
  return process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'revsy-dev';
}

export function signOAuthState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', authSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOAuthState(state) {
  if (!state || !String(state).includes('.')) return null;
  const [body, sig] = String(state).split('.');
  const expected = crypto.createHmac('sha256', authSecret()).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.ts || Date.now() - data.ts > 15 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function getSupabaseAdmin() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase is not configured');
  return createClient(url, key);
}

export async function verifySupabaseAccessToken(accessToken) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

export function buildSupabaseGoogleAuthUrl({ redirectTo, state }) {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey) throw new Error('Supabase Auth is not configured (missing SUPABASE_ANON_KEY)');
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
    apikey: anonKey,
  });
  if (state) params.set('state', state);
  return `${url.replace(/\/$/, '')}/auth/v1/authorize?${params.toString()}`;
}

export function getPublicSupabaseConfig() {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  return {
    supabaseUrl,
    supabaseAnonKey,
    googleAuthEnabled: !!(supabaseUrl && supabaseAnonKey),
  };
}
