-- pg_net grants broad table access by default. Dispatch headers contain a secret.
revoke all on all tables in schema net from public,anon,authenticated;
revoke usage on schema net from public,anon,authenticated;
