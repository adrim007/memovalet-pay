alter table meetings add column user_id uuid not null references auth.users(id) on delete cascade;

create index if not exists meetings_user_id_idx on meetings (user_id);

drop policy if exists "Allow anon read access to meetings" on meetings;
drop policy if exists "Allow anon insert access to meetings" on meetings;

create policy "Users can view their own meetings"
  on meetings for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own meetings"
  on meetings for insert
  to authenticated
  with check (auth.uid() = user_id);
