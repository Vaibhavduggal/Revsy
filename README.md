# ReviewBot — Review Collection SaaS (Demo)

A local-first, full-stack demo of a review-collection SaaS, branded for **Smash Bros**, a
smash-burger restaurant in Ludhiana, Punjab. It pitches the business of automatically
collecting Google reviews by following up with customers over **simulated** WhatsApp.

> Everything runs locally. No API keys, no paid services, no real messages are ever sent.
> Outgoing WhatsApp messages are rendered as a phone-frame mockup inside the UI.

## Stack

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node + Express + lowdb (JSON file storage, no external DB)
- **Storage:** `server/data/db.json` (auto-seeded on first run)

## Run it

```bash
npm install          # installs concurrently (root)
npm run install:all  # installs server + client deps
npm run dev          # starts API (4000) + client (5173) together
```

Open **http://localhost:5173**.

Demo login:
- Email: `owner@business.com`
- Password: `demo123`

## Features

1. **Landing page** (pre-login) — hero, feature highlights, pricing (₹999/month), CTAs.
2. **Login** — single business account (structured for future multi-tenancy via `businessId`).
3. **Dashboard** — requests sent, reviews received (+/− counter), conversion rate,
   8-week bar chart, recent-10 table, WhatsApp activity feed, Quick-Add popup.
4. **Customers** — add manually, import CSV, list with date added, "Send now" with
   green checkmark, live WhatsApp phone-frame preview.
5. **Simulated WhatsApp** — when a customer is added, a request is scheduled after the
   configured delay (default 2h, or 10s in demo mode) and appears in the activity feed.
6. **Settings** — business name, Google review link, editable message template, delay,
   and a "demo mode: send in 10 seconds" toggle. Live message preview.
7. **Admin** — business account table (subscription, requests sent, created date),
   structured to list more businesses later.

## Seed data

On first run the database is seeded with ~18 fake customers and ~42 historical review
requests across the last 8 weeks, with a realistic mix of `Sent` / `Opened` / `Reviewed`
statuses so the dashboard looks alive immediately.

## Resetting demo data

Call `POST /api/reset-db` (authenticated) to regenerate the seed, or simply delete
`server/data/db.json` and restart.

## Project layout

```
.
├── package.json          # runs server + client together
├── server/               # Express + lowdb API
│   ├── src/db.js         # lowdb setup + seed
│   ├── src/routes.js     # API routes + simulated send scheduler
│   └── src/server.js
└── client/               # React + Vite app
    └── src/
        ├── pages/        # Landing, Login, Dashboard, Customers, Settings, Admin
        └── components/   # Topbar, Modal, PhoneMockup, Toggle, Icons
```
