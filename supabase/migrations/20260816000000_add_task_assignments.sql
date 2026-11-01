-- Task assignments ----------------------------------------------------
-- Lets a MeetingFlow user send a task to anyone by email, no account
-- required on their end (same pattern as live_sessions: an unguessable
-- id is the link, a service-role client handles the recipient's side).
-- The recipient can mark it done, add a note, and attach a photo or
-- video as proof of completion, all from a public link.

create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'done')),
  completion_note text,
  completion_file_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists task_assignments_created_by_idx on task_assignments (created_by);

alter table task_assignments enable row level security;

create policy "Creators can view their own task assignments"
  on task_assignments for select
  to authenticated
  using (created_by = auth.uid());

create policy "Creators can create task assignments"
  on task_assignments for insert
  to authenticated
  with check (created_by = auth.uid());
