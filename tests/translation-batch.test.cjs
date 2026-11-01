// Translation switched on part-way through a meeting covers the whole meeting,
// not just the last few lines — in batches, so an hour of talk is a few dozen
// requests rather than hundreds that would trip the AI service's rate limit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, required = {}) {
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: loaded.exports, module: loaded, require: (name) => required[name] });
  return loaded.exports;
}
const guide = load('lib/register-guide.ts');
const register = load('lib/register.ts', { './register-guide': guide });
const style = load('lib/translation-style.ts');
const prompt = load('lib/translation-prompt.ts', { './translation-style': style, './register-guide': guide, './register': register });
const batch = load('lib/translation-batch.ts', {
  './translation-style': style, './register-guide': guide, './register': register, './translation-prompt': prompt,
});
const {
  backfillBatches, readBatchLines, buildBatchTranslationPrompt, parseBatchTranslations,
  BATCH_LINES, MAX_BATCH_LINES, MAX_LINE_CHARS,
} = batch;

// Arrays made inside the loaded module belong to another realm; compare contents.
const plain = (value) => JSON.parse(JSON.stringify(value));
const said = (count, length = 40) =>
  Array.from({ length: count }, (_, i) => ({ id: `line-${i}`, text: `${i} ${'word '.repeat(length / 5)}`.trim() }));

test('an hour of talk is covered completely, in a few dozen requests', () => {
  const meeting = said(700);
  const batches = backfillBatches(meeting);
  const covered = batches.flat().map((line) => line.id);
  assert.equal(covered.length, 700, 'every line is translated');
  assert.equal(new Set(covered).size, 700, 'and none twice');
  assert.ok(batches.length <= Math.ceil(700 / BATCH_LINES) + 1, `${batches.length} requests`);
  assert.ok(batches.every((group) => group.length <= BATCH_LINES));
});

test('what is on screen is translated first, and each batch reads in the order it was said', () => {
  const batches = backfillBatches(said(40));
  assert.equal(batches[0].at(-1).id, 'line-39', 'the newest line is in the first batch');
  assert.equal(batches.at(-1)[0].id, 'line-0', 'the first thing said comes last');
  for (const group of batches) {
    const order = Array.from(group, (line) => Number(line.id.split('-')[1]));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), 'in spoken order within a batch');
  }
});

test('a batch stays short enough to come back quickly, and a long speech goes on its own', () => {
  const long = [{ id: 'short-1', text: 'Hello there' }, { id: 'speech', text: 'x'.repeat(150) }, { id: 'short-2', text: 'Right' }];
  const batches = backfillBatches(long, 15, 100);
  assert.ok(batches.some((group) => group.length === 1 && group[0].id === 'speech'));
  assert.equal(batches.flat().length, 3);
  assert.equal(backfillBatches([]).length, 0);
});

test('the server only takes batches it can do well', () => {
  const languages = ['English', 'Arabic'];
  const lines = readBatchLines([{ text: ' hola ', sourceLanguage: 'Arabic', register: 'formal' }, { text: 'hi', sourceLanguage: 'Klingon', register: 'rude' }], languages);
  assert.deepEqual(plain(lines), [
    { text: 'hola', sourceLanguage: 'Arabic', register: 'formal' },
    { text: 'hi', sourceLanguage: null, register: null },
  ]);
  assert.equal(readBatchLines([], languages), null, 'nothing to do');
  assert.equal(readBatchLines('hello', languages), null);
  assert.equal(readBatchLines([{ text: '' }], languages), null, 'an empty line');
  assert.equal(readBatchLines([{ text: 'x'.repeat(MAX_LINE_CHARS + 1) }], languages), null, 'one line too long');
  assert.equal(readBatchLines(Array.from({ length: MAX_BATCH_LINES + 1 }, () => ({ text: 'hi' })), languages), null, 'too many lines');
  assert.equal(readBatchLines(Array.from({ length: 5 }, () => ({ text: 'x'.repeat(2900) })), languages), null, 'too much altogether');
});

test('a batch is asked for with the same care as a single line', () => {
  const text = buildBatchTranslationPrompt({
    targetLanguage: 'French',
    lines: [
      { text: 'could you please send the report', sourceLanguage: 'English', register: 'formal' },
      { text: 'no wahala we go sort am', sourceLanguage: 'Nigerian Pidgin', register: null },
    ],
  });
  assert.match(text, /into French/);
  assert.match(text, /never merge, split, skip or reorder/);
  assert.match(text, /full stop/, 'punctuated like writing');
  assert.match(text, /"n":1/);
  assert.match(text, /"n":2/);
  assert.match(text, /"register":"formal"/, 'the footing travels with the line');
  assert.match(text, /Formal French:/, 'with how French does formal');
  assert.match(text, /Return only JSON/);
});

test('translations come back against the right lines, and a short answer never shifts them', () => {
  assert.deepEqual(plain(parseBatchTranslations('[{"n":1,"t":"Bonjour."},{"n":2,"t":"Merci."}]', 2)), ['Bonjour.', 'Merci.']);
  assert.deepEqual(plain(parseBatchTranslations('```json\n[{"n":2,"t":"Merci."}]\n```', 3)), [null, 'Merci.', null], 'a missing line stays missing');
  assert.deepEqual(plain(parseBatchTranslations('{"translations":[{"n":"1","t":" Salut "}]}', 1)), ['Salut']);
  assert.deepEqual(plain(parseBatchTranslations('["Un.","Deux."]', 2)), ['Un.', 'Deux.'], 'a plain list with one per line');
  assert.deepEqual(plain(parseBatchTranslations('["Un."]', 2)), [null, null], 'a plain list that is short cannot be lined up');
  assert.deepEqual(plain(parseBatchTranslations('[{"n":9,"t":"?"},{"n":1,"t":""}]', 1)), [null], 'out of range or empty');
  assert.deepEqual(plain(parseBatchTranslations('Sorry, I cannot', 2)), [null, null]);
});
