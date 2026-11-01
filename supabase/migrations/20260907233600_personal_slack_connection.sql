create table public.slack_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  webhook_url text not null,
  team_name text not null,
  channel_name text not null,
  created_at timestamptz not null default now()
);
alter table public.slack_connections enable row level security;
-- Webhook URLs are credentials. Only verified server code can read them.
revoke all on public.slack_connections from anon, authenticated;
grant all on public.slack_connections to service_role;
