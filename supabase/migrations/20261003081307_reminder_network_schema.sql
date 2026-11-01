-- The scheduler is paused and has never dispatched a request at this point.
-- Refuse to recreate an extension with existing requests or responses.
do $$ begin
 if exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response) then
  raise exception 'Networking extension is already in use; review before moving it';
 end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions;
