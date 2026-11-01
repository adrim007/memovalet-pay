-- Supabase project defaults grant broad privileges on newly created tables.
-- Remove inherited client grants before granting only the intended operations.
revoke all on public.file_shares from public, anon, authenticated;
grant select on public.file_shares to authenticated;
grant all on public.file_shares to service_role;
revoke all on public.meeting_translations from public, anon, authenticated;
grant select, insert, update, delete on public.meeting_translations to authenticated;
grant all on public.meeting_translations to service_role;
-- Slack credentials are intentionally service-only, with no client RLS policy.
revoke all on public.slack_connections from public, anon, authenticated;
grant all on public.slack_connections to service_role;
