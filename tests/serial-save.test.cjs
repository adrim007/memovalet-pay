const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/serial-save.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: moduleUnderTest.exports, module: moduleUnderTest });
const { SerialSave } = moduleUnderTest.exports;

test('unchanged notes require no request', async () => {
  let writes = 0;
  const queue = new SerialSave('original', async () => { writes++; });
  await queue.flush();
  assert.equal(writes, 0);
  assert.equal(queue.dirty, false);
});

test('edits during a save are serialized and coalesced to the latest text', async () => {
  const writes = [];
  let release;
  const queue = new SerialSave('', async value => {
    writes.push(value);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
  });
  queue.update('first');
  const pending = queue.flush();
  queue.update('second');
  queue.update('latest');
  assert.equal(queue.flush(), pending);
  release();
  await pending;
  assert.deepEqual(writes, ['first', 'latest']);
  assert.equal(queue.dirty, false);
});

test('a failed request leaves text dirty and supports retry', async () => {
  let fail = true;
  const writes = [];
  const queue = new SerialSave('', async value => {
    if (fail) throw new Error('offline');
    writes.push(value);
  });
  queue.update('العربية 日本語 தமிழ்');
  await assert.rejects(queue.flush(), /offline/);
  assert.equal(queue.dirty, true);
  fail = false;
  await queue.flush();
  assert.deepEqual(writes, ['العربية 日本語 தமிழ்']);
  assert.equal(queue.dirty, false);
});

test('reverting during an in-flight save restores the original on the server', async () => {
  const writes = [];
  let release;
  const queue = new SerialSave('original', async value => {
    writes.push(value);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
  });
  queue.update('changed');
  const pending = queue.flush();
  queue.update('original');
  release();
  await pending;
  assert.deepEqual(writes, ['changed', 'original']);
});
