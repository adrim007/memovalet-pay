-- pg_net is platform managed and grants table access to PUBLIC. Its queue must
-- never contain a reusable credential. Sign a timestamp valid for two minutes.
create or replace function public.verify_reminder_dispatch(p_token text) returns boolean language plpgsql security invoker set search_path='' as $$
declare stamp text; supplied text; expected text; seconds bigint;
begin
 if p_token is null or p_token !~ '^[0-9]{10}\.[a-f0-9]{64}$' then return false; end if;
 stamp:=split_part(p_token,'.',1); supplied:=split_part(p_token,'.',2); seconds:=stamp::bigint;
 if seconds<extract(epoch from now())-120 or seconds>extract(epoch from now())+5 then return false; end if;
 select encode(extensions.hmac(stamp,dispatch_hash,'sha256'),'hex') into expected from public.timed_reminder_settings;
 return coalesce(supplied=expected,false);
end; $$;
revoke all on function public.verify_reminder_dispatch(text) from public,anon,authenticated;
grant execute on function public.verify_reminder_dispatch(text) to service_role;
select cron.alter_job((select jobid from cron.job where jobname='memovalet-reminders'),command:=$job$
 with stamp as (select floor(extract(epoch from now()))::bigint::text as value)
 select net.http_get(
  url:='https://memovalet.com/api/reminders/deliver',
  headers:=jsonb_build_object('Authorization','Bearer ' || stamp.value || '.' || encode(extensions.hmac(stamp.value,s.dispatch_hash,'sha256'),'hex')),
  timeout_milliseconds:=60000
 ) from stamp cross join public.timed_reminder_settings s;
$job$,active:=false);
notify pgrst,'reload schema';
