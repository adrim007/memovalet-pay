-- Let people delete their own things.
--
-- Notes, files, folders, people, commitments and reminders already had a delete
-- policy. Meetings, projects, sent tasks and teams didn't — so there was no way
-- to remove a meeting at all, and any delete button would have failed silently
-- because row-level security refuses what no policy allows.
--
-- Owner only, and the restrictive two-step policy every table carries still
-- applies on top. What hangs off each row is already handled by the database:
-- action items and translations go with a meeting, members and invites go with
-- a team, and meetings keep existing when their project or team is deleted.

create policy "Users can delete their own meetings" on public.meetings
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners can delete their own projects" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = created_by);

create policy "Senders can delete tasks they sent" on public.task_assignments
  for delete to authenticated
  using ((select auth.uid()) = created_by);

create policy "Creators can delete their own teams" on public.teams
  for delete to authenticated
  using ((select auth.uid()) = created_by);
