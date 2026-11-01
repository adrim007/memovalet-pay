-- Meeting video storage -------------------------------------------------

alter table meetings add column if not exists video_url text;

insert into storage.buckets (id, name, public)
values ('meeting-videos', 'meeting-videos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload their own meeting videos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meeting-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view meeting videos"
  on storage.objects for select
  to public
  using (bucket_id = 'meeting-videos');

create policy "Users can delete their own meeting videos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meeting-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
