-- In-app notifications, separate from the emails MeetingFlow already sends.
-- Always written by the service-role client, since the events that create
-- one (a recipient with no account completing a task, an invite acceptance,
-- a cron job) rarely have the target user's own session available.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update their own notifications"
  on notifications for update
  to authenticated
  using (user_id = auth.uid());
