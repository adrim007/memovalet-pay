-- Creating a team does INSERT ... RETURNING, which needs a SELECT policy
-- that matches the new row. The creator isn't in team_members yet at that
-- moment, so let them see teams they created directly.
-- (Applied live on 2026-08-28; saved here so the migration history matches.)
create policy "Creators can view teams they created"
  on teams for select to authenticated
  using (created_by = (select auth.uid()));
