-- Release operation only, after the deployed dispatch endpoint, Google
-- consent and one disposable calendar have passed acceptance checks.
-- Uses the existing short lived signed dispatcher; no permanent credential
-- is written into the pg_net request queue. Each minute's run serves as many
-- customers as fit in its time budget, several in parallel.
select cron.schedule('memovalet-google-calendar-sync', '* * * * *', $job$
 with stamp as (select floor(extract(epoch from now()))::bigint::text as value)
 select net.http_get(
   url:='https://memovalet.com/api/calendar/google/dispatch',
   headers:=jsonb_build_object('Authorization','Bearer ' || stamp.value || '.' || encode(extensions.hmac(stamp.value,s.dispatch_hash,'sha256'),'hex')),
   timeout_milliseconds:=60000
 ) from stamp cross join public.timed_reminder_settings s;
$job$);
-- To pause background dispatch:
-- select cron.alter_job((select jobid from cron.job where jobname='memovalet-google-calendar-sync'), active:=false);
