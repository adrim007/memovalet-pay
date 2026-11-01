const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, client) {
  const module = { exports: {} };
  const mocks = {
    'react': { cache: fn => fn },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/supabase/server': { createClient: async () => client },
    './supabase/server': { createClient: async () => client },
    './supabase/service': {},
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: module.exports, module, URL, console: { error() {} }, require: name => mocks[name] });
  return module.exports;
}

function searchClient(user, failure = false) {
  const calls = [];
  return { calls, auth: { getUser: async () => ({ data: { user } }) }, from(table) {
    const query = { then: (resolve) => resolve({ data: [{ id: table, title: 'Test', created_at: '2026-09-11' }], error: failure }) };
    for (const method of ['select', 'eq', 'or', 'order', 'limit']) query[method] = (...args) => { calls.push([table, method, ...args]); return query; };
    return query;
  } };
}
test('quick search rejects signed-out users without querying private records', async () => {
  const client = searchClient(null);
  const result = await load('app/api/search/route.ts', client).GET({ url: 'https://example.test/api/search?q=test' });
  assert.equal(result.status, 401);
  assert.equal(client.calls.length, 0);
});
test('quick search bounds queries and limits personal documents and notes to the owner', async () => {
  const client = searchClient({ id: 'owner' });
  const result = await load('app/api/search/route.ts', client).GET({ url: 'https://example.test/api/search?q=test' });
  assert.equal(result.status, 200);
  assert.equal(result.body.results.length, 3);
  assert.equal(result.body.results.find(row => row.kind === 'Note').href, '/notes#note-notes');
  for (const table of ['documents', 'notes']) assert.ok(client.calls.some(c => c[0] === table && c[1] === 'eq' && c[2] === 'user_id' && c[3] === 'owner'));
  assert.equal(client.calls.filter(c => c[1] === 'limit' && c[2] === 8).length, 3);
});
test('quick search reports backend failure rather than an empty success', async () => {
  const client = searchClient({ id: 'owner' }, true);
  const result = await load('app/api/search/route.ts', client).GET({ url: 'https://example.test/api/search?q=test' });
  assert.equal(result.status, 503);
});
for (const method of ['updateMeetingNotes', 'updateDocument']) {
  test(`${method} does not claim success when no row was changed`, async () => {
    const query = { update() { return this; }, eq() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
    const db = load('lib/database.ts', { from: () => query });
    assert.equal(await db[method]('missing', method === 'updateDocument' ? { notes: 'test' } : 'test'), false);
  });
}

test('team acceptance uses only the validated invitation RPC', async () => {
  const calls = [];
  const db = load('lib/database.ts', {
    auth: { getUser: async () => ({ data: { user: { id: 'guest' } } }) },
    rpc: async (...args) => { calls.push(args); return { data: 'team-id', error: null }; },
  });
  assert.equal((await db.acceptTeamInvite('token', 'guest')).teamId, 'team-id');
  assert.equal(calls[0][0], 'accept_team_invite');
  assert.equal(calls[0][1].invite_token, 'token');
});
test('team acceptance refuses a mismatched identity before the RPC', async () => {
  const db = load('lib/database.ts', {
    auth: { getUser: async () => ({ data: { user: { id: 'other' } } }) },
    rpc: async () => { throw new Error('must not run'); },
  });
  assert.match((await db.acceptTeamInvite('token', 'guest')).error, /Sign in/);
});
test('rejected invitations never fall back to direct membership insertion', async () => {
  const db = load('lib/database.ts', {
    auth: { getUser: async () => ({ data: { user: { id: 'guest' } } }) },
    rpc: async () => ({ data: null, error: { message: 'used token' } }),
    from: () => { throw new Error('must not insert directly'); },
  });
  assert.match((await db.acceptTeamInvite('token', 'guest')).error, /Couldn't join/);
});
