// What is kept when something breaks in front of somebody — and, just as
// importantly, what is deliberately not kept.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/error-report.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, URL, Map, Set });
const { reportedError, worthKeeping, placeOf, browserOf, groupedForDigest, MAX_MESSAGE } = loaded.exports;

test('a real fault is kept, with where and which browser', () => {
  const kept = reportedError(
    { message: "Cannot read properties of undefined (reading 'track')", place: '/live/abc', release: 'dpl_123' },
    { userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17 Safari/605' }
  );
  assert.equal(kept.source, 'client');
  assert.match(kept.message, /Cannot read properties/);
  assert.equal(kept.place, '/live/abc');
  assert.equal(kept.browser, 'Safari');
  assert.equal(kept.release, 'dpl_123');
});

test('nothing that says who somebody is goes in', () => {
  // A meeting id in the path is trimmed, and a full URL never becomes a place.
  assert.equal(placeOf('https://memovalet.com/history/3bd58669-b4d8-41d8-838f-e71d9c6be197'), '/history/:id');
  assert.equal(placeOf('https://memovalet.com/ask?q=our+acquisition+plans'), '/ask');
  // A user agent is reduced to one word, never stored whole.
  assert.equal(browserOf('Mozilla/5.0 (Windows NT 10.0) Chrome/124.0 Safari/537'), 'Chrome');
  assert.equal(browserOf('something unfamiliar'), null);
});

test('browser noise that nobody can act on is dropped', () => {
  for (const noise of [
    'ResizeObserver loop completed with undelivered notifications',
    'Script error.',
    'Load failed',
    'The operation was aborted',
  ]) {
    assert.equal(worthKeeping(noise), false, noise);
    assert.equal(reportedError({ message: noise }), null);
  }
  assert.equal(worthKeeping('Failed to start the recording'), true);
});

test('an empty or absurd report is refused rather than stored', () => {
  assert.equal(reportedError(null), null);
  assert.equal(reportedError({ message: '  ' }), null);
  const long = reportedError({ message: 'x'.repeat(5000) });
  assert.equal(long.message.length, MAX_MESSAGE);
});

test('the digest counts the same fault once, with how often and where', () => {
  const at = (h) => `2026-09-28T0${h}:00:00Z`;
  const grouped = groupedForDigest([
    { message: 'Captions died', place: '/live/:id', browser: 'Safari', created_at: at(1) },
    { message: 'Captions died', place: '/live/:id', browser: 'Chrome', created_at: at(3) },
    { message: 'Captions died', place: '/live/:id', browser: 'Safari', created_at: at(2) },
    { message: 'Upload refused', place: '/meeting', browser: 'Chrome', created_at: at(4) },
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].message, 'Captions died');
  assert.equal(grouped[0].count, 3, 'the loudest fault comes first');
  assert.deepEqual([...grouped[0].browsers], ['Chrome', 'Safari']);
  assert.equal(grouped[0].last, at(3), 'the most recent time it happened');
});
