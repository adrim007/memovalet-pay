-- How many natural voice replies each person has had today, so the dashboard's spoken replies
-- have a daily limit. Only the claim function below writes to it.
create table public.spoken_reply_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  replies integer not null default 0 check (replies >= 0),
  primary key (user_id, day)
);

alter table public.spoken_reply_usage enable row level security;
revoke all on public.spoken_reply_usage from public, anon, authenticated;
grant all on public.spoken_reply_usage to service_role;

-- Counts one spoken reply for the signed in person and returns true, or returns false once they
-- have reached today's limit (days are counted in UTC).
create or replace function public.claim_spoken_reply(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  claimed boolean;
begin
  if me is null or p_limit is null or p_limit < 1 then
    return false;
  end if;
  insert into public.spoken_reply_usage (user_id, day) values (me, today) on conflict do nothing;
  update public.spoken_reply_usage
    set replies = replies + 1
    where user_id = me and day = today and replies < p_limit
    returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_spoken_reply(integer) from public, anon;
grant execute on function public.claim_spoken_reply(integer) to authenticated;
