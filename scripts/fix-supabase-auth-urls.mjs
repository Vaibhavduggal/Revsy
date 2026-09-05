/**
 * Fixes Supabase Auth redirect URLs (site_url + uri_allow_list).
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/fix-supabase-auth-urls.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const ref = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const frontend = (process.env.FRONTEND_URL || 'https://revsy-three.vercel.app').replace(/\/$/, '');

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
const base = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

const getRes = await fetch(base, { headers });
const cfg = await getRes.json();
console.log('BEFORE site_url:', cfg.site_url);
console.log('BEFORE uri_allow_list:', cfg.uri_allow_list);

const allow = new Set(
  String(cfg.uri_allow_list || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),
);
for (const u of [
  `${frontend}/auth/callback`,
  `${frontend}/**`,
  'http://localhost:5173/auth/callback',
  'http://localhost:4000/auth/callback',
]) {
  allow.add(u);
}

const patchRes = await fetch(base, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    site_url: frontend,
    uri_allow_list: [...allow].join(','),
  }),
});
const out = await patchRes.json();
console.log('PATCH status:', patchRes.status);
console.log('AFTER site_url:', out.site_url);
console.log('AFTER uri_allow_list:', out.uri_allow_list);
