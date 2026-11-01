-- Errors that happen in front of people, kept where they can be looked at.
-- Vercel's logs vanish after a day on this plan, so a fault reported hours
-- later had nothing behind it. Nobody reads these but the service role: the
-- capture endpoint writes with it, and the daily digest reads with it.
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 'client' (someone's browser) or 'server' (a route that failed).
  source text not null check (source in ('client', 'server')),
  message text not null,
  -- Where it happened: a page path or a route name, never a full URL with a query.
  place text,
  -- Which build, so a fault can be tied to a deploy.
  release text,
  -- Only present when the person was signed in; null for guests.
  user_id uuid references auth.users(id) on delete set null,
  -- Rough client, for "only Safari" faults. Never a full user agent string.
  browser text
);

create index if not exists app_errors_created_at_idx on public.app_errors (created_at desc);

alter table public.app_errors enable row level security;
-- No policies on purpose: nobody reaches these through the public API. The
-- service role bypasses row level security, and only our own server has it.
