-- Additive: does not alter existing meetings or existing public recording links.
create table public.meeting_translations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  language text not null,
  source_hash text not null,
  transcript text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, meeting_id, language, source_hash)
);
alter table public.meeting_translations enable row level security;
grant select, insert, update, delete on public.meeting_translations to authenticated;
grant all on public.meeting_translations to service_role;
create policy "Read translations of accessible meetings" on public.meeting_translations for select to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.meetings m where m.id = meeting_id));
create policy "Save translations of accessible meetings" on public.meeting_translations for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.meetings m where m.id = meeting_id));
create policy "Update translations of accessible meetings" on public.meeting_translations for update to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.meetings m where m.id = meeting_id))
with check (user_id = (select auth.uid()) and exists (select 1 from public.meetings m where m.id = meeting_id));
create policy "Delete translations of owned meetings" on public.meeting_translations for delete to authenticated
using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-recordings', 'meeting-recordings', false, 524288000, array['video/webm','video/mp4'])
on conflict (id) do nothing;
create policy "Upload own private recordings" on storage.objects for insert to authenticated
with check (bucket_id = 'meeting-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read own private recordings" on storage.objects for select to authenticated
using (bucket_id = 'meeting-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own private recordings" on storage.objects for delete to authenticated
using (bucket_id = 'meeting-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.file_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  token_hash text not null unique,
  document_ids uuid[] not null,
  message text not null default '',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.file_shares enable row level security;
grant select, update on public.file_shares to authenticated;
grant all on public.file_shares to service_role;
create index file_shares_owner on public.file_shares(owner_id);
create index file_shares_recipient on public.file_shares(recipient_id);
create policy "Read own file shares" on public.file_shares for select to authenticated
using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()));
-- Creation and revocation use verified server routes. No client write grants.
revoke update on public.file_shares from authenticated;
