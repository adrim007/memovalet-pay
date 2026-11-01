-- Live sessions -----------------------------------------------------------
-- A shared, real-time multi-party meeting. Each participant joins from
-- their own device via a link, picks the language they'll speak, and sees
-- everyone else's speech auto-translated into their own language, live.
-- Participants themselves are never written to the database (they only
-- join a Realtime channel named after this row's id), so no participants
-- table is needed, only a record that the session exists.

create table if not exists live_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Live session',
  meeting_type text not null default 'general',
  status text not null default 'active' check (status in ('active', 'ended')),
  meeting_id uuid references meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists live_sessions_created_by_idx on live_sessions (created_by);

alter table live_sessions enable row level security;

create policy "Creators can view their own live sessions"
  on live_sessions for select
  to authenticated
  using (created_by = auth.uid());

create policy "Creators can create live sessions"
  on live_sessions for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Creators can update their own live sessions"
  on live_sessions for update
  to authenticated
  using (created_by = auth.uid());
