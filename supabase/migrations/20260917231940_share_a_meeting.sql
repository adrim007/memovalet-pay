-- Let a meeting be sent to another MemoValet account, the way a note or a
-- project already can be.
--
-- Until now the only ways to get a meeting to someone were an email pack or a
-- public link. Someone who has an account should just find it in their own
-- library, which is what sharing means everywhere else in the app.
--
-- Recipients get what team members already get on a team meeting: the summary,
-- the transcript and the recording. That is the point of sending it — and the
-- recording route authorises through this same policy, so it stays consistent.

alter table public.shared_items drop constraint shared_items_item_type_check;
alter table public.shared_items add constraint shared_items_item_type_check
  check (item_type in ('note', 'project', 'meeting'));

create policy "Recipients can view meetings shared with them" on public.meetings
  for select to authenticated
  using (
    id in (
      select item_id from public.shared_items
      where item_type = 'meeting' and shared_with_user_id = (select auth.uid())
    )
  );
