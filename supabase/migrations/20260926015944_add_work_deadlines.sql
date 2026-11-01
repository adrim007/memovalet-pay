-- Keep civil deadlines separate from optional exact instants. Existing RLS stays in force.
alter table public.commitments add column if not exists due_at timestamptz;
alter table public.commitments add column if not exists time_zone text;
alter table public.projects add column if not exists due_date date;
alter table public.projects add column if not exists due_at timestamptz;
alter table public.projects add column if not exists time_zone text;
create index if not exists projects_due_date_idx on public.projects (due_date) where due_date is not null;
notify pgrst, 'reload schema';
