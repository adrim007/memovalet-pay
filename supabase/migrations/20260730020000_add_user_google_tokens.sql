create table if not exists user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table user_google_tokens enable row level security;

create policy "Users can view their own google token"
  on user_google_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own google token"
  on user_google_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own google token"
  on user_google_tokens for update
  to authenticated
  using (auth.uid() = user_id);
