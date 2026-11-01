create or replace function private.mfa_access_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
  );
$$;
revoke all on function private.mfa_access_allowed() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.mfa_access_allowed() to authenticated;

-- Intersect existing ownership/sharing policies without granting new access.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'action_items','bookmarks','commitments','documents','file_shares','folders',
    'live_sessions','meeting_translations','meetings','notes','notifications',
    'payments','people','projects','reminders','shared_items','slack_connections',
    'stripe_accounts','task_assignments','team_invites','team_members','teams','user_google_tokens'
  ] loop
    execute format('create policy "Require completed two-step verification" on public.%I as restrictive for all to authenticated using ((select private.mfa_access_allowed())) with check ((select private.mfa_access_allowed()))', table_name);
  end loop;
end $$;
create policy "Require completed two-step verification" on storage.objects
as restrictive for all to authenticated
using ((select private.mfa_access_allowed()))
with check ((select private.mfa_access_allowed()));

create or replace function public.accept_team_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.team_invites%rowtype;
begin
  if not private.mfa_access_allowed() then
    raise exception 'Complete sign-in and two-step verification first.';
  end if;
  select * into invitation from public.team_invites where token = invite_token for update;
  if not found or invitation.accepted_at is not null then
    raise exception 'This invitation is invalid or has already been used.';
  end if;
  if invitation.invited_email is not null and lower(trim(invitation.invited_email)) <> lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'Sign in with the email address this invitation was sent to.';
  end if;
  insert into public.team_members(team_id, user_id, role)
    values (invitation.team_id, auth.uid(), 'member') on conflict do nothing;
  update public.team_invites set accepted_at = now() where id = invitation.id;
  return invitation.team_id;
end $$;
revoke all on function public.accept_team_invite(text) from public, anon;
grant execute on function public.accept_team_invite(text) to authenticated;
