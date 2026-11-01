// Per-person Notion and Trello connections, run against fakes: no calls to
// Notion or Trello, no database. What matters most: a connection can't be
// hijacked, and each person's notes only ever go to their own account.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function resolveFile(base) {
  for (const candidate of [base + '.ts', base + '.tsx', base + '/index.ts']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('cannot resolve ' + base);
}

// Loads the real source, resolving @/ and relative imports to more real source,
// with the named modules swapped for fakes.
function load(file, world) {
  const cache = {};
  const loadOne = (f) => {
    if (cache[f]) return cache[f].exports;
    const js = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} };
    cache[f] = module;
    const req = (name) => {
      if (world.modules[name]) return world.modules[name];
      if (name.startsWith('@/')) return loadOne(resolveFile(name.slice(2)));
      if (name.startsWith('.')) return loadOne(resolveFile(path.join(path.dirname(f), name)));
      return require(name);
    };
    vm.runInNewContext(js, {
      exports: module.exports, module, require: req, Buffer, URL, URLSearchParams, Response, Request,
      fetch: world.fetch, process: { env: world.env }, console: { error() {} },
    });
    return module.exports;
  };
  return loadOne(file);
}

function makeWorld({ user = { id: 'user-1' }, rows = {}, env = {}, remote = () => ({ status: 404, body: {} }) } = {}) {
  const jar = new Map();
  const db = { writes: [], rows: JSON.parse(JSON.stringify(rows)) };
  const table = (name) => {
    const filters = {};
    const q = {
      select() { return q; },
      eq(k, v) { filters[k] = v; return q; },
      async maybeSingle() {
        const row = (db.rows[name] || []).find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        return { data: row || null, error: null };
      },
      upsert(row) { db.writes.push({ table: name, op: 'upsert', row }); return Promise.resolve({ error: null }); },
      update(row) { const u = { table: name, op: 'update', row, filters }; db.writes.push(u); return { eq(k, v) { u.filters = { ...u.filters, [k]: v }; return Promise.resolve({ error: null }); } }; },
      delete() { const d = { table: name, op: 'delete', filters }; db.writes.push(d); return q; },
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
    };
    return q;
  };
  const calls = [];
  const world = {
    env: { TRELLO_API_KEY: 'app-key', NOTION_CLIENT_ID: 'nid', NOTION_CLIENT_SECRET: 'nsecret', ...env },
    db, jar, calls,
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const { status, body } = remote(String(url), init);
      return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
    },
    modules: {
      'next/server': { NextResponse: Response },
      'next/headers': {
        cookies: async () => ({
          get: (n) => (jar.has(n) ? { value: jar.get(n) } : undefined),
          set: (n, v) => { if (v) jar.set(n, v); else jar.delete(n); },
        }),
      },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
      '@/lib/supabase/service': { createServiceClient: () => ({ from: table }) },
    },
  };
  return world;
}

const post = (url, body, origin = 'https://memovalet.com') =>
  new Request(url, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- Trello

test('Trello: a token arriving without the matching state is refused (no hijacking)', async () => {
  const world = makeWorld();
  world.jar.set('memovalet_trello_state', 'user-1:the-real-state');
  const { POST } = load('app/api/integrations/trello/save/route.ts', world);
  const res = await POST(post('https://memovalet.com/api/integrations/trello/save', { token: 'a'.repeat(64), state: 'attacker-state' }));
  assert.equal(res.status, 400);
  assert.equal(world.db.writes.length, 0);
});

test('Trello: a state issued to someone else is refused', async () => {
  const world = makeWorld();
  world.jar.set('memovalet_trello_state', 'other-user:s1');
  const { POST } = load('app/api/integrations/trello/save/route.ts', world);
  const res = await POST(post('https://memovalet.com/api/integrations/trello/save', { token: 'a'.repeat(64), state: 's1' }));
  assert.equal(res.status, 400);
});

test('Trello: requests from another website are refused', async () => {
  const world = makeWorld();
  const { POST } = load('app/api/integrations/trello/save/route.ts', world);
  const res = await POST(post('https://memovalet.com/api/integrations/trello/save', {}, 'https://evil.example'));
  assert.equal(res.status, 403);
});

test('Trello: a valid token is checked with Trello, then saved for this person only', async () => {
  const world = makeWorld({ remote: (url) => url.includes('/members/me') ? { status: 200, body: { fullName: 'Ada L' } } : { status: 404, body: {} } });
  world.jar.set('memovalet_trello_state', 'user-1:s1');
  const { POST } = load('app/api/integrations/trello/save/route.ts', world);
  const res = await POST(post('https://memovalet.com/api/integrations/trello/save', { token: 'b'.repeat(64), state: 's1' }));
  assert.equal(res.status, 200);
  assert.equal(world.db.writes[0].row.user_id, 'user-1');
  assert.equal(world.db.writes[0].row.member_name, 'Ada L');
  // The state is single-use.
  assert.equal(world.jar.has('memovalet_trello_state'), false);
});

test('Trello: something that is not a token never reaches Trello', async () => {
  const world = makeWorld();
  world.jar.set('memovalet_trello_state', 'user-1:s1');
  const { POST } = load('app/api/integrations/trello/save/route.ts', world);
  const res = await POST(post('https://memovalet.com/api/integrations/trello/save', { token: 'x&key=steal', state: 's1' }));
  assert.equal(res.status, 400);
  assert.equal(world.calls.length, 0);
});

test('Trello: cards go to this person\'s chosen list with their own token', async () => {
  const world = makeWorld({
    rows: { trello_connections: [{ user_id: 'user-1', token: 'own-token', member_name: 'A', list_id: 'list-123', list_name: 'Doing', board_name: 'B' }] },
    remote: () => ({ status: 200, body: { name: 'Send proposal', shortUrl: 'https://trello.com/c/x' } }),
  });
  const { createTrelloCards } = load('lib/exports/trello.ts', world);
  const cards = await createTrelloCards({ action_items: [{ task: 'Send proposal', owner: 'Ada' }], metadata: { title: 'Kickoff' } }, 'user-1');
  assert.equal(cards.length, 1);
  const called = new URL(world.calls[0].url);
  assert.equal(called.searchParams.get('token'), 'own-token');
  assert.equal(called.searchParams.get('idList'), 'list-123');
  assert.match(called.searchParams.get('desc'), /Owner: Ada/);
});

test('Trello: with no list chosen, nothing is sent anywhere', async () => {
  const world = makeWorld({ rows: { trello_connections: [{ user_id: 'user-1', token: 't', member_name: 'A', list_id: null }] } });
  const { createTrelloCards } = load('lib/exports/trello.ts', world);
  await assert.rejects(createTrelloCards({ action_items: [{ task: 'x' }] }, 'user-1'), /choose a list/);
  assert.equal(world.calls.length, 0);
});

test('Trello: someone else\'s connection is never used', async () => {
  const world = makeWorld({ rows: { trello_connections: [{ user_id: 'someone-else', token: 't', member_name: 'A', list_id: 'l' }] } });
  const { createTrelloCards } = load('lib/exports/trello.ts', world);
  await assert.rejects(createTrelloCards({ action_items: [{ task: 'x' }] }, 'user-1'));
  assert.equal(world.calls.length, 0);
});

test('Trello: a revoked token is let go, so Settings stops saying Connected', async () => {
  const world = makeWorld({
    rows: { trello_connections: [{ user_id: 'user-1', token: 'dead', member_name: 'A', list_id: 'l' }] },
    remote: () => ({ status: 401, body: {} }),
  });
  const { createTrelloCards } = load('lib/exports/trello.ts', world);
  await assert.rejects(createTrelloCards({ action_items: [{ task: 'x' }] }, 'user-1'));
  assert.deepEqual(world.db.writes.at(-1), { table: 'trello_connections', op: 'delete', filters: { user_id: 'user-1', token: 'dead' } });
});

test('Trello: a list is only accepted if the person\'s own Trello can reach it', async () => {
  const world = makeWorld({
    rows: { trello_connections: [{ user_id: 'user-1', token: 'own', member_name: 'A' }] },
    remote: () => ({ status: 404, body: {} }),
  });
  const { POST } = load('app/api/integrations/trello/list/route.ts', world);
  const res = await POST(post('https://memovalet.com/api/integrations/trello/list', { listId: 'a'.repeat(24) }));
  assert.equal(res.status, 400);
  assert.equal(world.db.writes.length, 0);
});

// ---------------------------------------------------------------- Notion

test('Notion: returning without the matching state is refused', async () => {
  const world = makeWorld();
  world.jar.set('memovalet_notion_state', 'user-1:real');
  const { GET } = load('app/api/integrations/notion/callback/route.ts', world);
  const res = await GET(new Request('https://memovalet.com/api/integrations/notion/callback?code=c&state=forged'));
  assert.match(res.headers.get('location'), /notion=failed/);
  assert.equal(world.calls.length, 0);
});

test('Notion: a good return saves the token and the shared page, for this person', async () => {
  const world = makeWorld({
    remote: (url) =>
      url.endsWith('/oauth/token') ? { status: 200, body: { access_token: 'ntn_own', workspace_name: 'Acme', workspace_id: 'w1' } }
      : url.endsWith('/search') ? { status: 200, body: { results: [
          { id: 'db-page', parent: { type: 'database_id' }, properties: { Name: { type: 'title', title: [{ plain_text: 'Row' }] } } },
          { id: 'top-page', parent: { type: 'workspace' }, properties: { title: { type: 'title', title: [{ plain_text: 'Meetings' }] } } },
        ] } }
      : { status: 404, body: {} },
  });
  world.jar.set('memovalet_notion_state', 'user-1:s1');
  const { GET } = load('app/api/integrations/notion/callback/route.ts', world);
  const res = await GET(new Request('https://memovalet.com/api/integrations/notion/callback?code=c&state=s1'));
  assert.match(res.headers.get('location'), /notion=connected/);
  const row = world.db.writes[0].row;
  assert.equal(row.user_id, 'user-1');
  assert.equal(row.parent_page_id, 'top-page'); // a top-level page beats a database row
  assert.equal(row.parent_page_title, 'Meetings');
});

test('Notion: connected but no page shared — kept, and the person is told', async () => {
  const world = makeWorld({
    remote: (url) => url.endsWith('/oauth/token') ? { status: 200, body: { access_token: 't', workspace_name: 'Acme' } } : { status: 200, body: { results: [] } },
  });
  world.jar.set('memovalet_notion_state', 'user-1:s1');
  const { GET } = load('app/api/integrations/notion/callback/route.ts', world);
  const res = await GET(new Request('https://memovalet.com/api/integrations/notion/callback?code=c&state=s1'));
  assert.match(res.headers.get('location'), /notion=nopage/);
  assert.equal(world.db.writes[0].row.parent_page_id, null);
});

test('Notion: pages are saved with this person\'s own token, into their page', async () => {
  const world = makeWorld({
    rows: { notion_connections: [{ user_id: 'user-1', access_token: 'ntn_own', workspace_name: 'Acme', parent_page_id: 'p1', parent_page_title: 'Meetings' }] },
    remote: () => ({ status: 200, body: { url: 'https://notion.so/x' } }),
  });
  const { exportToNotion } = load('lib/exports/notion.ts', world);
  const url = await exportToNotion({ meeting_summary: 'Short', metadata: { title: 'Kickoff' } }, 'user-1');
  assert.equal(url, 'https://notion.so/x');
  assert.equal(world.calls[0].init.headers.Authorization, 'Bearer ntn_own');
  assert.equal(JSON.parse(world.calls[0].init.body).parent.page_id, 'p1');
});

test('Notion: a long summary is split, not rejected (2,000-character limit per run)', async () => {
  const world = makeWorld({
    rows: { notion_connections: [{ user_id: 'user-1', access_token: 't', workspace_name: 'A', parent_page_id: 'p1' }] },
    remote: () => ({ status: 200, body: { url: 'u' } }),
  });
  const { exportToNotion } = load('lib/exports/notion.ts', world);
  await exportToNotion({ meeting_summary: 'x'.repeat(4500) }, 'user-1');
  const blocks = JSON.parse(world.calls[0].init.body).children;
  const runs = blocks[1].paragraph.rich_text;
  assert.equal(runs.length, 3);
  assert.ok(runs.every((r) => r.text.content.length <= 2000));
  assert.equal(runs.map((r) => r.text.content).join('').length, 4500);
});

test('Notion: with no shared page, nothing is sent', async () => {
  const world = makeWorld({ rows: { notion_connections: [{ user_id: 'user-1', access_token: 't', workspace_name: 'A', parent_page_id: null }] } });
  const { exportToNotion } = load('lib/exports/notion.ts', world);
  await assert.rejects(exportToNotion({ meeting_summary: 's' }, 'user-1'), /share a page/);
  assert.equal(world.calls.length, 0);
});
