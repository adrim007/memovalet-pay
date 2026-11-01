create table public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text unique,
  subscription_id text unique,
  status text not null default 'none',
  plan text,
  access_until timestamptz,
  trial_ends_at timestamptz,
  trial_used boolean not null default false,
  cancel_at_period_end boolean not null default false,
  lock_token uuid,
  lock_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
revoke all on public.billing_accounts from anon, authenticated;
grant select on public.billing_accounts to authenticated;
grant all on public.billing_accounts to service_role;
create policy "Read own billing status" on public.billing_accounts for select to authenticated using ((select auth.uid()) = user_id);

-- Serialise concurrent checkout attempts and webhook refreshes across servers.
-- This function is callable by the trusted server only.
create function public.claim_billing_lock(p_user_id uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_accounts(user_id) values (p_user_id) on conflict do nothing;
  update public.billing_accounts set lock_token = p_token, lock_until = now() + interval '2 minutes'
  where user_id = p_user_id and (lock_until is null or lock_until < now());
  return found;
end;
$$;
revoke all on function public.claim_billing_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_billing_lock(uuid, uuid) to service_role;
notify pgrst, 'reload schema';
