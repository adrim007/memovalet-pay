do $$
declare owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); team uuid:=gen_random_uuid(); session uuid:=gen_random_uuid(); reservation uuid:=gen_random_uuid(); result jsonb;
begin
 insert into auth.users(id) values(owner_id),(member_id),(other_id);
 insert into public.billing_accounts(user_id,plan,status,access_until,seats) values(owner_id,'business','trialing',now()+interval '14 days',2);
 insert into public.teams(id,created_by,name) values(team,owner_id,'Temporary billing test');
 insert into public.team_members(team_id,user_id,role) values(team,owner_id,'owner'),(team,member_id,'member'),(team,other_id,'member');
 result:=public.assign_billing_seat(owner_id,member_id);
 if result->>'ok'<>'true' then raise exception 'seat allocation failed: %',result; end if;
 result:=public.assign_billing_seat(owner_id,other_id);
 if result->>'error' is null then raise exception 'capacity bypass'; end if;
 result:=public.billing_entitlement(member_id);
 if result->>'plan'<>'business' or (result->>'allowance_seconds')::integer<>144000 then raise exception 'pool not shared'; end if;
 insert into public.live_sessions(id,created_by,title) values(session,member_id,'Temporary allowance test');
 result:=public.reserve_transcription(session,20,reservation);
 if result->>'ok'<>'true' then raise exception 'reservation failed: %',result; end if;
 if (public.billing_entitlement(owner_id)->>'used_seconds')::numeric<>20 then raise exception 'wrong usage'; end if;
 perform public.refund_transcription(reservation); perform public.refund_transcription(reservation);
 if (public.billing_entitlement(owner_id)->>'used_seconds')::numeric<>0 then raise exception 'refund not idempotent'; end if;
 update public.transcription_usage set seconds=143990 where payer_id=owner_id;
 result:=public.reserve_transcription(session,20,gen_random_uuid());
 if result->>'ok'<>'false' then raise exception 'quota bypass'; end if;
 update public.billing_accounts set seats=1 where user_id=owner_id;
 if public.billing_entitlement(member_id)->>'plan'<>'free' then raise exception 'seat downgrade not enforced'; end if;
 update public.billing_accounts set status='past_due' where user_id=owner_id;
 if public.billing_entitlement(owner_id)->>'plan'<>'free' then raise exception 'unpaid access'; end if;
 if has_function_privilege('authenticated','public.reserve_transcription(uuid,numeric,uuid)','execute') or has_table_privilege('authenticated','public.billing_seats','insert') then raise exception 'client access'; end if;
end $$;
-- Run this file inside BEGIN and ROLLBACK against the migrated schema.
-- Direct Data API creation must also respect the rollout once enabled.
update public.billing_rollout set enforced=true;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
 begin
  insert into public.teams(name,created_by) values('Guard must reject',auth.uid());
  raise exception 'Guard did not block Free creation';
 exception when insufficient_privilege then null;
 end;
end $$;
