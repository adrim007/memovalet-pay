// The one-retry for Supabase's "JWT issued at future" clock hiccup.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const js = ts.transpileModule(fs.readFileSync('lib/supabase/skew-retry.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, module, setTimeout });
  return module.exports.withClockSkewRetry;
}

function scripted(replies) {
  const calls = [];
  const fn = async (input, init) => {
    calls.push({ input, init });
    const [status, body] = replies[Math.min(calls.length - 1, replies.length - 1)];
    return new Response(body, { status });
  };
  return { fn, calls };
}

const noPause = async () => {};
const SKEW = JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' });

test('a "JWT issued at future" refusal is retried once, and the retry wins', async () => {
  const { fn, calls } = scripted([[401, SKEW], [200, '[{"id":1}]']]);
  const res = await load()(fn, noPause)('https://x.supabase.co/rest/v1/meetings', { method: 'GET' });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
});

test('it retries only once, even if the second attempt is refused too', async () => {
  const { fn, calls } = scripted([[401, SKEW], [401, SKEW]]);
  const res = await load()(fn, noPause)('u', {});
  assert.equal(res.status, 401);
  assert.equal(calls.length, 2);
});

test('any other refusal (a real sign-out, a bad token) is not retried', async () => {
  const { fn, calls } = scripted([[401, JSON.stringify({ code: 'PGRST301', message: 'JWT expired' })]]);
  await load()(fn, noPause)('u', {});
  assert.equal(calls.length, 1);
});

test('successful and other error responses pass straight through, untouched', async () => {
  for (const status of [200, 404, 500]) {
    const { fn, calls } = scripted([[status, SKEW]]);
    const res = await load()(fn, noPause)('u', {});
    assert.equal(res.status, status);
    assert.equal(calls.length, 1);
  }
});

test('the response is still readable by the caller after the check', async () => {
  const { fn } = scripted([[401, JSON.stringify({ code: 'PGRST301' })]]);
  const res = await load()(fn, noPause)('u', {});
  assert.equal((await res.json()).code, 'PGRST301');
});

test('a body that can only be sent once is never resent', async () => {
  const { fn, calls } = scripted([[401, SKEW], [200, 'ok']]);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('x')); c.close(); } });
  const res = await load()(fn, noPause)('u', { method: 'POST', body: stream, duplex: 'half' });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 1);
});
