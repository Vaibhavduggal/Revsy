-- AI one-liner for positive Google reviews (owner dashboard)

alter table public.reviews
  add column if not exists positive_ai_summary text;
