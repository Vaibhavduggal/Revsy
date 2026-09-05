-- Category + sentiment-gate conversation state + feedback type.

alter table public.businesses
  add column if not exists category text not null default 'restaurant';

alter table public.businesses
  add column if not exists category_set boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_category_check'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_category_check
      check (category in ('gym', 'restaurant'));
  end if;
end $$;

update public.businesses
  set category_set = true
  where coalesce(onboarding_completed, false) = true
     or coalesce(is_demo, false) = true;

alter table public.feedback
  add column if not exists type text not null default 'complaint';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_type_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_type_check
      check (type in ('suggestion', 'complaint'));
  end if;
end $$;

alter table public.customers
  add column if not exists wa_step text not null default 'idle';

alter table public.customers
  add column if not exists wa_history jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_wa_step_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_wa_step_check
      check (wa_step in (
        'idle',
        'awaiting_sentiment',
        'awaiting_happy_detail',
        'awaiting_complaint',
        'done'
      ));
  end if;
end $$;

create index if not exists feedback_business_id_type_idx
  on public.feedback (business_id, type, created_at desc);

create index if not exists customers_business_id_wa_step_idx
  on public.customers (business_id, wa_step);
