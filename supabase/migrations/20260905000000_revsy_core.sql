-- Revsy core schema. Idempotent so it can be applied on an existing project.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  token text primary key,
  admin_id text not null references public.admins(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id text primary key,
  name text not null,
  owner_email text not null unique,
  password text not null,
  is_demo boolean not null default false,
  google_review_link text not null default '',
  feedback_link text not null default '',
  address text not null default '',
  phone text not null default '',
  description text not null default '',
  message_template text not null,
  delay_seconds integer not null default 1800,
  demo_mode boolean not null default false,
  subscription_status text not null default 'trial',
  created_at timestamptz not null default now(),
  place_id text not null default '',
  whatsapp_bsp text not null default '',
  whatsapp_api_key text not null default '',
  whatsapp_phone_number_id text not null default '',
  whatsapp_status text not null default 'not_connected',
  whatsapp_campaign_name text not null default '',
  reviews_received integer not null default 0,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  google_connected boolean not null default false,
  google_account_email text,
  google_account_name text,
  google_location_name text,
  onboarding_completed boolean not null default false,
  approval_status text not null default 'pending_approval',
  pre_approved boolean not null default false,
  approved_at timestamptz,
  rejected_at timestamptz,
  constraint businesses_approval_status_check
    check (approval_status in ('pending_approval', 'approved', 'rejected')),
  constraint businesses_whatsapp_status_check
    check (whatsapp_status in ('not_connected', 'connected')),
  constraint businesses_subscription_status_check
    check (subscription_status in ('trial', 'active', 'cancelled'))
);

alter table public.businesses add column if not exists whatsapp_campaign_name text not null default '';
alter table public.businesses add column if not exists google_account_name text;
alter table public.businesses add column if not exists google_location_name text;
alter table public.businesses add column if not exists approval_status text not null default 'pending_approval';
alter table public.businesses add column if not exists pre_approved boolean not null default false;
alter table public.businesses add column if not exists approved_at timestamptz;
alter table public.businesses add column if not exists rejected_at timestamptz;
alter table public.businesses add column if not exists google_connected boolean not null default false;
alter table public.businesses add column if not exists google_account_email text;
alter table public.businesses add column if not exists google_access_token text;
alter table public.businesses add column if not exists google_refresh_token text;
alter table public.businesses add column if not exists google_token_expires_at timestamptz;
alter table public.businesses add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.sessions (
  token text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.invited_emails (
  id text primary key,
  email text not null,
  business_name text not null default '',
  invited_at timestamptz not null default now(),
  used boolean not null default false
);

create unique index if not exists invited_emails_unused_email_idx
  on public.invited_emails (email)
  where used = false;

create table if not exists public.customers (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  custom_message text not null default '',
  stage text not null default 'to_send',
  sentiment text,
  complaint text not null default '',
  created_at timestamptz not null default now(),
  last_request_at timestamptz,
  last_request_status text
);

create table if not exists public.requests (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  message text not null default '',
  status text not null default 'Scheduled',
  reaction text,
  feedback_text text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  reviewed_at timestamptz
);

create table if not exists public.reviews (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  customer_id text references public.customers(id) on delete set null,
  customer_name text,
  rating integer,
  text text not null default '',
  source text not null default 'internal',
  google_review_id text,
  request_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  ai_flag text,
  ai_issue_id text
);

create unique index if not exists reviews_google_review_id_idx
  on public.reviews (google_review_id)
  where google_review_id is not null;

create table if not exists public.review_summaries (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  period_start timestamptz,
  period_end timestamptz,
  summary_text text not null default '',
  areas_of_improvement text not null default '',
  review_count integer not null default 0,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  issues jsonb not null default '[]'::jsonb
);

create table if not exists public.feedback (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  customer_id text,
  customer_name text,
  phone text not null default '',
  complaint text not null default '',
  google_review_id text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.pending_sends (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  customer_id text not null,
  phone text not null,
  message text not null,
  scheduled_time timestamptz not null,
  status text not null default 'pending',
  retry_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.activities (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  type text not null,
  customer_name text,
  phone text,
  message text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists customers_business_id_created_at_idx on public.customers (business_id, created_at desc);
create index if not exists requests_business_id_created_at_idx on public.requests (business_id, created_at desc);
create index if not exists reviews_business_id_created_at_idx on public.reviews (business_id, created_at desc);
create index if not exists reviews_business_id_rating_idx on public.reviews (business_id, rating);
create index if not exists pending_sends_due_idx on public.pending_sends (status, scheduled_time);
create index if not exists activities_business_id_created_at_idx on public.activities (business_id, created_at desc);
create index if not exists sessions_business_id_idx on public.sessions (business_id);
create index if not exists admin_sessions_admin_id_idx on public.admin_sessions (admin_id);
create index if not exists review_summaries_business_id_created_at_idx on public.review_summaries (business_id, created_at desc);

-- Backend uses the service role. Lock the Data API so anon/authenticated cannot read tenant data.
alter table public.admins enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.businesses enable row level security;
alter table public.sessions enable row level security;
alter table public.invited_emails enable row level security;
alter table public.customers enable row level security;
alter table public.requests enable row level security;
alter table public.reviews enable row level security;
alter table public.review_summaries enable row level security;
alter table public.feedback enable row level security;
alter table public.pending_sends enable row level security;
alter table public.activities enable row level security;

revoke all on public.admins from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;
revoke all on public.businesses from anon, authenticated;
revoke all on public.sessions from anon, authenticated;
revoke all on public.invited_emails from anon, authenticated;
revoke all on public.customers from anon, authenticated;
revoke all on public.requests from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
revoke all on public.review_summaries from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
revoke all on public.pending_sends from anon, authenticated;
revoke all on public.activities from anon, authenticated;
