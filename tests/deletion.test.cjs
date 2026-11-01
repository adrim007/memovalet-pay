// Deleting anything in MemoValet — run against fakes: no database, no storage.
// The two things that matter most: you can only delete your own, and nothing is
// left behind in storage or in someone else's shared list.
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
      exports: module.exports, module, require: req, Response, Request, URL, URLSearchParams,
      console: { error() {} }, process: { env: {} }, setTimeout,
    });
    return module.exports;
  };
  return loadOne(file);
}

// Rows keyed by table; every query is filtered the way the real client filters.
function fakeWorld({ user = { id: 'me' }, rows = {}, failures = {} } = {}) {
  const db = JSON.parse(JSON.stringify(rows));
  const log = { deletedRows: [], removedFiles: [] };

  const from = (table) => {
    const filters = {};
    const q = {
      select() { return q; },
      eq(column, value) { filters[column] = value; return q; },
      async maybeSingle() {
        const row = (db[table] || []).find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        return { data: row || null, error: failures.read ? { message: 'read failed' } : null };
      },
      delete() { q._deleting = true; return q; },
      then(resolve) {
        if (failures[table]) return Promise.resolve({error:{message:'delete failed'}}).then(resolve);
        const matching = (db[table] || []).filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        db[table] = (db[table] || []).filter((r) => !matching.includes(r));
        log.deletedRows.push({ table, filters: { ...filters }, count: matching.length });
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return q;
  };

  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    from,
    storage: {
      from: (bucket) => ({
        // Copy the list out of the sandbox realm so assertions compare plain arrays.
        async remove(paths) {
          log.removedFiles.push({ bucket, paths: [...paths] });
          if (failures.storageBlips > 0) { failures.storageBlips--; return { error: { message: 'storage blip' } }; }
          return { error: failures.storage ? { message: 'storage failed' } : null };
        },
      }),
    },
  };

  return {
    db, log, supabase,
    modules: {
      'next/server': { NextResponse: Response },
      '@/lib/supabase/server': { createClient: async () => supabase },
    },
  };
}

const post = (body, origin = 'https://memovalet.com') =>
  new Request('https://memovalet.com/api/items/delete', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

const MY_MEETING = { id: 'm1', user_id: 'me', video_url: 'private-recording:0189d3f0-1c2a-4b3c-8d4e-5f6071829304/0189d3f0-1c2a-4b3c-8d4e-5f6071829304.webm' };
const THEIR_MEETING = { id: 'm2', user_id: 'someone-else', video_url: null };

test('deleting your meeting removes the recording first, then the meeting', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  const res = await POST(post({ kind: 'meeting', id: 'm1' }));

  assert.equal(res.status, 200);
  assert.deepEqual(world.log.removedFiles, [{
    bucket: 'meeting-recordings',
    paths: ['0189d3f0-1c2a-4b3c-8d4e-5f6071829304/0189d3f0-1c2a-4b3c-8d4e-5f6071829304.webm'],
  }]);
  assert.equal(world.db.meetings.length, 0);
});

test('a meeting restarted a few times loses every one of its recordings', async () => {
  const clip = (n) => `private-recording:0189d3f0-1c2a-4b3c-8d4e-5f607182930${n}/0189d3f0-1c2a-4b3c-8d4e-5f607182930${n}.webm`;
  const world = fakeWorld({
    rows: {
      meetings: [{ id: 'm5', user_id: 'me', video_url: clip(1), metadata: { recording_urls: [clip(1), clip(2), clip(3)] } }],
    },
  });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'meeting', id: 'm5' }))).status, 200);

  assert.equal(world.log.removedFiles.length, 1, 'one storage call, not one per clip');
  assert.deepEqual(world.log.removedFiles[0].paths, [
    '0189d3f0-1c2a-4b3c-8d4e-5f6071829301/0189d3f0-1c2a-4b3c-8d4e-5f6071829301.webm',
    '0189d3f0-1c2a-4b3c-8d4e-5f6071829302/0189d3f0-1c2a-4b3c-8d4e-5f6071829302.webm',
    '0189d3f0-1c2a-4b3c-8d4e-5f6071829303/0189d3f0-1c2a-4b3c-8d4e-5f6071829303.webm',
  ], 'the first clip is also video_url, and is not removed twice');
});

test("someone else's meeting is refused, and nothing is touched", async () => {
  const world = fakeWorld({ rows: { meetings: [THEIR_MEETING] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  const res = await POST(post({ kind: 'meeting', id: 'm2' }));

  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /Only the owner/);
  assert.equal(world.db.meetings.length, 1);
  assert.equal(world.log.removedFiles.length, 0);
  assert.equal(world.log.deletedRows.length, 0);
});

test('a meeting with no recording still deletes cleanly', async () => {
  const world = fakeWorld({ rows: { meetings: [{ id: 'm3', user_id: 'me', video_url: null }] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'meeting', id: 'm3' }))).status, 200);
  assert.equal(world.log.removedFiles.length, 0);
  assert.equal(world.db.meetings.length, 0);
});

test('an older public recording link is left alone, not treated as a file path', async () => {
  const world = fakeWorld({ rows: { meetings: [{ id: 'm4', user_id: 'me', video_url: 'https://example.com/old.webm' }] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'meeting', id: 'm4' }))).status, 200);
  assert.equal(world.log.removedFiles.length, 0);
});

test('deleting a file removes the stored file too', async () => {
  const world = fakeWorld({ rows: { documents: [{ id: 'd1', user_id: 'me', file_path: 'me/report.pdf' }] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'file', id: 'd1' }))).status, 200);
  assert.deepEqual(world.log.removedFiles, [{ bucket: 'personal-documents', paths: ['me/report.pdf'] }]);
  assert.equal(world.db.documents.length, 0);
});

test('deleting a note also takes it out of anyone it was shared with', async () => {
  const world = fakeWorld({ rows: { notes: [{ id: 'n1', user_id: 'me' }], shared_items: [{ item_type: 'note', item_id: 'n1', owner_id: 'me' }] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'note', id: 'n1' }))).status, 200);
  assert.equal(world.db.shared_items.length, 0);
  assert.equal(world.db.notes.length, 0);
});

test('deleting a project also takes it out of anyone it was shared with', async () => {
  const world = fakeWorld({
    rows: {
      projects: [{ id: 'p1', created_by: 'me' }],
      shared_items: [{ item_type: 'project', item_id: 'p1', owner_id: 'me' }],
    },
  });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'project', id: 'p1' }))).status, 200);
  assert.equal(world.db.shared_items.length, 0);
  assert.equal(world.db.projects.length, 0);
});

test("a task's photo is removed as well — it is readable by anyone with the link", async () => {
  const world = fakeWorld({
    rows: {
      action_items: [{
        id: 'a1', user_id: 'me',
        photo_url: 'https://exampleproject.supabase.co/storage/v1/object/public/task-photos/me/shot%20one.jpg',
      }],
    },
  });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'task', id: 'a1' }))).status, 200);
  assert.deepEqual(world.log.removedFiles, [{ bucket: 'task-photos', paths: ['me/shot one.jpg'] }]);
  assert.equal(world.db.action_items.length, 0);
});

test('a sent task takes the file the recipient uploaded with it', async () => {
  const world = fakeWorld({
    rows: {
      task_assignments: [{
        id: 't1', created_by: 'me',
        completion_file_url: 'https://exampleproject.supabase.co/storage/v1/object/public/task-photos/assignments/t1/proof.png',
      }],
    },
  });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'sent-task', id: 't1' }))).status, 200);
  assert.deepEqual(world.log.removedFiles, [{ bucket: 'task-photos', paths: ['assignments/t1/proof.png'] }]);
  assert.equal(world.db.task_assignments.length, 0);
});

test('a link pointing outside the photo bucket is never turned into a delete', async () => {
  const world = fakeWorld({
    rows: { action_items: [{ id: 'a2', user_id: 'me', photo_url: 'https://example.com/object/public/other-bucket/x.jpg' }] },
  });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'task', id: 'a2' }))).status, 200);
  assert.equal(world.log.removedFiles.length, 0);
});

// Owner lives in a different column per table; get one wrong and someone could
// delete another person's row, so check each kind against a stranger's row.
const OWNED_BY = {
  meeting: ['meetings', 'user_id'],
  file: ['documents', 'user_id'],
  note: ['notes', 'user_id'],
  project: ['projects', 'created_by'],
  task: ['action_items', 'user_id'],
  'sent-task': ['task_assignments', 'created_by'],
  person: ['people', 'user_id'],
  team: ['teams', 'created_by'],
  commitment: ['commitments', 'user_id'],
  reminder: ['reminders', 'user_id'],
};

for (const [kind, [table, owner]] of Object.entries(OWNED_BY)) {
  test(`a ${kind} you own is deleted, one you don't is refused`, async () => {
    const world = fakeWorld({
      rows: { [table]: [{ id: 'mine', [owner]: 'me' }, { id: 'theirs', [owner]: 'someone-else' }] },
    });
    const { POST } = load('app/api/items/delete/route.ts', world);

    assert.equal((await POST(post({ kind, id: 'mine' }))).status, 200);
    assert.equal((await POST(post({ kind, id: 'theirs' }))).status, 404);
    assert.deepEqual(world.db[table].map((row) => row.id), ['theirs']);
  });
}

test('a request from another website is refused', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  const res = await POST(post({ kind: 'meeting', id: 'm1' }, 'https://evil.example'));
  assert.equal(res.status, 403);
  assert.equal(world.db.meetings.length, 1);
});

test('signed-out requests are refused', async () => {
  const world = fakeWorld({ user: null, rows: { meetings: [MY_MEETING] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({ kind: 'meeting', id: 'm1' }))).status, 401);
  assert.equal(world.db.meetings.length, 1);
});

test('an unknown kind is refused — no guessing which table to delete from', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  for (const body of [{ kind: 'teams', id: 'm1' }, { kind: 'meeting' }, {}]) {
    assert.equal((await POST(post(body))).status, 400);
  }
  assert.equal(world.db.meetings.length, 1);
});


test('storage failure keeps the item visible and a retry can finish deletion', async () => {
  const failures = { storage: true };
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] }, failures });
  const { POST } = load('app/api/items/delete/route.ts', world);
  const failed = await POST(post({kind:'meeting',id:'m1'}));
  assert.equal(failed.status,500);
  assert.match((await failed.json()).error,/could not be completed/);
  assert.equal(world.db.meetings.length,1);
  failures.storage = false;
  assert.equal((await POST(post({kind:'meeting',id:'m1'}))).status,200);
  assert.equal(world.db.meetings.length,0);
});
test('a momentary storage error is retried and the delete still completes', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] }, failures: { storageBlips: 2 } });
  const { POST } = load('app/api/items/delete/route.ts', world);
  assert.equal((await POST(post({kind:'meeting',id:'m1'}))).status, 200);
  assert.equal(world.db.meetings.length, 0);
  assert.equal(world.log.removedFiles.length, 3, 'two blips, then success');
});
test('share cleanup failure prevents storage and record deletion', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] }, failures:{shared_items:true} });
  const { POST } = load('app/api/items/delete/route.ts',world);
  assert.equal((await POST(post({kind:'meeting',id:'m1'}))).status,500);
  assert.equal(world.log.removedFiles.length,0);
  assert.equal(world.db.meetings.length,1);
});
test('database read failure is not presented as a missing item', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] }, failures:{read:true} });
  const { POST } = load('app/api/items/delete/route.ts',world);
  assert.equal((await POST(post({kind:'meeting',id:'m1'}))).status,500);
  assert.equal(world.log.removedFiles.length,0);
});
test('database deletion failure retains the row and returns a retryable error', async () => {
  const world = fakeWorld({ rows: { meetings: [MY_MEETING] }, failures:{meetings:true} });
  const { POST } = load('app/api/items/delete/route.ts',world);
  const response = await POST(post({kind:'meeting',id:'m1'}));
  assert.equal(response.status,500);
  assert.match((await response.json()).error,/attachments.*already/);
  assert.equal(world.db.meetings.length,1);
});
