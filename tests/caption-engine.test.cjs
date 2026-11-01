// Which way of writing down speech a call uses, and why.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/caption-engine.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded });
const { captionEngineFor } = loaded.exports;

const call = (over = {}) =>
  captionEngineFor({ browserRecognition: true, browserFailed: false, translationOn: false, canListen: true, ...over });

test('reading captions in the language being spoken: the browser, which is instant', () => {
  assert.equal(call(), 'browser');
});

test('someone is reading in another language: MemoValet writes it down', () => {
  // A translator cannot fill in misheard words the way a person reading their
  // own language can, and the mistake lands where the reader cannot check it.
  assert.equal(call({ translationOn: true }), 'memovalet');
});

test('a browser with no speech recognition of its own, or one that failed', () => {
  assert.equal(call({ browserRecognition: false }), 'memovalet');
  assert.equal(call({ browserFailed: true }), 'memovalet');
});

test('nothing for MemoValet to listen to: the browser is all there is', () => {
  assert.equal(call({ canListen: false, translationOn: true }), 'browser');
  assert.equal(call({ canListen: false, browserFailed: true }), 'browser');
});

test('turning translation off hands captions back to the faster one', () => {
  assert.equal(call({ translationOn: true }), 'memovalet');
  assert.equal(call({ translationOn: false }), 'browser');
  // Unless the browser's own had already failed — then it stays where it works.
  assert.equal(call({ translationOn: false, browserFailed: true }), 'memovalet');
});
