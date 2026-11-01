alter table meetings add column share_token text unique;

create index if not exists meetings_share_token_idx on meetings (share_token);
