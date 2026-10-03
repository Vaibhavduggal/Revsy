# AI agents working on Revsy

## gstack (recommended)

Install [gstack](https://github.com/garrytan/gstack) for structured review, QA, and security:

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --host cursor
```

Use **`/cso`** before security-sensitive changes, **`/review`** on PRs, **`/qa`** on `https://revsy-three.vercel.app` (or local).

## Security

Read **`docs/SECURITY.md`**. Run **`npm run security:audit`** locally.

Invite-only production sign-up: add owner emails in Admin → Invites before they can register.
