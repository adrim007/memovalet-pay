-- The "Members can view teammates" policy on team_members queried
-- team_members from within its own policy, so Postgres re-applied that
-- same policy to the inner query forever ("infinite recursion detected
-- in policy for relation team_members"). Every dashboard load, and every
-- other query that touches team_members (directly or via a policy on
-- teams/meetings/projects/action_items/team_invites that subqueries it),
-- was hitting this and erroring on every request.
--
-- Fix: look up the caller's team_ids through a SECURITY DEFINER function,
-- which bypasses RLS for that lookup instead of re-triggering it.
create or replace function public.get_my_team_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select team_id from team_members where user_id = auth.uid();
$$;

drop policy if exists "Members can view teammates" on team_members;
create policy "Members can view teammates"
  on team_members for select
  using (
    user_id = auth.uid()
    or team_id in (select public.get_my_team_ids())
  );
