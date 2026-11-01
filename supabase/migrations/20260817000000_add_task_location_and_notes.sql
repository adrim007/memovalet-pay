-- Adds a location (rendered as a tappable maps link) and a running notes
-- thread to task assignments, so a task can carry updates from either side
-- as work progresses, not just a single note at completion.

alter table task_assignments add column if not exists location text;
alter table task_assignments add column if not exists notes jsonb not null default '[]'::jsonb;
