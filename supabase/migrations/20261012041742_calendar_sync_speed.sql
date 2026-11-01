-- Faster Google Calendar sync.
--
-- remote_seen_at: every Google-side change before this moment has been
-- applied, so a pass only asks Google for events changed since then instead
-- of reading every linked event one at a time.
alter table public.google_calendar_sync add column remote_seen_at timestamptz;

-- Links newly dated, open work to a reserved Google event ID in one statement,
-- instead of the server paging thousands of IDs out and upserting them back
-- every pass. Mirrors SOURCES in lib/google/calendar-sync-model.ts.
create function public.reserve_calendar_sync_items(p_user uuid, p_kinds text[])
returns integer language plpgsql security invoker set search_path = '' as $$
declare added integer := 0; n integer;
begin
  if 'commitment' = any(p_kinds) then
    insert into public.google_calendar_sync_items(user_id, kind, source_id, event_id)
    select p_user, 'commitment', s.id, replace(gen_random_uuid()::text, '-', '')
    from public.commitments s
    where s.user_id = p_user and s.status in ('pending', 'overdue') and s.due_date is not null
      and not exists (select 1 from public.google_calendar_sync_items i where i.user_id = p_user and i.kind = 'commitment' and i.source_id = s.id)
    on conflict (user_id, kind, source_id) do nothing;
    get diagnostics n = row_count; added := added + n;
  end if;
  if 'project' = any(p_kinds) then
    insert into public.google_calendar_sync_items(user_id, kind, source_id, event_id)
    select p_user, 'project', s.id, replace(gen_random_uuid()::text, '-', '')
    from public.projects s
    where s.created_by = p_user and s.status = 'active' and s.due_date is not null
      and not exists (select 1 from public.google_calendar_sync_items i where i.user_id = p_user and i.kind = 'project' and i.source_id = s.id)
    on conflict (user_id, kind, source_id) do nothing;
    get diagnostics n = row_count; added := added + n;
  end if;
  if 'call' = any(p_kinds) then
    insert into public.google_calendar_sync_items(user_id, kind, source_id, event_id)
    select p_user, 'call', s.id, replace(gen_random_uuid()::text, '-', '')
    from public.live_sessions s
    where s.created_by = p_user and s.status = 'active' and s.scheduled_start is not null
      and not exists (select 1 from public.google_calendar_sync_items i where i.user_id = p_user and i.kind = 'call' and i.source_id = s.id)
    on conflict (user_id, kind, source_id) do nothing;
    get diagnostics n = row_count; added := added + n;
  end if;
  if 'action_item' = any(p_kinds) then
    insert into public.google_calendar_sync_items(user_id, kind, source_id, event_id)
    select p_user, 'action_item', s.id, replace(gen_random_uuid()::text, '-', '')
    from public.action_items s
    where s.user_id = p_user and s.status = 'todo' and s.due_date is not null
      and not exists (select 1 from public.google_calendar_sync_items i where i.user_id = p_user and i.kind = 'action_item' and i.source_id = s.id)
    on conflict (user_id, kind, source_id) do nothing;
    get diagnostics n = row_count; added := added + n;
  end if;
  if 'assignment' = any(p_kinds) then
    insert into public.google_calendar_sync_items(user_id, kind, source_id, event_id)
    select p_user, 'assignment', s.id, replace(gen_random_uuid()::text, '-', '')
    from public.task_assignments s
    where s.created_by = p_user and s.status = 'pending' and s.due_date is not null
      and not exists (select 1 from public.google_calendar_sync_items i where i.user_id = p_user and i.kind = 'assignment' and i.source_id = s.id)
    on conflict (user_id, kind, source_id) do nothing;
    get diagnostics n = row_count; added := added + n;
  end if;
  return added;
end;
$$;
revoke all on function public.reserve_calendar_sync_items(uuid, text[]) from public, anon, authenticated;
grant execute on function public.reserve_calendar_sync_items(uuid, text[]) to service_role;
notify pgrst, 'reload schema';
