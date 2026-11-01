// Captions follow the language actually being spoken, without anyone asking.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/language-detection.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded });
const { MIN_SAMPLE_MS, shouldDetectLanguage, languageToSwitchTo } = loaded.exports;

const base = { pinned: false, alreadyDetected: false, voicedMs: 3000, hasToken: true };

test('a decent piece of speech at the start of a call is worth listening to', () => {
  assert.equal(shouldDetectLanguage(base), true);
});

test('a word or two is not enough to tell one language from another', () => {
  assert.equal(shouldDetectLanguage({ ...base, voicedMs: MIN_SAMPLE_MS - 1 }), false);
});

test('it happens once a call, not over and over', () => {
  assert.equal(shouldDetectLanguage({ ...base, alreadyDetected: true }), false);
});

test('someone who set their language by hand is never second-guessed', () => {
  assert.equal(shouldDetectLanguage({ ...base, pinned: true }), false);
  assert.equal(languageToSwitchTo({ detected: 'ar-SA', current: 'en-US', pinned: true }), null);
});

test('nothing is sent without the call pass', () => {
  assert.equal(shouldDetectLanguage({ ...base, hasToken: false }), false);
});

test('captions switch when the language heard is a different one', () => {
  assert.equal(languageToSwitchTo({ detected: 'ar-SA', current: 'en-US', pinned: false }), 'ar-SA');
});

test('no switch when it is already right, or when the language was not recognised', () => {
  assert.equal(languageToSwitchTo({ detected: 'en-US', current: 'en-US', pinned: false }), null);
  assert.equal(languageToSwitchTo({ detected: null, current: 'en-US', pinned: false }), null);
});
