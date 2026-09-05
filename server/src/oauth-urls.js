function requestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http'))
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  if (!host) return null;
  return `${proto}://${host}`.replace(/\/$/, '');
}

function isLocalUrl(value) {
  return /localhost|127\.0\.0\.1/i.test(String(value || ''));
}

export function resolveGoogleRedirectUri(req) {
  const env = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (env && !isLocalUrl(env)) return env;
  const origin = requestOrigin(req);
  if (origin) return `${origin}/api/auth/google/callback`;
  return env || null;
}

export function resolveFrontendUrl(req) {
  const env = String(process.env.FRONTEND_URL || '').trim();
  if (env && !isLocalUrl(env)) return env.replace(/\/$/, '');
  const origin = requestOrigin(req);
  if (origin) return origin;
  if (env) return env.replace(/\/$/, '');
  if (process.env.GOOGLE_REDIRECT_URI && !isLocalUrl(process.env.GOOGLE_REDIRECT_URI)) {
    return new URL(process.env.GOOGLE_REDIRECT_URI).origin;
  }
  return '';
}
