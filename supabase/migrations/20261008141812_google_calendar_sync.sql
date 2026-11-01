-- Server-owned sync bookkeeping. Browser roles cannot read or forge mappings.
create table public.google_calendar_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calendar_id text not null,
  calendar_name text not null,
  time_zone text not null,
  kinds text[] not null check (kinds <@ array['commitment','project','call','action_item','assignment']::text[] and cardinality(kinds)>0),
  enabled boolean not null default false,
  lock_token uuid,
  locked_until timestamptz not null default 'epoch',
  last_attempt_at timestamptz not null default 'epoch',
  last_synced_at timestamptz,
  last_error text
);
create table public.google_calendar_sync_items (
  user_id uuid not null references public.google_calendar_sync(user_id) on delete cascade,
  kind text not null check (kind in ('commitment','project','call','action_item','assignment')),
  source_id uuid not null,
  event_id text not null,
  base jsonb,
  pending_create boolean not null default true,
  checked_at timestamptz not null default 'epoch',
  issue text,
  conflict jsonb,
  primary key(user_id,kind,source_id),
  unique(user_id,event_id)
);
create index google_calendar_sync_queue on public.google_calendar_sync(last_attempt_at) where enabled;
create index google_calendar_sync_items_queue on public.google_calendar_sync_items(user_id,checked_at);
alter table public.google_calendar_sync enable row level security;
alter table public.google_calendar_sync_items enable row level security;
revoke all on public.google_calendar_sync, public.google_calendar_sync_items from public, anon, authenticated;
grant all on public.google_calendar_sync, public.google_calendar_sync_items to service_role;
-- Scheduler activation is a release step after the endpoint and permissions
-- have been verified. No job is activated by this migration.
notify pgrst, 'reload schema';
