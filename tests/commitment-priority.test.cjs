// Tasks created from Home or the I owe / Waiting on forms are saved first and
// receive a priority from their saved row afterwards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const created = [];
  const js = ts.transpileModule(fs.readFileSync('app/api/commitments/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports,
    module,
    Response,
    Request,
    URL,
    console: { error() {} },
    require: (name) => ({
      'next/server': { NextResponse: Response },
      '@/lib/supabase/server': {
        createClient: async () => ({
          auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
        }),
      },
      '@/lib/database': {
        listCommitments: async () => [],
        createCommitment: async (input) => {
          created.push(input);
          return { id: 'commitment-1', ...input };
        },
      },
    })[name],
  });
  return { POST: module.exports.POST, created };
}

const request = (priority) => new Request('https://memovalet.com/api/commitments', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ description: 'Call Sarah', direction: 'i_owe', priority }),
});

test('a manually created task is saved without choosing a priority first', async () => {
  const app = load();
  const response = await app.POST(request(undefined));
  assert.equal(response.status, 200);
  assert.equal(app.created[0].priority, undefined);
  assert.equal((await response.json()).commitment.priority, undefined);
});

test('a priority from an old create form is ignored until it is chosen afterwards', async () => {
  const app = load();
  const response = await app.POST(request('low'));
  assert.equal(response.status, 200);
  assert.equal(app.created[0].priority, undefined);
});
