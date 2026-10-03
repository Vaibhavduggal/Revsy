-- Block anon/authenticated direct access; server uses service role only.

alter table public.review_reply_audit enable row level security;
