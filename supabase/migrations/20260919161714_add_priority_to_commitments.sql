-- Tasks created from the Home Create bar and the I owe / Waiting on lists
-- are commitments, so keep their urgency with them too.
alter table public.commitments
  add column if not exists priority text;

alter table public.commitments
  drop constraint if exists commitments_priority_check;

alter table public.commitments
  add constraint commitments_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

create index if not exists commitments_user_id_priority_idx
  on public.commitments (user_id, priority)
  where priority is not null;
