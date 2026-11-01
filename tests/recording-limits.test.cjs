// Recording sizes against what storage will actually take. Supabase's Free plan
// rejects any single file over 50 MB; the recorder used to make ~10 MB a minute
// in one file, so any call recorded past five minutes would have failed to
// upload — and taken the whole meeting's save down with it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, sandbox = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, module, require, ...sandbox });
  return module.exports;
}

const limits = load('lib/recording-limits.ts');
const FREE_PLAN_FILE_CAP = 50 * 1024 * 1024;

test('every part stays clear of the storage plan\'s per-file limit', () => {
  assert.ok(limits.MAX_CLIP_BYTES < FREE_PLAN_FILE_CAP, 'a part as big as the cap would be refused');
  assert.ok(FREE_PLAN_FILE_CAP - limits.MAX_CLIP_BYTES >= 4 * 1024 * 1024,
    'leave headroom: a recorder overshoots its target by a chunk before it notices');
});

test('a part holds long enough that a meeting is not chopped into slivers', () => {
  assert.ok(limits.minutesPerClip() >= 8, `only ${limits.minutesPerClip().toFixed(1)} minutes a part`);
});

test('enough parts for a real meeting — two hours at least', () => {
  const minutes = limits.MAX_RECORDING_CLIPS * limits.minutesPerClip();
  assert.ok(minutes >= 120, `only ${Math.round(minutes)} minutes in total`);
});

test('only parts really in storage are saved with the meeting, in recording order', () => {
  const clip = (order, url) => ({ blob: {}, order, url });
  const urls = limits.uploadedClipUrls([
    clip(2, 'private-recording:u/c.webm'),
    clip(0, 'private-recording:u/a.webm'),
    clip(1, undefined),                      // this part failed to upload
    clip(3, ''),
  ]);
  // A blank for the failed part used to be sent, and the server refused the
  // whole meeting with "This recording does not belong to your account".
  assert.deepEqual([...urls], ['private-recording:u/a.webm', 'private-recording:u/c.webm']);
});

test('no recording at all gives an empty list, not a list with a blank in it', () => {
  assert.equal(limits.uploadedClipUrls([]).length, 0);
  assert.equal(limits.uploadedClipUrls([{ blob: {}, order: 0 }]).length, 0);
});

// The roll-over. A part that reaches its size stops itself and asks for the
// next one — that ask is what starts the following part on the call page.
const { manageRecorder } = load('lib/recorder-lifecycle.ts', { Blob, setTimeout, clearTimeout });
class Recorder extends EventTarget {
  state = 'recording'; stops = 0;
  stop() { this.stops++; this.state = 'inactive'; }
  data(bytes) { const e = new Event('dataavailable'); e.data = new Blob(['x'.repeat(bytes)]); this.dispatchEvent(e); }
}

test('a part that reaches its size stops itself once and asks for the next part', async () => {
  const recorder = new Recorder();
  let asks = 0;
  const part = manageRecorder(recorder, () => {}, () => asks++, 'video/webm', 50, 100);
  recorder.data(60);
  assert.equal(asks, 0, 'still room in this part');
  recorder.data(60);                         // now over 100 bytes
  recorder.data(60);                         // more arrives while it winds down
  assert.equal(asks, 1, 'asks for exactly one next part');
  assert.equal(recorder.stops, 1, 'and stops itself exactly once');
  recorder.dispatchEvent(new Event('stop'));
  const { blob } = await part.finished;
  assert.ok(blob.size >= 120, 'what it recorded is kept whole');
});
