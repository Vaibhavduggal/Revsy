alter table public.businesses
  add column if not exists message_flow_mode text not null default 'single';

alter table public.businesses
  add column if not exists whatsapp_template_id text not null default '';

comment on column public.businesses.message_flow_mode is 'single = one WhatsApp with review link + free-text reply; multi = sentiment gate flow';
