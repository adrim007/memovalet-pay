-- Personal assistant layer: lightweight people memory, commitments
-- (I owe / they owe), standalone reminders, and freeform notes. All
-- additive — nothing here touches existing tables except read-only FKs.

-- People ----------------------------------------------------------------
-- Deliberately lightweight: a name + optional email, not a CRM contact.
-- Meetings/tasks keep storing participants/recipient as free text; this
-- table is an opt-in identity a user can attach to that text over time.

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists people_user_id_idx on people (user_id);
create unique index if not exists people_user_id_email_idx
  on people (user_id, email) where email is not null;

alter table people enable row level security;

create policy "Users can view their own people"
  on people for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own people"
  on people for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own people"
  on people for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own people"
  on people for delete
  to authenticated
  using (user_id = auth.uid());

-- Commitments -------------------------------------------------------------
-- The "I owe / they owe" differentiator. direction is from the user's
-- point of view: i_owe = the user promised someone else something,
-- they_owe = someone else promised the user something ("waiting on").
-- person_name is a plain-text fallback so this works before the user has
-- ever created a People record; person_id fills in once one exists.

create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  direction text not null check (direction in ('i_owe', 'they_owe')),
  person_id uuid references people(id) on delete set null,
  person_name text,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'overdue', 'cancelled')),
  source_type text check (source_type in ('meeting', 'task', 'manual', 'note')),
  source_id uuid,
  confidence text not null default 'manual' check (confidence in ('manual', 'ai_suggested')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists commitments_user_id_status_idx on commitments (user_id, status);
create index if not exists commitments_user_id_due_date_idx on commitments (user_id, due_date);
create index if not exists commitments_person_id_idx on commitments (person_id);

alter table commitments enable row level security;

create policy "Users can view their own commitments"
  on commitments for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own commitments"
  on commitments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own commitments"
  on commitments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own commitments"
  on commitments for delete
  to authenticated
  using (user_id = auth.uid());

-- Reminders ---------------------------------------------------------------
-- Standalone, so a reminder isn't forced to be a task. Optionally links
-- back to whatever it's about (meeting/task/document/person) for context.

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  context text,
  remind_at timestamptz not null,
  related_type text check (related_type in ('meeting', 'task', 'document', 'person')),
  related_id uuid,
  status text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_id_status_idx on reminders (user_id, status);
create index if not exists reminders_user_id_remind_at_idx on reminders (user_id, remind_at);

alter table reminders enable row level security;

create policy "Users can view their own reminders"
  on reminders for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own reminders"
  on reminders for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own reminders"
  on reminders for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own reminders"
  on reminders for delete
  to authenticated
  using (user_id = auth.uid());

-- Notes ---------------------------------------------------------------
-- Freestanding notes, distinct from a meeting's own notes field or a
-- task's note thread — this is for anything captured with no other home.

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_user_id_created_at_idx on notes (user_id, created_at desc);

alter table notes enable row level security;

create policy "Users can view their own notes"
  on notes for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own notes"
  on notes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own notes"
  on notes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own notes"
  on notes for delete
  to authenticated
  using (user_id = auth.uid());
