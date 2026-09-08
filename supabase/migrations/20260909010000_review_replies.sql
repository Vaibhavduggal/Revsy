-- Google review reply automation + suspected-fake flagging

alter table public.reviews
  add column if not exists suspected_fake boolean not null default false,
  add column if not exists google_reply_posted_at timestamptz,
  add column if not exists google_reply_text text;

create table if not exists public.review_reply_audit (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  review_id text references public.reviews(id) on delete set null,
  action text not null,
  template_key text,
  reply_text text,
  google_review_id text,
  success boolean not null default false,
  error_message text,
  posted_at timestamptz not null default now()
);

create index if not exists review_reply_audit_business_idx on public.review_reply_audit (business_id, posted_at desc);
