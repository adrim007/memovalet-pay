-- Support meeting-level lookups and foreign-key cleanup without a table scan.
create index meeting_translations_meeting_id_idx on public.meeting_translations(meeting_id);
