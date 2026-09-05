-- wa_delivery_status: queued | sent | delivered | read | failed
alter table public.customers
  add column if not exists wa_delivery_status text;

alter table public.customers
  drop constraint if exists customers_wa_delivery_status_check;

alter table public.customers
  add constraint customers_wa_delivery_status_check
  check (
    wa_delivery_status is null
    or wa_delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed')
  );

comment on column public.customers.wa_delivery_status is
  'WhatsApp delivery receipts: queued, sent, delivered, read, or failed.';
