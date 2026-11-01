-- Payments: a business connects its own Stripe account (Connect Express),
-- puts a price on a job, and the customer is charged when the job is done.

create table if not exists stripe_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table stripe_accounts enable row level security;

-- Written only by the server (service role); users can see their own link.
create policy "Users can view their own Stripe link"
  on stripe_accounts for select to authenticated
  using (user_id = (select auth.uid()));

alter table task_assignments
  add column if not exists amount_cents integer check (amount_cents is null or amount_cents > 0),
  add column if not exists currency text not null default 'aud',
  add column if not exists customer_email text,
  add column if not exists payment_status text not null default 'none'
    check (payment_status in ('none', 'pending', 'paid', 'failed')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_assignment_id uuid references task_assignments (id) on delete set null,
  amount_cents integer not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  customer_email text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);

alter table payments enable row level security;

create policy "Users can view their own payments"
  on payments for select to authenticated
  using (user_id = (select auth.uid()));
