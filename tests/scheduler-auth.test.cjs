// How scheduled jobs prove who they are — run against fakes, no database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/scheduler-auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: m, exports: m.exports, require });
const { carriesSecret, fromScheduler } = m.exports;
const call = (headers = {}, url = 'https://memovalet.com/api/job') => new Request(url, { headers });

test('only the exact secret in the Authorization header is accepted', () => {
  assert.equal(carriesSecret(call({ authorization: 'Bearer cron-secret' }), 'cron-secret'), true);
  assert.equal(carriesSecret(call({ authorization: 'Bearer cron-secreT' }), 'cron-secret'), false);
  assert.equal(carriesSecret(call({ authorization: 'Bearer cron' }), 'cron-secret'), false);
  assert.equal(carriesSecret(call({ authorization: 'cron-secret' }), 'cron-secret'), false);
  assert.equal(carriesSecret(call({}, 'https://memovalet.com/api/job?secret=cron-secret'), 'cron-secret'), false);
});
test('a missing secret on the server rejects everything, including an empty token', () => {
  assert.equal(carriesSecret(call({ authorization: 'Bearer anything' }), undefined), false);
  assert.equal(carriesSecret(call({ authorization: 'Bearer ' }), ''), false);
});
test('a signed database token is checked by the database, never accepted by shape', async () => {
  const asked = [];
  const db = answer => ({ rpc: async (name, args) => { asked.push([name, args.p_token]); return answer; } });
  const token = '1791010000.' + 'a'.repeat(64);
  assert.equal(await fromScheduler(call({ authorization: `Bearer ${token}` }), 'cron-secret', db({ data: true, error: null })), true);
  assert.equal(await fromScheduler(call({ authorization: `Bearer ${token}` }), 'cron-secret', db({ data: false, error: null })), false);
  assert.equal(await fromScheduler(call({ authorization: `Bearer ${token}` }), 'cron-secret', db({ data: true, error: { message: 'down' } })), false);
  assert.equal(await fromScheduler(call({ authorization: 'Bearer not-a-token' }), 'cron-secret', db({ data: true, error: null })), false);
  assert.equal(asked.length, 3);
  assert.equal(await fromScheduler(call({ authorization: 'Bearer cron-secret' }), 'cron-secret', db({ data: false, error: null })), true);
  assert.equal(asked.length, 3, 'the secret needs no database call');
});
