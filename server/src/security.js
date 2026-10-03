/**
 * Production security helpers — rate limits, CORS, headers, signup policy.
 */

export function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

/** Invite-only by default in production (local outreach model). Set SIGNUP_MODE=open to allow public signup. */
export function inviteOnlySignup() {
  const mode = String(process.env.SIGNUP_MODE || '').toLowerCase();
  if (mode === 'open') return false;
  if (mode === 'invite_only') return true;
  return isProduction();
}

export function cronAuthRequired() {
  if (process.env.CRON_REQUIRE_SECRET === 'false') return false;
  return isProduction();
}

export function assertCronAuthorized(req, res) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret && cronAuthRequired()) {
    res.status(503).json({ error: 'CRON_SECRET must be set in production' });
    return false;
  }
  if (!secret) return true;
  const authz = req.headers.authorization || '';
  if (authz !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function resolveCorsOrigin() {
  const raw = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '';
  const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0) {
    return isProduction() ? false : true;
  }
  return origins;
}

export function inboundWebhookAuthorized(req) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET || '';
  if (!secret) {
    return !isProduction();
  }
  const header = req.headers['x-revsy-webhook-secret'] || req.headers['x-webhook-secret'] || '';
  return String(header) === secret;
}

export function validatePassword(password) {
  const p = String(password || '');
  if (p.length < 10) return 'Password must be at least 10 characters';
  if (p.length > 128) return 'Password is too long';
  return null;
}

export function sanitizeShortText(value, max = 500) {
  if (value == null) return '';
  return String(value).replace(/\0/g, '').trim().slice(0, max);
}
