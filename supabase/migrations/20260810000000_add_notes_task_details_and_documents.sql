-- Meeting notes -----------------------------------------------------------

alter table meetings add column if not exists notes text;

-- Task location, photo, reminder ------------------------------------------

alter table action_items add column if not exists location text;
alter table action_items add column if not exists photo_url text;
alter table action_items add column if not exists reminder_at timestamptz;

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload their own task photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view task photos"
  on storage.objects for select
  to public
  using (bucket_id = 'task-photos');

create policy "Users can delete their own task photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Personal documents (passport, license, boarding passes) -----------------
-- Private bucket: no public policy. Files are only ever served through a
-- server-generated signed URL after an ownership check, never a public URL.

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('passport', 'drivers_license', 'boarding_pass', 'other')),
  title text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on documents (user_id);

alter table documents enable row level security;

create policy "Users can view their own documents"
  on documents for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own documents"
  on documents for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own documents"
  on documents for delete
  to authenticated
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('personal-documents', 'personal-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload their own documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'personal-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own document files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'personal-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own document files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'personal-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
