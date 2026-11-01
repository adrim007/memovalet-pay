// Marking what matters. The rules worth holding: only the owner can mark a
// thing, only the three known levels are stored, and clearing works.
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

function load(file, world) {
  const cache = {};
  const loadOne = (f) => {
    if (cache[f]) return cache[f].exports;
    const js = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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
      exports: module.exports, module, require: req, Response, Request, URL,
      console: { error() {} }, process: { env: {} },
    });
    return module.exports;
  };
  return loadOne(file);
}

// Rows keyed by table; update only touches rows matching every filter, the way
// the real client does.
function fakeWorld({ user = { id: 'me' }, rows = {} } = {}) {
  const db = JSON.parse(JSON.stringify(rows));
  const log = [];

  const from = (table) => {
    const filters = {};
    let patch = null;
    const q = {
      update(values) { patch = values; return q; },
      eq(column, value) { filters[column] = value; return q; },
      select() { return q; },
      async maybeSingle() {
        const matching = (db[table] || []).filter((row) =>
          Object.entries(filters).every(([key, value]) => row[key] === value));
        log.push({ table, filters: { ...filters }, patch, matched: matching.length });
        matching.forEach((row) => Object.assign(row, patch));
        return { data: matching[0] ? { id: matching[0].id } : null, error: null };
      },
    };
    return q;
  };

  const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from };
  return {
    db, log,
    modules: {
      'next/server': { NextResponse: Response },
      '@/lib/supabase/server': { createClient: async () => supabase },
    },
  };
}

const post = (body, origin = 'https://memovalet.com') =>
  new Request('https://memovalet.com/api/items/priority', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

const route = (world) => load('app/api/items/priority/route.ts', world).POST;

test('marking your own note high stores exactly that', async () => {
  const world = fakeWorld({ rows: { notes: [{ id: 'n1', user_id: 'me', priority: null }] } });
  const res = await route(world)(post({ kind: 'note', id: 'n1', priority: 'high' }));

  assert.equal(res.status, 200);
  assert.equal((await res.json()).priority, 'high');
  assert.equal(world.db.notes[0].priority, 'high');
});

test('a project is owned by a different column, and still only by you', async () => {
  const world = fakeWorld({
    rows: { projects: [{ id: 'p1', created_by: 'me' }, { id: 'p2', created_by: 'someone-else' }] },
  });
  const mark = route(world);

  assert.equal((await mark(post({ kind: 'project', id: 'p1', priority: 'medium' }))).status, 200);
  assert.equal((await mark(post({ kind: 'project', id: 'p2', priority: 'medium' }))).status, 404);
  assert.equal(world.db.projects[1].priority, undefined, "their project is untouched");
});

test('every task type can be prioritised after it is created', async () => {
  const world = fakeWorld({
    rows: {
      action_items: [{ id: 'a1', user_id: 'me', priority: null }],
      commitments: [{ id: 'c1', user_id: 'me', priority: null }],
      task_assignments: [{ id: 's1', created_by: 'me', priority: null }],
    },
  });
  const mark = route(world);

  assert.equal((await mark(post({ kind: 'task', id: 'a1', priority: 'high' }))).status, 200);
  assert.equal((await mark(post({ kind: 'commitment', id: 'c1', priority: 'medium' }))).status, 200);
  assert.equal((await mark(post({ kind: 'sent-task', id: 's1', priority: 'low' }))).status, 200);
  assert.equal(world.db.action_items[0].priority, 'high');
  assert.equal(world.db.commitments[0].priority, 'medium');
  assert.equal(world.db.task_assignments[0].priority, 'low');
  assert.deepEqual(
    world.log.map(({ table, filters }) => ({ table, filters })),
    [
      { table: 'action_items', filters: { id: 'a1', user_id: 'me' } },
      { table: 'commitments', filters: { id: 'c1', user_id: 'me' } },
      { table: 'task_assignments', filters: { id: 's1', created_by: 'me' } },
    ]
  );
});

test("someone else's meeting cannot be marked", async () => {
  const world = fakeWorld({ rows: { meetings: [{ id: 'm1', user_id: 'someone-else' }] } });
  const res = await route(world)(post({ kind: 'meeting', id: 'm1', priority: 'high' }));

  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /Only the owner/);
  assert.equal(world.db.meetings[0].priority, undefined);
});

test('clearing a mark is a normal thing to do', async () => {
  const world = fakeWorld({ rows: { documents: [{ id: 'd1', user_id: 'me', priority: 'high' }] } });
  const res = await route(world)(post({ kind: 'file', id: 'd1', priority: null }));

  assert.equal(res.status, 200);
  assert.equal(world.db.documents[0].priority, null);
});

test('a level the app cannot show is stored as no level, never as itself', async () => {
  const world = fakeWorld({ rows: { notes: [{ id: 'n1', user_id: 'me', priority: 'high' }] } });
  for (const bogus of ['urgent', 'HIGH', 7, {}, 'critical']) {
    await route(world)(post({ kind: 'note', id: 'n1', priority: bogus }));
    assert.equal(world.db.notes[0].priority, null, `${JSON.stringify(bogus)} cleared rather than stored`);
    world.db.notes[0].priority = 'high';
  }
});

test('kinds without a priority are refused', async () => {
  const world = fakeWorld({ rows: { notes: [{ id: 'n1', user_id: 'me' }] } });
  const mark = route(world);
  for (const kind of ['team', 'person', 'reminder', 'notes', '']) {
    assert.equal((await mark(post({ kind, id: 'n1', priority: 'high' }))).status, 400, kind);
  }
  assert.equal(world.log.length, 0, 'nothing reached the database');
});

test('signed-out and cross-site requests are refused', async () => {
  const signedOut = fakeWorld({ user: null, rows: { notes: [{ id: 'n1', user_id: 'me' }] } });
  assert.equal((await route(signedOut)(post({ kind: 'note', id: 'n1', priority: 'high' }))).status, 401);

  const elsewhere = fakeWorld({ rows: { notes: [{ id: 'n1', user_id: 'me' }] } });
  assert.equal(
    (await route(elsewhere)(post({ kind: 'note', id: 'n1', priority: 'high' }, 'https://evil.example'))).status,
    403
  );
  assert.equal(signedOut.log.length + elsewhere.log.length, 0);
});
