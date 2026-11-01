// Whether a finished call leaves a meeting behind.
//
// The bug this guards against was invisible and total: twelve real calls in a
// row ended with nothing saved, because a meeting needed a transcript or a
// recording and captions were never running. No meeting means no summary, no
// PDF, nothing to email and nothing to send — every one of those looked broken
// when the truth was the meeting never existed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, module, require, Date });
  return module.exports;
}

const { isWorthSaving, nothingSavedReason, secondsSince, MIN_REAL_CALL_SECONDS } =
  load('lib/meeting-worth-saving.ts');

test('anything captured is kept, however short the call', () => {
  assert.equal(isWorthSaving({ hasContent: true, elapsedSeconds: 2 }), true);
});

test('a real call with nothing captured is still kept', () => {
  // Captions unsupported in that browser, recording left off, nobody typing:
  // the meeting still happened, and this is what used to be thrown away.
  assert.equal(isWorthSaving({ hasContent: false, elapsedSeconds: MIN_REAL_CALL_SECONDS }), true);
  assert.equal(isWorthSaving({ hasContent: false, elapsedSeconds: 45 * 60 }), true);
});

test('a room opened and closed again is not a meeting', () => {
  assert.equal(isWorthSaving({ hasContent: false, elapsedSeconds: 0 }), false);
  assert.equal(isWorthSaving({ hasContent: false, elapsedSeconds: MIN_REAL_CALL_SECONDS - 1 }), false);
});

test('someone whose call kept nothing is told which of the two it was', () => {
  assert.match(nothingSavedReason({ elapsedSeconds: 5 }), /too short/);
  assert.match(nothingSavedReason({ elapsedSeconds: 600 }), /no captions, notes or recording/);
});

test('elapsed seconds handle a call that never started', () => {
  assert.equal(secondsSince(null), 0);
  assert.equal(secondsSince(undefined), 0);
  assert.equal(secondsSince(1_000_000, 1_000_000), 0);
  assert.equal(secondsSince(1_000_000, 1_090_000), 90);
  // A clock that jumps backwards must not produce a negative call length.
  assert.equal(secondsSince(1_000_000, 900_000), 0);
});
