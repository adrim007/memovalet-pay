-- A database scheduler avoids requiring a paid Vercel cron plan.
create extension if not exists pg_cron;
create extension if not exists pg_net;
alter table public.timed_reminder_settings add column dispatch_hash text;
do $$
declare token text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 perform vault.create_secret(token,'memovalet_reminder_dispatch','Authorizes only the MemoValet reminder scheduler');
 update public.timed_reminder_settings set dispatch_hash=encode(extensions.digest(token,'sha256'),'hex');
end; $$;
create function public.verify_reminder_dispatch(p_token text) returns boolean language sql security invoker set search_path='' as $$
 select coalesce(length(p_token)=64 and dispatch_hash=encode(extensions.digest(p_token,'sha256'),'hex'),false) from public.timed_reminder_settings;
$$;
revoke all on function public.verify_reminder_dispatch(text) from public,anon,authenticated;
grant execute on function public.verify_reminder_dispatch(text) to service_role;
select cron.schedule('memovalet-reminders','* * * * *',$job$
 select net.http_get(
   url:='https://memovalet.com/api/reminders/deliver',
   headers:=jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='memovalet_reminder_dispatch')),
   timeout_milliseconds:=60000
 );
$job$);
-- Enable only after the new application deployment is ready.
select cron.alter_job((select jobid from cron.job where jobname='memovalet-reminders'),active:=false);
notify pgrst,'reload schema';
