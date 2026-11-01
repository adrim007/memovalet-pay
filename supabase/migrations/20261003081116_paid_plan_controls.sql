alter table public.billing_accounts add column seats integer not null default 1 check (seats between 1 and 50);
create table public.billing_seats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payer_id uuid not null references public.billing_accounts(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  check(user_id <> payer_id)
);
create index billing_seats_payer on public.billing_seats(payer_id);
alter table public.billing_seats enable row level security;
revoke all on public.billing_seats from public,anon,authenticated;
grant all on public.billing_seats to service_role;
create table public.transcription_usage (
  payer_id uuid not null references public.billing_accounts(user_id) on delete cascade,
  period date not null,
  seconds numeric not null default 0 check(seconds >= 0),
  primary key(payer_id,period)
);
alter table public.transcription_usage enable row level security;
revoke all on public.transcription_usage from public,anon,authenticated;
grant all on public.transcription_usage to service_role;
create table public.transcription_reservations (
 id uuid primary key, payer_id uuid not null references public.billing_accounts(user_id) on delete cascade,
 period date not null, seconds numeric not null check(seconds>0), refunded boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.transcription_reservations enable row level security;
revoke all on public.transcription_reservations from public,anon,authenticated;
grant all on public.transcription_reservations to service_role;

create function public.billing_entitlement(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.billing_accounts; payer uuid:=p_user; allowance integer:=0; used numeric:=0; v_period date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 select * into a from public.billing_accounts where user_id=p_user and status in ('active','trialing') and access_until>now() and plan in ('member','business');
 if not found then
  select b.* into a from public.billing_accounts b join (
    select s.*,row_number() over(partition by payer_id order by created_at,user_id) as seat_number from public.billing_seats s
  ) s on s.payer_id=b.user_id where s.user_id=p_user and b.plan='business' and b.status in ('active','trialing') and b.access_until>now() and s.seat_number<b.seats;
 end if;
 if a.user_id is not null then payer:=a.user_id; allowance:=case when a.plan='business' then 72000*a.seats else 36000 end; end if;
 select coalesce(seconds,0) into used from public.transcription_usage where payer_id=payer and transcription_usage.period=v_period;
 return jsonb_build_object('plan',coalesce(a.plan,'free'),'payer_id',payer,'allowance_seconds',allowance,'used_seconds',coalesce(used,0),'seats',coalesce(a.seats,0));
end; $$;
revoke all on function public.billing_entitlement(uuid) from public,anon,authenticated;
grant execute on function public.billing_entitlement(uuid) to service_role;

create function public.assign_billing_seat(p_owner uuid,p_user uuid,p_remove boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.billing_accounts; n integer;
begin
 select * into a from public.billing_accounts where user_id=p_owner for update;
 if p_user=p_owner then return jsonb_build_object('error','The billing owner already has a seat.'); end if;
 if p_remove then delete from public.billing_seats where payer_id=p_owner and user_id=p_user; return jsonb_build_object('ok',true); end if;
 if a.plan is distinct from 'business' or a.status not in ('active','trialing') or a.access_until is null or a.access_until<=now() then return jsonb_build_object('error','An active Business subscription is required.'); end if;
 if not exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id where t.created_by=p_owner and m.user_id=p_user) then return jsonb_build_object('error','Choose a member of a group you own.'); end if;
 if exists(select 1 from public.billing_accounts where user_id=p_user and status in ('active','trialing') and access_until>now()) then return jsonb_build_object('error','This person already has their own subscription.'); end if;
 if exists(select 1 from public.billing_seats where user_id=p_user and payer_id=p_owner) then return jsonb_build_object('ok',true); end if;
 select count(*) into n from public.billing_seats where payer_id=p_owner;
 if n>=a.seats-1 then return jsonb_build_object('error','All purchased seats are assigned. Update your seat quantity in Manage billing first.'); end if;
 insert into public.billing_seats(user_id,payer_id) values(p_user,p_owner) on conflict(user_id) do nothing;
 if not found then return jsonb_build_object('error','This person already has a seat on another subscription.'); end if;
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.assign_billing_seat(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.assign_billing_seat(uuid,uuid,boolean) to service_role;

create function public.reserve_transcription(p_session uuid,p_seconds numeric,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare host uuid; e jsonb; payer uuid; n numeric; v_period date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 if p_seconds is null or p_seconds<=0 or p_seconds>21 then raise exception 'Invalid audio duration'; end if;
 select created_by into host from public.live_sessions where id=p_session;
 if host is null then return jsonb_build_object('ok',false,'error','Meeting not found.'); end if;
 e:=public.billing_entitlement(host); payer:=(e->>'payer_id')::uuid;
 perform 1 from public.billing_accounts where user_id=payer for update;
 e:=public.billing_entitlement(host);
 if (e->>'allowance_seconds')::integer=0 then return jsonb_build_object('ok',false,'error','The host needs Member or Business for transcription.'); end if;
 -- Re-evaluation after the lock prevents a simultaneous plan change from granting excess minutes.
 if (e->>'payer_id')::uuid<>payer then return jsonb_build_object('ok',false,'error','The host plan changed. Please retry.'); end if;
 if exists(select 1 from public.transcription_reservations where id=p_id) then return jsonb_build_object('ok',false,'error','This audio request was already reserved.'); end if;
 insert into public.transcription_usage(payer_id,period) values(payer,v_period) on conflict do nothing;
 update public.transcription_usage set seconds=seconds+p_seconds where payer_id=payer and transcription_usage.period=v_period and seconds+p_seconds<=(e->>'allowance_seconds')::integer returning seconds into n;
 if not found then return jsonb_build_object('ok',false,'error','The host has used the transcription allowance for this month. Calls can continue without transcription.'); end if;
 insert into public.transcription_reservations(id,payer_id,period,seconds) values(p_id,payer,v_period,p_seconds);
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.reserve_transcription(uuid,numeric,uuid) from public,anon,authenticated;
grant execute on function public.reserve_transcription(uuid,numeric,uuid) to service_role;
create function public.refund_transcription(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare r public.transcription_reservations;
begin
 update public.transcription_reservations set refunded=true where id=p_id and not refunded returning * into r;
 if found then update public.transcription_usage set seconds=greatest(0,seconds-r.seconds) where payer_id=r.payer_id and period=r.period; end if;
end; $$;
revoke all on function public.refund_transcription(uuid) from public,anon,authenticated;
grant execute on function public.refund_transcription(uuid) to service_role;
notify pgrst,'reload schema';

-- Keep direct Data API writes consistent with server feature checks at paid launch.
create table public.billing_rollout(singleton boolean primary key default true check(singleton),enforced boolean not null default false);
insert into public.billing_rollout default values;
alter table public.billing_rollout enable row level security;
revoke all on public.billing_rollout from public,anon,authenticated;
grant all on public.billing_rollout to service_role;
create schema if not exists billing_private;
revoke all on schema billing_private from public,anon,authenticated;
create function billing_private.check_paid_creation() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); e jsonb;
begin
 if actor is null or not (select enforced from public.billing_rollout) then return new; end if;
 e:=public.billing_entitlement(actor);
 if e->>'plan'='free' or (TG_ARGV[0]='business' and e->>'plan'<>'business') then raise exception 'A paid plan is required for this feature' using errcode='42501'; end if;
 return new;
end; $$;
revoke all on function billing_private.check_paid_creation() from public,anon,authenticated;
create trigger paid_project_creation before insert on public.projects for each row execute function billing_private.check_paid_creation('member');
create trigger paid_call_creation before insert on public.live_sessions for each row execute function billing_private.check_paid_creation('member');
create trigger paid_assignment_creation before insert on public.task_assignments for each row execute function billing_private.check_paid_creation('member');
create trigger paid_group_creation before insert on public.teams for each row execute function billing_private.check_paid_creation('business');
