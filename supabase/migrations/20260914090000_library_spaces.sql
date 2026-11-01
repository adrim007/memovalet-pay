-- The Library: meetings and notes can live in a space (one of the user's
-- folders) alongside files. A space may only hold things belonging to its
-- owner — the database enforces that, rather than trusting whichever route
-- set the link. Deleting a space unfiles what was in it; nothing else changes.

alter table public.folders
  add constraint folders_id_user_id_key unique (id, user_id);

alter table public.meetings add column if not exists folder_id uuid;
alter table public.notes add column if not exists folder_id uuid;

alter table public.meetings
  add constraint meetings_folder_owner_fkey foreign key (folder_id, user_id)
  references public.folders (id, user_id) on delete set null (folder_id);

alter table public.notes
  add constraint notes_folder_owner_fkey foreign key (folder_id, user_id)
  references public.folders (id, user_id) on delete set null (folder_id);

-- Files already had a folder link, but it never checked whose folder it was.
alter table public.documents drop constraint if exists documents_folder_id_fkey;
alter table public.documents
  add constraint documents_folder_owner_fkey foreign key (folder_id, user_id)
  references public.folders (id, user_id) on delete set null (folder_id);

create index if not exists meetings_folder_id_idx on public.meetings (folder_id);
create index if not exists notes_folder_id_idx on public.notes (folder_id);
