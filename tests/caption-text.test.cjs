// Captions that read like writing: a capital at the front, a full stop at the
// end, and the speaker's name said once rather than over every line.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: loaded.exports, module: loaded });
  return loaded.exports;
}
const { tidyCaption } = load('lib/caption-text.ts');
const { speakerRuns } = load('lib/caption-groups.ts');

test('a line from speech recognition is given a capital and a full stop', () => {
  assert.equal(
    tidyCaption('at this time we are issuing a full recall of all saber gh400 printers'),
    'At this time we are issuing a full recall of all saber gh400 printers.'
  );
});

test('punctuation already there is left alone', () => {
  assert.equal(tidyCaption('Are there any questions?'), 'Are there any questions?');
  assert.equal(tidyCaption('Stop!'), 'Stop!');
  assert.equal(tidyCaption('She said "later."'), 'She said "later."');
});

test('not one word is changed — misheard words stay as they were heard', () => {
  const misheard = 'we regret our slower response in our laps in canned or in judgment';
  const tidied = tidyCaption(misheard);
  assert.equal(tidied.toLowerCase().replace(/[.]/g, ''), misheard.toLowerCase());
});

test('scripts that end a sentence their own way get their own mark', () => {
  assert.equal(tidyCaption('今日送ってくれる'), '今日送ってくれる。');
  assert.match(tidyCaption('هل يمكنكم إرساله اليوم؟'), /؟$/);
});

test('a single word is not a sentence', () => {
  assert.equal(tidyCaption('okay'), 'Okay');
  assert.equal(tidyCaption('   '), '');
});

test("the speaker's name is shown once per run, not over every line", () => {
  const lines = [
    { speakerId: 'a' }, { speakerId: 'a' }, { speakerId: 'a' },
    { speakerId: 'b' },
    { speakerId: 'a' },
  ];
  assert.deepEqual([...speakerRuns(lines)], [true, false, false, true, true]);
  assert.deepEqual([...speakerRuns([])], []);
});
