create extension if not exists "pgcrypto";

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Meeting',
  participants text,
  transcript text not null,
  summary text,
  decisions jsonb,
  action_items jsonb,
  follow_up_email text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meetings_created_at_idx on meetings (created_at desc);

-- MVP uses the anon key directly from the app, so RLS is permissive.
-- Tighten these policies before handling real user data.
alter table meetings enable row level security;

create policy "Allow anon read access to meetings"
  on meetings for select
  to anon
  using (true);

create policy "Allow anon insert access to meetings"
  on meetings for insert
  to anon
  with check (true);
