// Which lines of live speech get translated for the person reading the panel.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/caption-translation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded });
const { needsTranslation, interimTranslationDue } = loaded.exports;

const rule = (spoken, reading, enabled = true) =>
  needsTranslation({ enabled, spokenLanguage: spoken, readingLanguage: reading });

test('speech in another language is translated', () => {
  assert.equal(rule('English', 'Arabic'), true);
  assert.equal(rule('Sinhala', 'English'), true);
});

test('your own words count too — the panel is set to a language, not to other people', () => {
  // The old rule skipped anything you said yourself, so alone in a call the
  // panel showed English under a heading that said Arabic.
  assert.equal(rule('English', 'Arabic'), true, 'said by anyone, including you');
});

test('nothing is sent anywhere when it is already in the right language', () => {
  assert.equal(rule('Arabic', 'Arabic'), false);
  assert.equal(rule('english', 'English'), false, 'the same language written differently');
  assert.equal(rule(' English ', 'English'), false);
});

test('translation switched off means no translating', () => {
  assert.equal(rule('English', 'Arabic', false), false);
});

test('a missing language label is left alone rather than translated blindly', () => {
  assert.equal(rule('', 'Arabic'), false);
  assert.equal(rule('English', ''), false);
});

test('a sentence in progress is translated often enough to feel live, not on every word', () => {
  const at = (text, lastSentText, lastSentAt, now) =>
    interimTranslationDue({ text, lastSentText, lastSentAt, now });
  // Nothing sent yet: go.
  assert.equal(at('We should', '', 0, 10_000), true);
  // A moment later, barely anything new: wait.
  assert.equal(at('We should ship', 'We should', 10_000, 10_400), false);
  // Enough time, but only a word more: still wait.
  assert.equal(at('We should ship', 'We should', 10_000, 12_000), false);
  // Enough time and a good deal more said: go.
  assert.equal(at('We should ship the pricing page on Friday', 'We should', 10_000, 12_000), true);
  // Recognition changed its mind about the words: the old translation is wrong.
  assert.equal(at('We should skip it', 'We should ship the pricing page', 10_000, 12_000), true);
  // Nothing new at all, or nothing said: never.
  assert.equal(at('We should', 'We should', 10_000, 99_000), false);
  assert.equal(at('   ', '', 0, 99_000), false);
});
