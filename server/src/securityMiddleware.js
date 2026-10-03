import rateLimit from 'express-rate-limit';
import { resolveCorsOrigin } from './security.js';

const jsonLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message },
});

export const authRateLimiter = jsonLimiter(15 * 60 * 1000, 30, 'Too many auth attempts. Try again later.');
export const signupRateLimiter = jsonLimiter(60 * 60 * 1000, 10, 'Too many sign-up attempts. Try again later.');
export const webhookRateLimiter = jsonLimiter(60 * 1000, 120, 'Too many webhook requests.');
export const apiRateLimiter = jsonLimiter(60 * 1000, 300, 'Too many requests. Slow down.');

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.removeHeader('X-Powered-By');
  next();
}

export function buildCorsOptions() {
  const origin = resolveCorsOrigin();
  if (origin === true) {
    return { origin: true, credentials: false };
  }
  if (origin === false) {
    return {
      origin(originHeader, cb) {
        cb(new Error('CORS origin not configured — set FRONTEND_URL'));
      },
    };
  }
  return {
    origin(originHeader, cb) {
      if (!originHeader) return cb(null, true);
      if (origin.includes(originHeader)) return cb(null, originHeader);
      return cb(null, false);
    },
    credentials: false,
  };
}
