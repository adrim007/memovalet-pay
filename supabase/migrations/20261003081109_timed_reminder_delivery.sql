alter table public.commitments add column reminder_at timestamptz;
create index commitments_timed_reminders on public.commitments(reminder_at) where status='pending' and reminder_at is not null;

-- Durable delivery state is private to the scheduler. Client roles cannot forge deliveries.
create table public.timed_reminder_settings (
  singleton boolean primary key default true check (singleton),
  enabled_since timestamptz not null default now()
);
insert into public.timed_reminder_settings default values;
alter table public.timed_reminder_settings enable row level security;
revoke all on public.timed_reminder_settings from public, anon, authenticated;
grant all on public.timed_reminder_settings to service_role;

create table public.timed_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind in ('reminder','action_item','commitment')),
  source_id uuid not null,
  scheduled_at timestamptz not null,
  title text not null,
  link text not null,
  email_to text,
  state text not null default 'pending' check (state in ('pending','sent','skipped','failed')),
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lock_token uuid,
  locked_until timestamptz,
  last_error text,
  sent_at timestamptz,
  unique (source_kind, source_id, scheduled_at)
);
alter table public.timed_reminder_deliveries enable row level security;
revoke all on public.timed_reminder_deliveries from public, anon, authenticated;
grant all on public.timed_reminder_deliveries to service_role;
create index timed_reminder_pending on public.timed_reminder_deliveries(next_attempt_at) where state='pending';
create index action_items_timed_reminders on public.action_items(reminder_at) where status='todo' and reminder_at is not null;

create function public.claim_timed_reminders(p_lock uuid)
returns setof public.timed_reminder_deliveries
language plpgsql security invoker set search_path = '' as $$
begin
  with due(user_id,source_kind,source_id,scheduled_at,title,link) as (
  select r.user_id,'reminder',r.id,r.remind_at,r.title,'/dashboard'
  from public.reminders r where r.status='pending' and r.remind_at <= now()
    and r.remind_at >= (select enabled_since from public.timed_reminder_settings)
  union all
  select a.user_id,'action_item',a.id,a.reminder_at,a.task,'/tasks?task=' || a.id::text
  from public.action_items a where a.status='todo' and a.reminder_at <= now()
    and a.reminder_at >= (select enabled_since from public.timed_reminder_settings)
  union all
  select c.user_id,'commitment',c.id,c.reminder_at,c.description,
    '/tasks?tab=' || case when c.direction='they_owe' then 'waiting-on' else 'i-owe' end || '#commitment-' || c.id::text
  from public.commitments c where c.status='pending' and c.reminder_at <= now()
    and c.reminder_at >= (select enabled_since from public.timed_reminder_settings)
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
