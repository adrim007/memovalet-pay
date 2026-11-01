// Creating a sent task comes first; its priority is deliberately left open for
// the sender to choose from the saved task row afterwards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const created = [];
  const sent = [];
  const js = ts.transpileModule(fs.readFileSync('app/api/task-assignments/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, Response, Request, URL,
    console: { error() {} },
    require: (name) => ({
      '@/lib/plan-access': { featureError: async () => null },
      'next/server': { NextResponse: Response },
      '@/lib/supabase/server': {
        createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'sender@example.com' } } }) } }),
      },
      '@/lib/database': {
        listMyTaskAssignments: async () => [],
        createTaskAssignment: async (input) => {
          created.push(input);
          return { id: 'task-1', priority: input.priority, ...input };
        },
      },
      '@/lib/email/send': {
        sendAppEmail: async (input) => { sent.push(input); return { sent: true, via: 'resend' }; },
      },
      '@/lib/money': { formatMoney: (amount) => `$${(amount / 100).toFixed(2)}` },
    })[name],
  });
  return { POST: module.exports.POST, created, sent };
}

const request = (priority) => new Request('https://memovalet.com/api/task-assignments', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ recipientEmail: 'recipient@example.com', title: 'Send the quote', priority }),
});

test('a sent task is saved without choosing a priority first', async () => {
  const app = load();
  const response = await app.POST(request(undefined));
  assert.equal(response.status, 200);
  assert.equal(app.created[0].priority, undefined);
  assert.equal((await response.json()).assignment.priority, undefined);
  assert.doesNotMatch(app.sent[0].text, /Priority:/);
});

test('a priority sent by an old create form is ignored until it is chosen afterwards', async () => {
  const app = load();
  const response = await app.POST(request('high'));
  assert.equal(response.status, 200);
  assert.equal(app.created[0].priority, undefined);
  assert.doesNotMatch(app.sent[0].text, /Priority:/);
});
