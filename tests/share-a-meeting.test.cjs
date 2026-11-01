// Sending a meeting to another MemoValet account. Until now only notes and
// projects could be handed over; a meeting could only be emailed or opened
// through a public link.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, require: (name) => modules[name] ?? require(name),
    Response, Request, URL, console: { error() {} },
  });
  return module.exports;
}

function world({
  user = { id: 'me', email: 'adrian@example.com' },
  meetings = [{ id: 'm1', user_id: 'me', title: 'Kitchen walkthrough' }],
  recipientId = 'them',
} = {}) {
  const calls = { shared: [], notified: [], emails: [] };
  const from = (table) => {
    const filters = {};
    const q = {
      select() { return q; },
      eq(column, value) { filters[column] = value; return q; },
      async single() {
        const rows = table === 'meetings' ? meetings : [];
        const row = rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
      },
    };
    return q;
  };
  return {
    calls,
    modules: {
      'next/server': { NextResponse: Response },
      '@/lib/supabase/server': {
        createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, from }),
      },
      '@/lib/database': {
        findUserIdByEmail: async () => recipientId,
        getProject: async () => null,
        listShareRecipients: async () => [],
        unshareItem: async () => true,
        shareItemWithUser: async (input) => { calls.shared.push(input); return true; },
        createNotification: async (input) => { calls.notified.push(input); return true; },
      },
      '@/lib/email/send': {
        sendAppEmail: async (input) => { calls.emails.push(input); return { sent: true, via: 'resend' }; },
      },
    },
  };
}

const post = (body) =>
  new Request('https://memovalet.com/api/shares', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
const route = (w) => load('app/api/shares/route.ts', w.modules).POST;

test('a meeting can be handed to another account, and lands in their library', async () => {
  const w = world();
  const res = await route(w)(post({ itemType: 'meeting', itemId: 'm1', email: 'dan@example.com' }));

  assert.equal(res.status, 200);
  assert.equal((await res.json()).shared, true);
  assert.deepEqual(JSON.parse(JSON.stringify(w.calls.shared)), [
    { itemType: 'meeting', itemId: 'm1', ownerId: 'me', recipientUserId: 'them' },
  ]);
  // They are told, and the link opens the meeting itself.
  assert.equal(w.calls.notified[0].link, '/history/m1');
  assert.match(w.calls.notified[0].title, /Kitchen walkthrough/);
});

test("someone else's meeting cannot be given away", async () => {
  const w = world({ meetings: [{ id: 'm1', user_id: 'someone-else', title: 'Theirs' }] });
  const res = await route(w)(post({ itemType: 'meeting', itemId: 'm1', email: 'dan@example.com' }));

  assert.equal(res.status, 404);
  assert.equal(w.calls.shared.length, 0);
  assert.equal(w.calls.notified.length, 0);
});

test('a recipient with no account is emailed and told plainly it was not shared', async () => {
  const w = world({ recipientId: null });
  const res = await route(w)(post({ itemType: 'meeting', itemId: 'm1', email: 'stranger@example.com' }));

  const body = await res.json();
  assert.equal(body.shared, false);
  assert.equal(body.reason, 'no_account');
  assert.match(w.calls.emails[0].text, /Kitchen walkthrough/);
  assert.equal(w.calls.shared.length, 0);
});

test('only the three kinds the database allows are accepted', async () => {
  const w = world();
  for (const itemType of ['file', 'task', 'team', 'meetings', '']) {
    const res = await route(w)(post({ itemType, itemId: 'm1', email: 'dan@example.com' }));
    assert.equal(res.status, 400, String(itemType));
  }
  assert.equal(w.calls.shared.length, 0);
});
