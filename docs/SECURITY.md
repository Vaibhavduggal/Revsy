# Revsy security

## Your operating model (invite-only)

Production defaults to **invite-only sign-up** (`SIGNUP_MODE` unset or `invite_only`). You onboard local businesses via Admin invites; random visitors cannot create accounts.

Set `SIGNUP_MODE=open` only if you intentionally want public registration.

## Environment variables (Vercel + local)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — never expose to client |
| `CRON_SECRET` | **Required in production** — Vercel Cron sends `Authorization: Bearer …` |
| `FRONTEND_URL` | Production origin for CORS (e.g. `https://revsy-three.vercel.app`) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **Required in production** for Meta webhook verification |
| `INBOUND_WEBHOOK_SECRET` | Required in production for `POST /api/webhooks/inbound` |
| `SIGNUP_MODE` | `invite_only` (default in prod) or `open` |

Copy `server/.env.example` → `server/.env` locally. **Never commit `.env`.**

If keys ever appeared in chat, logs, or screenshots: **rotate** Google OAuth secret, Groq/Gemini keys, Supabase service role, cron secret, and admin password.

## What we hardened in code

- Rate limits on auth, signup, webhooks, and general API
- Security headers (HSTS in production, `X-Frame-Options`, etc.)
- CORS restricted to `FRONTEND_URL` in production
- Cron jobs reject missing `CRON_SECRET` in production
- WhatsApp verify token required in production
- Dev-only `/api/webhooks/inbound` unless `INBOUND_WEBHOOK_SECRET` is set
- `POST /api/reset-db` disabled in production
- Password minimum length (10) on email signup
- Supabase RLS on `review_reply_audit`

## Checks to run

```bash
npm run security:audit
```

### gstack (Cursor / Claude Code)

Install once on your machine (Git Bash or WSL on Windows):

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --host cursor
```

Then in Cursor, ask the agent to run **gstack `/cso`** for OWASP-style review and **`/review`** before shipping.

Team bootstrap (optional, from repo root):

```bash
~/.claude/skills/gstack/bin/gstack-team-init optional
```

### Strix (dynamic pentest)

Requires Docker + an LLM API key. See [Strix docs](https://docs.strix.ai).

```bash
curl -sSL https://strix.ai/install | bash
export LLM_API_KEY=...
strix --target https://your-revsy-domain
```

Review findings under `strix_runs/`. Do not run aggressive scans against production without consent.

## Admin

- Admin API routes use `adminAuth` (separate session table).
- Create businesses and **email invites** from `/admin` only.
- Use a strong `ADMIN_PASSWORD` in Vercel (not `admin123`).

## CSRF note

The SPA uses **Bearer tokens** in `Authorization`, not cookie sessions — classic CSRF against the API is low risk. Keep tokens in `localStorage` only over HTTPS.
