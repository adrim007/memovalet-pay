// Isolated PostgreSQL policy test: NODE_PATH=<PGlite install>/node_modules
// node tests/database-access.cjs <migration.sql>. Never connects to production.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const uid = '00000000-0000-4000-8000-000000000001';
const outsider = '00000000-0000-4000-8000-000000000002';
const team = '00000000-0000-4000-8000-000000000003';
const tables = ['action_items','bookmarks','commitments','documents','file_shares','folders','live_sessions','meeting_translations','meetings','notes','notifications','payments','people','projects','reminders','shared_items','slack_connections','stripe_accounts','task_assignments','user_google_tokens'];

async function main() {
  const db = new PGlite();
  let passed = 0;
  const check = (value, message) => { assert.ok(value, message); console.log('PASS', message); passed++; };
  const login = async (id, aal = 'aal1', email = 'owner@example.test') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, aal, email })]);
    await db.exec('set role authenticated');
  };
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema private; create schema storage;
      create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      grant usage on schema auth, public, storage to authenticated, anon;
      create table auth.mfa_factors (user_id uuid, status text);
      create table public.teams (id uuid primary key, name text, created_by uuid);
      create table public.team_members (team_id uuid references teams, user_id uuid, role text, primary key(team_id,user_id));
      create table public.team_invites (id uuid primary key default gen_random_uuid(), team_id uuid references teams, token text unique, invited_email text, created_by uuid, accepted_at timestamptz);
      alter table teams enable row level security;
      alter table team_members enable row level security;
      alter table team_invites enable row level security;
      create policy creator_read on teams for select to authenticated using(created_by=auth.uid());
      create policy creator_write on teams for insert to authenticated with check(created_by=auth.uid());
      create policy member_read on team_members for select to authenticated using(user_id=auth.uid());
      create policy "Users can add themselves to a team" on team_members for insert to authenticated with check(user_id=auth.uid());
      create table storage.objects (id uuid default gen_random_uuid(), user_id uuid);
      alter table storage.objects enable row level security;
      create policy owner on storage.objects for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      insert into teams values ('${team}', 'Synthetic team', '${uid}');
      insert into storage.objects(user_id) values ('${uid}');
    `);
    for (const table of tables) await db.exec(`
      create table public.${table} (id uuid default gen_random_uuid(), user_id uuid);
      alter table public.${table} enable row level security;
      create policy owner on public.${table} for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      insert into public.${table}(user_id) values ('${uid}');
    `);
    await db.exec('grant all on all tables in schema public,storage to authenticated;');
    for (const migration of process.argv.slice(2)) await db.exec(fs.readFileSync(migration, 'utf8'));
    await login(uid);
    check((await db.query('select * from documents')).rows.length === 1, 'non-MFA owner keeps access');
    await db.exec(`insert into team_members values ('${team}', '${uid}', 'owner')`);
    check((await db.query('select * from team_members')).rows.length === 1, 'team creator can initialize owner membership');
    await login(outsider);
    await assert.rejects(db.exec(`insert into team_members values ('${team}', '${outsider}', 'owner')`), /row-level security/);
    check(true, 'outsider cannot self-join or promote themselves');
    check((await db.query('select * from documents')).rows.length === 0, 'cross-account documents remain hidden');
    await db.exec('reset role');
    await db.exec(`insert into auth.mfa_factors values ('${uid}', 'unverified')`);
    await login(uid);
    check((await db.query('select * from documents')).rows.length === 1, 'unfinished enrollment does not lock users out');
    await db.exec('reset role');
    await db.exec("update auth.mfa_factors set status='verified'");
    await login(uid);
    for (const table of tables) check((await db.query(`select * from ${table}`)).rows.length === 0, `MFA-pending read blocked: ${table}`);
    check((await db.query('select * from storage.objects')).rows.length === 0, 'MFA-pending storage read blocked');
    await assert.rejects(db.exec(`insert into documents(user_id) values ('${uid}')`), /row-level security/);
    check(true, 'MFA-pending write blocked');
    await login(uid, 'aal2');
    check((await db.query('select * from documents')).rows.length === 1, 'completed MFA restores owner access');
    check((await db.query('select * from storage.objects')).rows.length === 1, 'completed MFA restores storage access');
    await db.exec('reset role');
    await db.exec(`insert into team_invites(team_id,token,invited_email,created_by) values ('${team}','disposable-test-invite','guest@example.test','${uid}')`);
    await login(outsider, 'aal1', 'wrong@example.test');
    await assert.rejects(db.query("select accept_team_invite('disposable-test-invite')"), /email address/);
    check(true, 'wrong-email invitation rejected');
    await login(outsider, 'aal1', 'guest@example.test');
    check((await db.query("select accept_team_invite('disposable-test-invite') as id")).rows[0].id === team, 'valid invitation creates membership');
    await assert.rejects(db.query("select accept_team_invite('disposable-test-invite')"), /already been used/);
    check(true, 'invitation cannot be reused');
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query("select accept_team_invite('disposable-test-invite')"), /permission denied/);
    check(true, 'anonymous invitation RPC denied');
    console.log(`${passed} isolated database checks passed`);
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
