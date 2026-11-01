-- MemoValet-to-MemoValet sharing: a note or project shared directly with
-- another MemoValet user (no team required). The recipient sees the item in
-- their own list; the owner keeps full control. Plus bookmarks: saved links.

create table if not exists shared_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('note', 'project')),
  item_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  shared_with_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_type, item_id, shared_with_user_id)
);

create index if not exists shared_items_recipient_idx on shared_items (shared_with_user_id, item_type);
create index if not exists shared_items_item_idx on shared_items (item_type, item_id);

alter table shared_items enable row level security;

create policy "Owners manage their shares"
  on shared_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Recipients can see what was shared with them"
  on shared_items for select to authenticated
  using (shared_with_user_id = (select auth.uid()));

-- Recipients can read (not edit) notes and projects shared with them.
create policy "Recipients can view notes shared with them"
  on notes for select to authenticated
  using (
    id in (
      select item_id from shared_items
      where item_type = 'note' and shared_with_user_id = (select auth.uid())
    )
  );

create policy "Recipients can view projects shared with them"
  on projects for select to authenticated
  using (
    id in (
      select item_id from shared_items
      where item_type = 'project' and shared_with_user_id = (select auth.uid())
    )
  );

-- Bookmarks: saved links (a web search worth keeping, a supplier's site, a
-- restaurant, anything). Private to the user.
create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists bookmarks_user_idx on bookmarks (user_id, created_at desc);

alter table bookmarks enable row level security;

create policy "Users manage their own bookmarks"
  on bookmarks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
