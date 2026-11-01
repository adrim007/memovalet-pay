-- Let people delete a single task off a meeting.
--
-- Deleting the whole meeting already removed its tasks, because they hang off it
-- in the database. But there was no way to clear one task you no longer need
-- without throwing away the meeting it came from: action_items had no delete
-- policy, so row-level security refused the delete without saying so.
--
-- Owner only, and the restrictive two-step policy on the table still applies.

create policy "Users can delete their own action items" on public.action_items
  for delete to authenticated
  using ((select auth.uid()) = user_id);
