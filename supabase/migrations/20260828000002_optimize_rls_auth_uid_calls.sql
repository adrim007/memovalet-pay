-- Supabase's linter flags every policy that calls auth.uid() directly:
-- Postgres re-evaluates a bare function call once per row, but wrapping it
-- as (select auth.uid()) lets the planner evaluate it once per query and
-- reuse the result. Same logic in every policy below, just wrapped.
-- Rewrites all 51 policies the linter flagged across every table.

-- action_items
drop policy "Users can insert their own action items" on action_items;
create policy "Users can insert their own action items" on action_items for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can update their own or team action items" on action_items;
create policy "Users can update their own or team action items" on action_items for update to authenticated using (
  (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM (meetings m JOIN team_members tm ON ((tm.team_id = m.team_id))) WHERE ((m.id = action_items.meeting_id) AND (tm.user_id = (select auth.uid())))))
);

drop policy "Users can view their own or team action items" on action_items;
create policy "Users can view their own or team action items" on action_items for select to authenticated using (
  (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM (meetings m JOIN team_members tm ON ((tm.team_id = m.team_id))) WHERE ((m.id = action_items.meeting_id) AND (tm.user_id = (select auth.uid())))))
);

-- commitments
drop policy "Users can create their own commitments" on commitments;
create policy "Users can create their own commitments" on commitments for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can delete their own commitments" on commitments;
create policy "Users can delete their own commitments" on commitments for delete to authenticated using (user_id = (select auth.uid()));

drop policy "Users can update their own commitments" on commitments;
create policy "Users can update their own commitments" on commitments for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "Users can view their own commitments" on commitments;
create policy "Users can view their own commitments" on commitments for select to authenticated using (user_id = (select auth.uid()));

-- documents
drop policy "Users can delete their own documents" on documents;
create policy "Users can delete their own documents" on documents for delete to authenticated using (user_id = (select auth.uid()));

drop policy "Users can insert their own documents" on documents;
create policy "Users can insert their own documents" on documents for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can rename, move, or annotate their own documents" on documents;
create policy "Users can rename, move, or annotate their own documents" on documents for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "Users can view their own documents" on documents;
create policy "Users can view their own documents" on documents for select to authenticated using (user_id = (select auth.uid()));

-- folders
drop policy "Users can create their own folders" on folders;
create policy "Users can create their own folders" on folders for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can delete their own folders" on folders;
create policy "Users can delete their own folders" on folders for delete to authenticated using (user_id = (select auth.uid()));

drop policy "Users can rename or move their own folders" on folders;
create policy "Users can rename or move their own folders" on folders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "Users can view their own folders" on folders;
create policy "Users can view their own folders" on folders for select to authenticated using (user_id = (select auth.uid()));

-- live_sessions
drop policy "Creators can create live sessions" on live_sessions;
create policy "Creators can create live sessions" on live_sessions for insert to authenticated with check (created_by = (select auth.uid()));

drop policy "Creators can update their own live sessions" on live_sessions;
create policy "Creators can update their own live sessions" on live_sessions for update to authenticated using (created_by = (select auth.uid()));

drop policy "Creators can view their own live sessions" on live_sessions;
create policy "Creators can view their own live sessions" on live_sessions for select to authenticated using (created_by = (select auth.uid()));

-- meetings
drop policy "Team members can view team meetings" on meetings;
create policy "Team members can view team meetings" on meetings for select to authenticated using (
  (team_id IS NOT NULL) AND (team_id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = (select auth.uid()))))
);

drop policy "Users can insert their own meetings" on meetings;
create policy "Users can insert their own meetings" on meetings for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy "Users can update their own meetings" on meetings;
create policy "Users can update their own meetings" on meetings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "Users can view their own meetings" on meetings;
create policy "Users can view their own meetings" on meetings for select to authenticated using ((select auth.uid()) = user_id);

-- notes
drop policy "Users can create their own notes" on notes;
create policy "Users can create their own notes" on notes for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can delete their own notes" on notes;
create policy "Users can delete their own notes" on notes for delete to authenticated using (user_id = (select auth.uid()));

drop policy "Users can update their own notes" on notes;
create policy "Users can update their own notes" on notes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "Users can view their own notes" on notes;
create policy "Users can view their own notes" on notes for select to authenticated using (user_id = (select auth.uid()));

-- notifications
drop policy "Users can update their own notifications" on notifications;
create policy "Users can update their own notifications" on notifications for update to authenticated using (user_id = (select auth.uid()));

drop policy "Users can view their own notifications" on notifications;
create policy "Users can view their own notifications" on notifications for select to authenticated using (user_id = (select auth.uid()));

-- people
drop policy "Users can create their own people" on people;
create policy "Users can create their own people" on people for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can delete their own people" on people;
create policy "Users can delete their own people" on people for delete to authenticated using (user_id = (select auth.uid()));

drop policy "Users can update their own people" on people;
create policy "Users can update their own people" on people for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "Users can view their own people" on people;
create policy "Users can view their own people" on people for select to authenticated using (user_id = (select auth.uid()));

-- projects
drop policy "Owners can update their own projects" on projects;
create policy "Owners can update their own projects" on projects for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy "Owners can view their own projects" on projects;
create policy "Owners can view their own projects" on projects for select to authenticated using (created_by = (select auth.uid()));

drop policy "Team members can view team projects" on projects;
create policy "Team members can view team projects" on projects for select to authenticated using (
  (team_id IS NOT NULL) AND (team_id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = (select auth.uid()))))
);

drop policy "Users can create projects" on projects;
create policy "Users can create projects" on projects for insert to authenticated with check (
  (created_by = (select auth.uid())) AND ((team_id IS NULL) OR (team_id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = (select auth.uid())))))
);

-- reminders
drop policy "Users can create their own reminders" on reminders;
create policy "Users can create their own reminders" on reminders for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "Users can delete their own reminders" on reminders;
create policy "Users can delete their own reminders" on reminders for delete to authenticated using (user_id = (select auth.uid()));

drop policy "Users can update their own reminders" on reminders;
create policy "Users can update their own reminders" on reminders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "Users can view their own reminders" on reminders;
create policy "Users can view their own reminders" on reminders for select to authenticated using (user_id = (select auth.uid()));

-- task_assignments
drop policy "Creators can create task assignments" on task_assignments;
create policy "Creators can create task assignments" on task_assignments for insert to authenticated with check (created_by = (select auth.uid()));

drop policy "Creators can view their own task assignments" on task_assignments;
create policy "Creators can view their own task assignments" on task_assignments for select to authenticated using (created_by = (select auth.uid()));

-- team_invites
drop policy "Owners can manage invites" on team_invites;
create policy "Owners can manage invites" on team_invites for all to authenticated using (
  team_id IN ( SELECT team_members.team_id FROM team_members WHERE ((team_members.user_id = (select auth.uid())) AND (team_members.role = 'owner'::text)))
) with check (
  (created_by = (select auth.uid())) AND (team_id IN ( SELECT team_members.team_id FROM team_members WHERE ((team_members.user_id = (select auth.uid())) AND (team_members.role = 'owner'::text))))
);

-- team_members
drop policy "Members can view teammates" on team_members;
create policy "Members can view teammates" on team_members for select using (
  (user_id = (select auth.uid())) OR (team_id IN (select private.get_my_team_ids()))
);

drop policy "Users can add themselves to a team" on team_members;
create policy "Users can add themselves to a team" on team_members for insert to authenticated with check (user_id = (select auth.uid()));

-- teams
drop policy "Authenticated users can create a team" on teams;
create policy "Authenticated users can create a team" on teams for insert to authenticated with check (created_by = (select auth.uid()));

drop policy "Members can view their teams" on teams;
create policy "Members can view their teams" on teams for select to authenticated using (
  id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = (select auth.uid())))
);

drop policy "Owners can rename their team" on teams;
create policy "Owners can rename their team" on teams for update to authenticated using (
  id IN ( SELECT team_members.team_id FROM team_members WHERE ((team_members.user_id = (select auth.uid())) AND (team_members.role = 'owner'::text)))
);

-- user_google_tokens
drop policy "Users can insert their own google token" on user_google_tokens;
create policy "Users can insert their own google token" on user_google_tokens for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy "Users can update their own google token" on user_google_tokens;
create policy "Users can update their own google token" on user_google_tokens for update to authenticated using ((select auth.uid()) = user_id);

drop policy "Users can view their own google token" on user_google_tokens;
create policy "Users can view their own google token" on user_google_tokens for select to authenticated using ((select auth.uid()) = user_id);
