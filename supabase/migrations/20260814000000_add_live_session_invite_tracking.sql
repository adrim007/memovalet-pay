-- Invite tracking for scheduled live sessions ------------------------------
-- Lets the host send a calendar invite to one recipient and get notified
-- (by email, since there's no in-app notification system) when they accept.

alter table live_sessions
  add column if not exists invite_email text,
  add column if not exists invite_status text not null default 'pending' check (invite_status in ('pending', 'accepted'));
