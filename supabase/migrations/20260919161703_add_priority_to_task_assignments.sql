-- Sent tasks should carry the same high / medium / low signal as action items.
-- Existing tasks stay unmarked because their urgency was never stated.
alter table public.task_assignments
  add column if not exists priority text;

alter table public.task_assignments
  drop constraint if exists task_assignments_priority_check;

alter table public.task_assignments
  add constraint task_assignments_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

create index if not exists task_assignments_created_by_priority_idx
  on public.task_assignments (created_by, priority)
  where priority is not null;
