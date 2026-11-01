-- Team invitations expire, and six foreign keys get the indexes Supabase's
-- advisor flagged.
--
-- Invites were single-use and email-bound when an email was given, but never
-- expired: an open invite link that leaked stayed usable forever. New invites
-- last 14 days. accept_team_invite is otherwise exactly as before — the same
-- two-step check, locking, reuse check and email match — with one added check.

alter table public.team_invites
  add column if not exists expires_at timestamptz default (now() + interval '14 days');

create or replace function public.accept_team_invite(invite_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare invitation public.team_invites%rowtype;
begin
  if not private.mfa_access_allowed() then
    raise exception 'Complete sign-in and two-step verification first.';
  end if;
  select * into invitation from public.team_invites where token = invite_token for update;
  if not found or invitation.accepted_at is not null then
    raise exception 'This invitation is invalid or has already been used.';
  end if;
  if invitation.expires_at is not null and invitation.expires_at < now() then
    raise exception 'This invitation has expired. Ask for a new one.';
  end if;
  if invitation.invited_email is not null and lower(trim(invitation.invited_email)) <> lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'Sign in with the email address this invitation was sent to.';
  end if;
  insert into public.team_members(team_id, user_id, role)
    values (invitation.team_id, auth.uid(), 'member') on conflict do nothing;
  update public.team_invites set accepted_at = now() where id = invitation.id;
  return invitation.team_id;
end $function$;

-- Covering indexes for foreign keys (Supabase performance advisor, lint 0001).
create index if not exists live_sessions_meeting_id_idx on public.live_sessions (meeting_id);
create index if not exists payments_task_assignment_id_idx on public.payments (task_assignment_id);
create index if not exists shared_items_owner_id_idx on public.shared_items (owner_id);
create index if not exists team_invites_created_by_idx on public.team_invites (created_by);
create index if not exists team_invites_team_id_idx on public.team_invites (team_id);
create index if not exists teams_created_by_idx on public.teams (created_by);
