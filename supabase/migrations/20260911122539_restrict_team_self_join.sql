-- Apply after deploying the accept_team_invite RPC caller.
drop policy "Users can add themselves to a team" on public.team_members;
create policy "Creators can initialize their own team membership" on public.team_members
for insert to authenticated with check (
  user_id = (select auth.uid()) and role = 'owner'
  and exists (select 1 from public.teams where id = team_id and created_by = (select auth.uid()))
);
