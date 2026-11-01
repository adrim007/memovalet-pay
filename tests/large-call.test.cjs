// A big call: which cameras a browser actually takes in. Fifty video streams
// arriving at once is what breaks a large meeting, and it breaks it in the
// browser long before the server minds.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/large-call.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, Set });
const { camerasToTakeIn, isLargeCall, VIDEO_LIMIT, LARGE_CALL } = loaded.exports;

const people = (n, from = 1) => Array.from({ length: n }, (_, i) => `person-${i + from}`);

test('a small call takes everything, exactly as it always has', () => {
  assert.equal(camerasToTakeIn({ others: people(5), peopleInCall: 6 }), null);
  assert.equal(camerasToTakeIn({ others: people(LARGE_CALL - 1), peopleInCall: LARGE_CALL }), null);
  assert.equal(isLargeCall(6), false);
});

test('a big call takes in only the cameras on screen', () => {
  const wanted = camerasToTakeIn({ others: people(49), peopleInCall: 50 });
  assert.equal(wanted.size, VIDEO_LIMIT, `${wanted.size} cameras at once`);
  assert.ok(wanted.has('person-1'));
  assert.ok(!wanted.has('person-40'), 'the rest are heard, not decoded');
});

test('whoever is speaking is never dropped, wherever they are in the list', () => {
  const wanted = camerasToTakeIn({ others: people(49), activeSpeaker: 'person-44', peopleInCall: 50 });
  assert.ok(wanted.has('person-44'));
  assert.equal(wanted.size, VIDEO_LIMIT);
});

test('a speaker who has already left is not held a place', () => {
  const wanted = camerasToTakeIn({ others: people(20), activeSpeaker: 'someone-who-left', peopleInCall: 21 });
  assert.equal(wanted.size, VIDEO_LIMIT);
  assert.ok(!wanted.has('someone-who-left'));
});

test('fifty people is a big call; a dozen is not', () => {
  assert.equal(isLargeCall(50), true);
  assert.equal(isLargeCall(13), true);
  assert.equal(isLargeCall(12), false);
});
