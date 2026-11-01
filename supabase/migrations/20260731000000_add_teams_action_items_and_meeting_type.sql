-- Teams -------------------------------------------------------------

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  token text unique not null,
  invited_email text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists team_members_user_id_idx on team_members (user_id);
create index if not exists team_invites_token_idx on team_invites (token);

alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;

create policy "Members can view their teams"
  on teams for select
  to authenticated
  using (id in (select team_id from team_members where user_id = auth.uid()));

create policy "Authenticated users can create a team"
  on teams for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Owners can rename their team"
  on teams for update
  to authenticated
  using (id in (select team_id from team_members where user_id = auth.uid() and role = 'owner'));

create policy "Members can view teammates"
  on team_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Users can add themselves to a team"
  on team_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Owners can manage invites"
  on team_invites for all
  to authenticated
  using (
    team_id in (select team_id from team_members where user_id = auth.uid() and role = 'owner')
  )
  with check (
    created_by = auth.uid()
    and team_id in (select team_id from team_members where user_id = auth.uid() and role = 'owner')
  );

-- Meetings: team + type -----------------------------------------------

alter table meetings add column if not exists team_id uuid references teams(id) on delete set null;
alter table meetings add column if not exists meeting_type text;

create index if not exists meetings_team_id_idx on meetings (team_id);

create policy "Users can update their own meetings"
  on meetings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Team members can view team meetings"
  on meetings for select
  to authenticated
  using (
    team_id is not null
    and team_id in (select team_id from team_members where user_id = auth.uid())
  );

-- Action items ----------------------------------------------------------

create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  owner text,
  due_date text,
  priority text,
  status text not null default 'todo' check (status in ('todo', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists action_items_user_id_idx on action_items (user_id);
create index if not exists action_items_meeting_id_idx on action_items (meeting_id);
create index if not exists action_items_status_idx on action_items (status);

alter table action_items enable row level security;

create policy "Users can view their own or team action items"
  on action_items for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from meetings m
      join team_members tm on tm.team_id = m.team_id
      where m.id = action_items.meeting_id and tm.user_id = auth.uid()
    )
  );

create policy "Users can insert their own action items"
  on action_items for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own or team action items"
  on action_items for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from meetings m
      join team_members tm on tm.team_id = m.team_id
      where m.id = action_items.meeting_id and tm.user_id = auth.uid()
    )
  );
