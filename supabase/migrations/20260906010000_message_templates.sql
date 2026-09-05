alter table public.businesses
  add column if not exists message_templates jsonb not null default '{}'::jsonb;
