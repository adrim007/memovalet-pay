// The emoji offered in a meeting's chat, and finding one by typing.
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
  // "@/..." is the app's own alias; resolve it the way the bundler would.
  const req = (name) => (name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name));
  vm.runInNewContext(js, { exports: module.exports, module, require: req });
  return module.exports;
}

const { EMOJI_GROUPS, ALL_EMOJI, searchEmoji } = load('lib/chat-emoji.ts');

test('there are plenty, in named groups — not one unlabelled row of twelve', () => {
  assert.ok(ALL_EMOJI.length >= 60, `only ${ALL_EMOJI.length}`);
  assert.ok(EMOJI_GROUPS.length >= 4);
  for (const group of EMOJI_GROUPS) {
    assert.ok(group.name.length > 0);
    assert.ok(group.emoji.length > 0, `${group.name} is empty`);
  }
});

test('no emoji appears twice', () => {
  const chars = ALL_EMOJI.map((item) => item.char);
  assert.equal(new Set(chars).size, chars.length);
});

test('every emoji carries words to search and to read aloud', () => {
  for (const item of ALL_EMOJI) {
    assert.ok(item.name.trim().length > 0, item.char);
    assert.equal(item.name, item.name.toLowerCase(), `${item.char} must be searchable lowercase`);
  }
});

test('typing what you mean finds it', () => {
  const found = (query) => searchEmoji(query).flatMap((group) => group.emoji).map((item) => item.char);

  assert.ok(found('thumbs').includes('\u{1F44D}'));
  assert.ok(found('yes').includes('\u{1F44D}'));
  assert.ok(found('thank').includes('\u{1F64F}'));
  assert.ok(found('deadline').includes('⏰'));
  assert.ok(found('broken').includes('\u{1F41B}'), 'a bug is what people call broken');
  // The words people actually type, not the exact label. The picker's own
  // placeholder suggests "thanks", so that one had better work.
  assert.ok(found('thanks').includes('\u{1F64F}'), 'thanks must find thank');
  assert.ok(found('agreed').includes('\u{1F91D}'), 'agreed must find agree');
  assert.ok(found('cele').includes('\u{1F389}'), 'a half-typed word still finds it');
});

test('several words narrow it rather than widening it', () => {
  const one = searchEmoji('heart').flatMap((group) => group.emoji).length;
  const two = searchEmoji('heart broken').flatMap((group) => group.emoji).length;
  assert.ok(two < one && two > 0, `${two} should be fewer than ${one} but not none`);
});

test('an empty search shows everything, and a hopeless one shows nothing', () => {
  assert.equal(searchEmoji('').flatMap((g) => g.emoji).length, ALL_EMOJI.length);
  assert.equal(searchEmoji('   ').flatMap((g) => g.emoji).length, ALL_EMOJI.length);
  assert.equal(searchEmoji('xyzzy').length, 0);
});

test('empty groups are dropped from a search, so no bare headings appear', () => {
  for (const group of searchEmoji('thumbs')) {
    assert.ok(group.emoji.length > 0, `${group.name} came back empty`);
  }
});
