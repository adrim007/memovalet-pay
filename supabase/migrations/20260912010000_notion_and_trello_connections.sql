-- Per-person Notion and Trello connections.
--
-- Until now both exports ran on a single set of MemoValet-wide keys, so every
-- person's meeting notes would have landed in whichever Notion page and Trello
-- list those keys pointed at. Each person now connects their own account, the
-- same way Slack already works.
--
-- The tokens are credentials: like slack_connections, only verified server code
-- (the service role) can read or write these tables. The two-step policy is the
-- same restrictive rule every other table carries, so it still holds if anyone
-- ever grants signed-in users access here.

create table public.notion_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  workspace_id text,
  workspace_name text not null,
  -- The page MemoValet saves meeting notes inside. Null when the person
  -- connected but didn't share any page with MemoValet.
  parent_page_id text,
  parent_page_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trello_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  member_name text not null,
  -- The list new cards go into; chosen in Settings after connecting.
  board_name text,
  list_id text,
  list_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notion_connections enable row level security;
alter table public.trello_connections enable row level security;

revoke all on public.notion_connections from anon, authenticated;
revoke all on public.trello_connections from anon, authenticated;
grant all on public.notion_connections to service_role;
grant all on public.trello_connections to service_role;

create policy "Require completed two-step verification" on public.notion_connections
  as restrictive for all to authenticated
  using ((select private.mfa_access_allowed()))
  with check ((select private.mfa_access_allowed()));

create policy "Require completed two-step verification" on public.trello_connections
  as restrictive for all to authenticated
  using ((select private.mfa_access_allowed()))
  with check ((select private.mfa_access_allowed()));
