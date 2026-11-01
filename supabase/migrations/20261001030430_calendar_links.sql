-- A private calendar link per person, so Google Calendar, Apple Calendar or
-- Outlook can subscribe to their MemoValet tasks, deadlines and calls.
-- Calendar apps can't sign in, so the secret in the link is the key: 32
-- random bytes (lib/calendar-feed-data.ts). Only our server (the service
-- role) reads or writes this table, so it has row level security on and no
-- policies: nothing reaches it through the public API.
create table if not exists public.calendar_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique check (char_length(token) = 43),
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz
);

alter table public.calendar_feeds enable row level security;

notify pgrst, 'reload schema';
