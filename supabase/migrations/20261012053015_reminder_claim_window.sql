-- The every-minute reminder claim looked back to enabled_since, so every open
-- item whose reminder time had passed was re-read each minute, forever, and
-- the reminders table had no index for it at all. Look back one day at most:
-- longer than the 20 hour retry window, and a reminder set for a time more
-- than a day gone is still listed as due on Home rather than emailed late.
create index if not exists reminders_timed_reminders on public.reminders(remind_at) where status = 'pending';

create or replace function public.claim_timed_reminders(p_lock uuid)
returns setof public.timed_reminder_deliveries
language plpgsql security invoker set search_path = '' as $$
declare since timestamptz := greatest((select enabled_since from public.timed_reminder_settings), now() - interval '1 day');
begin
  with due(user_id,source_kind,source_id,scheduled_at,title,link) as (
  select r.user_id,'reminder',r.id,r.remind_at,r.title,'/dashboard'
  from public.reminders r where r.status='pending' and r.remind_at <= now() and r.remind_at >= since
  union all
  select a.user_id,'action_item',a.id,a.reminder_at,a.task,'/tasks?task=' || a.id::text
  from public.action_items a where a.status='todo' and a.reminder_at <= now() and a.reminder_at >= since
  union all
  select c.user_id,'commitment',c.id,c.reminder_at,c.description,
    '/tasks?tab=' || case when c.direction='they_owe' then 'waiting-on' else 'i-owe' end || '#commitment-' || c.id::text
  from public.commitments c where c.status='pending' and c.reminder_at <= now() and c.reminder_at >= since
  )
  insert into public.timed_reminder_deliveries(user_id,source_kind,source_id,scheduled_at,title,link)
  select * from due where not exists (
    select 1 from public.timed_reminder_deliveries d
    where d.source_kind=due.source_kind and d.source_id=due.source_id and d.scheduled_at=due.scheduled_at
  ) order by scheduled_at limit 250
  on conflict (source_kind,source_id,scheduled_at) do nothing;

  -- Stop retries before the email provider's 24 hour idempotency retention expires.
  update public.timed_reminder_deliveries set state='failed',last_error='Delivery retry window expired'
  where state='pending' and (attempts >= 10 or first_attempt_at < now()-interval '20 hours')
    and (locked_until is null or locked_until < now());

  return query
  with candidates as (
    select d.id from public.timed_reminder_deliveries d
    where d.state='pending' and d.next_attempt_at <= now()
      and (d.locked_until is null or d.locked_until < now())
    order by d.scheduled_at limit 25 for update skip locked
  )
  update public.timed_reminder_deliveries d set lock_token=p_lock,
    locked_until=now()+interval '3 minutes', attempts=d.attempts+1,
    first_attempt_at=coalesce(d.first_attempt_at,now())
  from candidates c where d.id=c.id returning d.*;
end;
$$;
revoke all on function public.claim_timed_reminders(uuid) from public, anon, authenticated;
grant execute on function public.claim_timed_reminders(uuid) to service_role;
notify pgrst, 'reload schema';
