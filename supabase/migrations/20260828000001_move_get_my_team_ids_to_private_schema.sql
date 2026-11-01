-- The Supabase security linter flags SECURITY DEFINER functions that are
-- directly callable via the public REST RPC endpoint. get_my_team_ids()
-- (added in 20260828000000_fix_team_members_rls_recursion.sql) only needs
-- to be callable from inside the team_members RLS policy, not by clients
-- directly, so move it to a schema that isn't exposed via PostgREST.
create schema if not exists private;

create or replace function private.get_my_team_ids()
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
    or team_id in (select private.get_my_team_ids())
  );

drop function if exists public.get_my_team_ids();
