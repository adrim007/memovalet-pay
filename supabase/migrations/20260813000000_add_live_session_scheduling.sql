-- Scheduled live sessions --------------------------------------------------
-- Lets a host pick a date/time and duration up front (so the countdown timer
-- on the live page reflects the real meeting length instead of a guess) and
-- optionally email a calendar invite to attendees.

alter table live_sessions
  add column if not exists scheduled_start timestamptz,
  add column if not exists duration_minutes integer;
