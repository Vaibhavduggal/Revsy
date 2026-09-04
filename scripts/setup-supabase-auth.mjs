/**
 * Enables Supabase Google Auth and prints the anon key for SUPABASE_ANON_KEY.
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/setup-supabase-auth.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const ref = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const frontend = process.env.FRONTEND_URL || 'https://revsy-three.vercel.app';

if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN (Supabase dashboard → Account → Access tokens)');
  process.exit(1);
}
if (!ref) {
  console.error('SUPABASE_URL missing in server/.env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

if (clientId && clientSecret) {
  const patch = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      external_google_enabled: true,
      external_google_client_id: clientId,
      external_google_secret: clientSecret,
      external_google_skip_nonce_check: true,
      site_url: frontend.replace(/\/$/, ''),
      uri_allow_list: `${frontend.replace(/\/$/, '')}/auth/callback,http://localhost:5173/auth/callback`,
    }),
  });
  console.log('Enable Google provider:', patch.status, await patch.text());
} else {
  console.warn('GOOGLE_CLIENT_ID/SECRET not set — skipping provider enable');
}

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers });
const keysText = await keysRes.text();
console.log('API keys:', keysRes.status);
if (keysRes.ok) {
  const keys = JSON.parse(keysText);
  const anon = keys.find((k) => k.name === 'anon' || k.type === 'legacy' || String(k.name || '').includes('anon'));
  const publishable = keys.find((k) => k.type === 'publishable');
  const key = publishable?.api_key || anon?.api_key;
  if (key) {
    console.log('\nAdd to server/.env and Vercel:\nSUPABASE_ANON_KEY=' + key);
  } else {
    console.log(keysText);
  }
} else {
  console.log(keysText);
}

console.log('\nIn Google Cloud Console, add authorized redirect URI:');
console.log(`https://${ref}.supabase.co/auth/v1/callback`);
