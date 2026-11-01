// The Library, run against fakes: no database. What matters most: every
// meeting, file and note shows up once, in the right place; nothing can be
// filed into someone else's space; and only an item's owner can move it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module,
    // "@/..." is the app's own alias; resolve it the way the bundler would.
    require: (name) => modules[name] ?? (name.startsWith('@/') ? compile(name.slice(2) + '.ts', {}) : require(name)),
    Response, URL, URLSearchParams, console: { error() {} },
  });
  return module.exports;
}

// Values built inside the vm have their own prototypes; compare contents.
const plain = (value) => JSON.parse(JSON.stringify(value));

// ------------------------------------------------------------ lib/library.ts

const folders = [
  { id: 'space-a', user_id: 'me', name: 'Kitchen', parent_id: null, created_at: '2026-09-01T00:00:00Z' },
  { id: 'space-a-tiles', user_id: 'me', name: 'Tiles', parent_id: 'space-a', created_at: '2026-09-01T00:00:00Z' },
  { id: 'space-b', user_id: 'me', name: 'Hiring', parent_id: null, created_at: '2026-09-01T00:00:00Z' },
];
const meetings = [
  { id: 'm-mine', title: 'Product review', summary: 'Ship onboarding first', created_at: '2026-09-14T09:00:00Z',
    action_items: [{ task: 'Send pricing' }], decisions: ['Launch in March', 'Hire a designer'], video_url: null,
    user_id: 'me', folder_id: 'space-a' },
  { id: 'm-team', title: 'Team standup', summary: null, created_at: '2026-09-13T09:00:00Z',
    action_items: [], decisions: [], video_url: 'recording.webm', user_id: 'someone-else', folder_id: 'their-space' },
];
const documents = [
  { id: 'd1', title: 'Budget.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    folder_id: 'space-a-tiles', created_at: '2026-09-14T10:00:00Z' },
];
const notes = [
  { id: 'n1', title: null, body: '\n  Call Marco about tiles\nsecond line', created_at: '2026-09-12T09:00:00Z',
    user_id: 'me', folder_id: null },
];

function library() {
  const { buildLibrary } = compile('lib/library.ts', {});
  return plain(buildLibrary({ userId: 'me', folders, meetings, documents, notes }));
}

test('every meeting, file and note appears once, newest first', () => {
  const { items } = library();
  assert.deepEqual(items.map((item) => [item.kind, item.id]), [
    ['file', 'd1'], ['meeting', 'm-mine'], ['meeting', 'm-team'], ['note', 'n1'],
  ]);
});

test('each item links to the page that opens it', () => {
  const byId = Object.fromEntries(library().items.map((item) => [item.id, item.href]));
  assert.equal(byId['m-mine'], '/history/m-mine');
  assert.equal(byId.d1, '/documents?document=d1');
  assert.equal(byId.n1, '/notes?note=n1#note-n1');
});

test("only the owner can file or delete a meeting, and a space you can't see reads as unfiled", () => {
  const byId = Object.fromEntries(library().items.map((item) => [item.id, item]));
  assert.equal(byId['m-mine'].isOwner, true);
  assert.equal(byId['m-mine'].folderId, 'space-a');
  assert.equal(byId['m-team'].isOwner, false, 'a team meeting someone else owns');
  assert.equal(byId['m-team'].folderId, null, "their private space isn't shown to you");
});

test('details summarise an item without its transcript', () => {
  const byId = Object.fromEntries(library().items.map((item) => [item.id, item]));
  assert.equal(byId['m-mine'].detail, '2 decisions · 1 task');
  assert.equal(byId['m-mine'].needsFollowUp, true);
  assert.equal(byId['m-team'].detail, 'Recording');
  assert.equal(byId.d1.detail, 'Spreadsheet');
  assert.equal(byId.n1.title, 'Call Marco about tiles', 'an untitled note is named by its first line');
  assert.equal(byId.n1.detail, null);
});

test('a priority set on a row reaches the library, and junk never does', () => {
  const { buildLibrary } = compile('lib/library.ts', {});
  const marked = plain(buildLibrary({
    userId: 'me',
    folders,
    meetings: [{ ...meetings[0], priority: 'high' }, { ...meetings[1], priority: 'urgent' }],
    documents: [{ ...documents[0], priority: 'low' }],
    notes: [{ ...notes[0] }],
  })).items;
  const byId = Object.fromEntries(marked.map((item) => [item.id, item.priority]));

  assert.equal(byId['m-mine'], 'high');
  assert.equal(byId.d1, 'low');
  assert.equal(byId.n1, null, 'unmarked is the normal state');
  assert.equal(byId['m-team'], null, 'a level the app cannot show reads as none');
});

test('a space includes everything in the folders nested inside it', () => {
  const { spaceAndDescendants } = compile('lib/library.ts', {});
  const { spaces } = library();
  const ids = [...spaceAndDescendants('space-a', spaces)].sort();
  assert.deepEqual(ids, ['space-a', 'space-a-tiles']);
});

test("the timeline groups by the viewer's own day", () => {
  const { groupByTimeline } = compile('lib/library.ts', {});
  const now = new Date(2026, 8, 14, 12); // 14 Sep 2026, noon, local time
  const at = (month, day, hour = 9) => ({ createdAt: new Date(2026, month, day, hour).toISOString() });
  const groups = plain(groupByTimeline([at(8, 14), at(8, 13), at(8, 11), at(8, 3), at(7, 20)], now));
  assert.deepEqual(groups.map((group) => group.label), ['Today', 'Yesterday', 'This week', 'Earlier this month', 'August 2026']);
});

test('a space keeps the same colour every time', () => {
  const { spaceColor } = compile('lib/library.ts', {});
  assert.equal(spaceColor('space-a'), spaceColor('space-a'));
  assert.match(spaceColor('space-a'), /^#[0-9a-f]{6}$/);
});

// ------------------------------------------------- /api/library/move route

function moveRoute({ user = { id: 'me' }, ownedFolders = ['space-a'], updatedRow = { id: 'item' } } = {}) {
  const calls = [];
  const from = (table) => {
    const filters = {};
    let update = null;
    const query = {
      select() { return query; },
      update(values) { update = values; return query; },
      eq(key, value) { filters[key] = value; return query; },
      async maybeSingle() {
        calls.push({ table, update: plain(update), filters: { ...filters } });
        if (table === 'folders') {
          const mine = ownedFolders.includes(filters.id) && filters.user_id === user?.id;
          return { data: mine ? { id: filters.id } : null, error: null };
        }
        return { data: updatedRow, error: null };
      },
    };
    return query;
  };
  const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from };
  const route = compile('app/api/library/move/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => supabase },
  });
  const post = async (body, origin = 'https://memovalet.com') => {
    const headers = { 'content-type': 'application/json' };
    if (origin) headers.origin = origin;
    const response = await route.POST(new Request('https://memovalet.com/api/library/move', {
      method: 'POST', headers, body: JSON.stringify(body),
    }));
    return response.status;
  };
  return { post, calls };
}

test('another website cannot move your things', async () => {
  for (const origin of ['https://evil.example', null]) {
    const route = moveRoute();
    assert.equal(await route.post({ kind: 'meeting', id: 'm1', folderId: 'space-a' }, origin), 403, String(origin));
    assert.equal(route.calls.length, 0, String(origin));
  }
});

test('signing in is required', async () => {
  const route = moveRoute({ user: null });
  assert.equal(await route.post({ kind: 'meeting', id: 'm1', folderId: null }), 401);
});

test('an unknown kind of item is refused', async () => {
  for (const kind of ['project', 'constructor', '__proto__', undefined]) {
    const route = moveRoute();
    assert.equal(await route.post({ kind, id: 'x', folderId: null }), 400, String(kind));
    assert.equal(route.calls.length, 0, String(kind));
  }
});

test("you can't file anything into a space that isn't yours", async () => {
  const route = moveRoute({ ownedFolders: ['space-a'] });
  assert.equal(await route.post({ kind: 'meeting', id: 'm1', folderId: 'their-space' }), 404);
  assert.deepEqual(route.calls.map((call) => call.table), ['folders'], 'nothing was updated');
});

test('filing a meeting updates only your own meeting', async () => {
  const route = moveRoute();
  assert.equal(await route.post({ kind: 'meeting', id: 'm1', folderId: 'space-a' }), 200);
  const update = route.calls.at(-1);
  assert.equal(update.table, 'meetings');
  assert.deepEqual(update.update, { folder_id: 'space-a' });
  assert.deepEqual(update.filters, { id: 'm1', user_id: 'me' });
});

test('files and notes go to their own tables, and taking one out clears the link', async () => {
  const file = moveRoute();
  assert.equal(await file.post({ kind: 'file', id: 'd1', folderId: 'space-a' }), 200);
  assert.equal(file.calls.at(-1).table, 'documents');

  const note = moveRoute();
  assert.equal(await note.post({ kind: 'note', id: 'n1', folderId: null }), 200);
  assert.deepEqual(note.calls.map((call) => call.table), ['notes'], 'no space lookup when unfiling');
  assert.deepEqual(note.calls[0].update, { folder_id: null });
});

test("someone else's item is not moved", async () => {
  const route = moveRoute({ updatedRow: null });
  assert.equal(await route.post({ kind: 'meeting', id: 'their-meeting', folderId: 'space-a' }), 404);
});
