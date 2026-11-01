-- Let the things you keep carry a priority, not just the tasks off a meeting.
--
-- action_items has had high/medium/low since the beginning; meetings, files,
-- notes and projects had no way to say one mattered more than another.
--
-- Null is the normal state and the default: most of a library is neither urgent
-- nor not, and marking everything would make the marks mean nothing. The check
-- constraint keeps the values to the three the app knows how to show — anything
-- else would render as an unstyled chip nobody chose.

alter table public.meetings  add column if not exists priority text;
alter table public.documents add column if not exists priority text;
alter table public.notes     add column if not exists priority text;
alter table public.projects  add column if not exists priority text;

alter table public.meetings
  add constraint meetings_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

alter table public.documents
  add constraint documents_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

alter table public.notes
  add constraint notes_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

alter table public.projects
  add constraint projects_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

-- Reading "show me what's urgent" touches only the marked rows, which are the
-- few, so the index skips the nulls entirely.
create index if not exists meetings_priority_idx  on public.meetings (user_id, priority)   where priority is not null;
create index if not exists documents_priority_idx on public.documents (user_id, priority)  where priority is not null;
create index if not exists notes_priority_idx     on public.notes (user_id, priority)      where priority is not null;
create index if not exists projects_priority_idx  on public.projects (created_by, priority) where priority is not null;
