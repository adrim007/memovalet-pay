-- Projects (matter-centric grouping) ----------------------------------
-- Groups meetings, decisions, and action items that belong to the same
-- deal, client, or initiative, so they can be viewed as one thread instead
-- of scattered across separate meeting records.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  client_name text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists projects_created_by_idx on projects (created_by);
create index if not exists projects_team_id_idx on projects (team_id);

alter table meetings add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists meetings_project_id_idx on meetings (project_id);

alter table projects enable row level security;

create policy "Owners can view their own projects"
  on projects for select
  to authenticated
  using (created_by = auth.uid());

create policy "Team members can view team projects"
  on projects for select
  to authenticated
  using (
    team_id is not null
    and team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Users can create projects"
  on projects for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      team_id is null
      or team_id in (select team_id from team_members where user_id = auth.uid())
    )
  );

create policy "Owners can update their own projects"
  on projects for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
