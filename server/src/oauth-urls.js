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

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/business.manage',
].join(' ');

export function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || '').trim();
}

export function googleClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
}

export function buildGoogleAuthUrl({ clientId, redirectUri, state, prompt = 'consent' }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: 'offline',
    prompt,
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
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
