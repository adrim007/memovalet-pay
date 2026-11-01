// When a device should be listening for captions. The bug this guards against:
// nothing ever started listening on the call page, so live translation showed
// "Waiting for speech…" for an entire meeting.
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
  vm.runInNewContext(js, { exports: module.exports, module, require });
  return module.exports;
}

const { shouldListen } = load('lib/captions-listening.ts');
const inACall = { joined: true, micEnabled: true, recordingSupported: true };

test('being in a call with your microphone on is enough — no button to find', () => {
  assert.equal(shouldListen(inACall), true);
});

test('a muted microphone is not captioned', () => {
  assert.equal(shouldListen({ ...inACall, micEnabled: false }), false);
});

test('nothing listens before you join, or once the call is over', () => {
  assert.equal(shouldListen({ ...inACall, joined: false }), false);
  assert.equal(shouldListen({ ...inACall, ended: true }), false);
  assert.equal(shouldListen({ ...inACall, left: true }), false);
  assert.equal(shouldListen({ ...inACall, callClosed: true }), false);
});

test('a browser without speech recognition is left alone', () => {
  assert.equal(shouldListen({ ...inACall, recordingSupported: false }), false);
});

test('the demo page and the transcript view stay as they are', () => {
  assert.equal(shouldListen({ ...inACall, previewMode: true }), false);
  // The transcript view has its own "Start the meeting" button to press.
  assert.equal(shouldListen({ ...inACall, embedded: true }), false);
});
