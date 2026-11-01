-- Folders -------------------------------------------------------------
-- Lets people organize their own documents however they want, instead of
-- the app imposing fixed categories like "passport" / "license".

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists folders_user_id_idx on folders (user_id);
create index if not exists folders_parent_id_idx on folders (parent_id);

alter table folders enable row level security;

create policy "Users can view their own folders"
  on folders for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own folders"
  on folders for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can rename or move their own folders"
  on folders for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own folders"
  on folders for delete
  to authenticated
  using (user_id = auth.uid());

-- Documents: personalize instead of forcing a fixed type -----------------

alter table documents add column if not exists folder_id uuid references folders(id) on delete set null;
alter table documents add column if not exists notes text;
alter table documents add column if not exists mime_type text;

create index if not exists documents_folder_id_idx on documents (folder_id);

-- doc_type used to be a required, fixed category (passport/license/etc.);
-- it's now just an optional hint — folders are how people actually organize.
alter table documents alter column doc_type drop not null;
alter table documents drop constraint if exists documents_doc_type_check;

create policy "Users can rename, move, or annotate their own documents"
  on documents for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
