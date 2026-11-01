const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: module.exports, module, AbortController, setTimeout, clearTimeout, ...globals });
  return module.exports;
}
const { LatestRequests } = load('lib/latest-requests.ts');
const { readSpeechResult, SPEECH_LANGUAGE_OPTIONS } = load('lib/speechRecognition.ts');
test('new interim cancels old request and rejects late results', () => {
  const requests = new LatestRequests();
  const old = requests.begin('speaker-a');
  const next = requests.begin('speaker-a');
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  old.finish();
  assert.equal(next.isCurrent(), true);
  next.finish();
});
test('clearing a finished phrase prevents interim translation reappearing', () => {
  const requests = new LatestRequests();
  const interim = requests.begin('interim:a');
  requests.cancel('interim:a');
  assert.equal(interim.isCurrent(), false);
  assert.equal(interim.signal.aborted, true);
});
test('language change or leaving invalidates all pending requests', () => {
  const requests = new LatestRequests();
  const jobs = ['final:a', 'interim:a', 'interim:b'].map(key => requests.begin(key));
  requests.cancelAll();
  for (const job of jobs) {
    assert.equal(job.isCurrent(), false);
    assert.equal(job.signal.aborted, true);
  }
});
test('different speakers do not cancel each other', () => {
  const requests = new LatestRequests();
  const a = requests.begin('a');
  const b = requests.begin('b');
  requests.cancel('a');
  assert.equal(b.isCurrent(), true);
  assert.equal(b.signal.aborted, false);
  a.finish(); b.finish();
});
test('timeout aborts fetch while allowing current failure reporting', () => {
  let expire;
  const { LatestRequests: TimedRequests } = load('lib/latest-requests.ts', {
    setTimeout: callback => { expire = callback; return 1; }, clearTimeout() {},
  });
  const job = new TimedRequests().begin('a');
  expire();
  assert.equal(job.signal.aborted, true);
  assert.equal(job.isCurrent(), true);
  job.finish();
  assert.equal(job.isCurrent(), false);
});
test('mixed recognition result preserves final and unfinished phrases', () => {
  const result = readSpeechResult({ resultIndex: 0, results: [
    { isFinal: true, 0: { transcript: 'Finish the plan.' } },
    { isFinal: false, 0: { transcript: 'Then send' } },
    { isFinal: false, 0: { transcript: 'the notes' } },
  ] });
  assert.equal(result.finalText, 'Finish the plan.');
  assert.equal(result.interimText, 'Then send the notes');
});
test('recognition skips previously processed results', () => {
  const result = readSpeechResult({ resultIndex: 1, results: [
    { isFinal: true, 0: { transcript: 'Already captured' } },
    { isFinal: true, 0: { transcript: 'New words' } },
  ] });
  assert.equal(result.finalText, 'New words');
});
test('multilingual text and 21 distinct language selections remain intact', () => {
  const text = 'العربية 日本語 தமிழ் සිංහල 中文';
  const result = readSpeechResult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
  assert.equal(result.finalText, text);
  assert.equal(SPEECH_LANGUAGE_OPTIONS.length, 21);
  assert.equal(new Set(SPEECH_LANGUAGE_OPTIONS.map(option => option.code)).size, 21);
});
