// Who gets the big tile. The rule matters more than it looks: follow the raw
// "who is making noise" signal and the screen flips on every cough.
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

const { nextActiveSpeaker, NO_SPEAKER, SPEAKER_HOLD_MS } = load('lib/active-speaker.ts');
const me = 'me';

test('the first person to speak takes the big tile straight away', () => {
  const after = nextActiveSpeaker(NO_SPEAKER, ['sofia'], { selfId: me, now: 1000 });
  assert.equal(after.id, 'sofia');
  assert.equal(after.since, 1000);
});

test('the room going quiet leaves the last speaker on screen', () => {
  const sofia = { id: 'sofia', since: 1000 };
  assert.deepEqual(nextActiveSpeaker(sofia, [], { selfId: me, now: 9000 }), sofia);
});

test('you never become your own big tile', () => {
  const sofia = { id: 'sofia', since: 1000 };
  assert.deepEqual(nextActiveSpeaker(sofia, [me], { selfId: me, now: 9000 }), sofia);
  // …and you are skipped over when you talk across someone else.
  const after = nextActiveSpeaker(sofia, [me, 'marco'], { selfId: me, now: 9000 });
  assert.equal(after.id, 'marco');
});

test('a quick interjection does not steal the tile', () => {
  const sofia = { id: 'sofia', since: 1000 };
  const during = nextActiveSpeaker(sofia, ['marco'], { selfId: me, now: 1000 + SPEAKER_HOLD_MS - 1 });
  assert.equal(during.id, 'sofia', 'still Sofia a moment later');

  const after = nextActiveSpeaker(sofia, ['marco'], { selfId: me, now: 1000 + SPEAKER_HOLD_MS });
  assert.equal(after.id, 'marco', 'Marco takes over once she has had her turn');
  assert.equal(after.since, 1000 + SPEAKER_HOLD_MS, 'and now his own turn starts');
});

test('the loudest speaker wins when several talk at once', () => {
  const after = nextActiveSpeaker({ id: 'sofia', since: 0 }, ['marco', 'hana'], { selfId: me, now: 9000 });
  assert.equal(after.id, 'marco');
});

test('the speaker still talking keeps the tile — no pointless re-switching', () => {
  const sofia = { id: 'sofia', since: 1000 };
  const after = nextActiveSpeaker(sofia, ['sofia', 'marco'], { selfId: me, now: 50_000 });
  assert.equal(after, sofia, 'same object, so nothing re-renders');
});

test('a call with no one else never leaves you staring at yourself', () => {
  assert.deepEqual(nextActiveSpeaker(NO_SPEAKER, [me], { selfId: me, now: 1000 }), NO_SPEAKER);
});
