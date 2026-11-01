const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, Blob, setTimeout, clearTimeout });
  return module.exports;
}
const { manageRecorder } = load('lib/recorder-lifecycle.ts');
const { beginCallExit } = load('lib/call-exit.ts');
const { withCallTimeout } = load('lib/call-timeout.ts');
class Recorder extends EventTarget {
  state = 'recording'; calls = 0;
  stop() { this.calls++; this.state = 'inactive'; }
  data(text) { const event = new Event('dataavailable'); event.data = new Blob([text]); this.dispatchEvent(event); }
}
function setup() {
  const recorder = new Recorder(); let cleaned = 0;
  const manager = manageRecorder(recorder, () => cleaned++, () => {}, 'video/mp4', 15);
  return { recorder, manager, cleaned: () => cleaned };
}
test('stop includes final data and repeated clicks share one finalization', async () => {
  const f = setup(); f.recorder.data('first');
  const a = f.manager.stop(); const b = f.manager.stop(); assert.equal(a, b);
  f.recorder.data('last'); f.recorder.dispatchEvent(new Event('stop'));
  const result = await a; assert.equal(await result.blob.text(), 'firstlast');
  assert.equal(result.warning, undefined); assert.equal(f.cleaned(), 1); assert.equal(f.recorder.calls, 1);
});
test('missing Safari stop event returns a labelled partial backup instead of hanging', async () => {
  const f = setup(); f.recorder.data('partial');
  const result = await f.manager.stop();
  assert.match(result.warning, /partial backup/); assert.equal(await result.blob.text(), 'partial');
  f.recorder.data('late'); f.recorder.dispatchEvent(new Event('stop'));
  assert.equal(await result.blob.text(), 'partial'); assert.equal(f.cleaned(), 1);
});
test('no data becomes a bounded failure and releases resources', async () => {
  const f = setup(); await assert.rejects(f.manager.stop(), /no recording data/); assert.equal(f.cleaned(), 1);
});
test('recorder error while still recording stops and preserves captured data', async () => {
  const f = setup(); f.recorder.data('before error'); f.recorder.dispatchEvent(new Event('error'));
  const result = await f.manager.finished; assert.match(result.warning, /partial/); assert.equal(f.recorder.calls, 1);
});
test('unexpected native stop settles without a user pressing Stop', async () => {
  const f = setup(); f.recorder.data('automatic'); f.recorder.state = 'inactive'; f.recorder.dispatchEvent(new Event('stop'));
  const result = await f.manager.stop(); assert.equal(await result.blob.text(), 'automatic'); assert.equal(f.recorder.calls, 0);
});
test('dispose releases capture immediately even when the browser never stops', async () => {
  const f = setup(); f.recorder.data('backup'); f.manager.dispose(); assert.equal(f.cleaned(), 1);
  assert.match((await f.manager.finished).warning, /partial/);
});
test('Leaving disconnects immediately while recorder and room closure are unresolved', async () => {
  let stopResolve, closeResolve; const events = [];
  const result = beginCallExit(() => { events.push('stop'); return new Promise(r => stopResolve = r); },
    () => events.push('disconnect'), () => { events.push('close'); return new Promise(r => closeResolve = r); });
  assert.deepEqual(events, ['stop', 'disconnect']); await Promise.resolve();
  assert.deepEqual(events, ['stop', 'disconnect', 'close']); closeResolve(); stopResolve();
  assert.equal(await result.recording, null); assert.equal(await result.closing, null);
});
test('recording rejection never prevents disconnect or room closure', async () => {
  let disconnected = false, closed = false;
  const result = beginCallExit(() => { throw new Error('recorder failed'); }, () => disconnected = true,
    async () => { closed = true; throw new Error('network failed'); });
  assert.equal(disconnected, true); assert.match((await result.recording).message, /recorder/);
  assert.match((await result.closing).message, /network/); assert.equal(closed, true);
});
test('upload/startup waits time out and late rejections remain handled', async () => {
  let reject; const pending = new Promise((_, no) => reject = no);
  await assert.rejects(withCallTimeout(pending, 5, 'timed out'), /timed out/);
  reject(new Error('late failure'));
});

// Ending a call while still recording. The call page keeps finished clips in a
// list that it fills from `finished.then(...)`, registered when recording
// starts; the uploader reads that list after awaiting `stop()`. That only works
// because stop() hands back the same promise, so the earlier-registered
// callback always runs first. If stop() ever returned its own promise, or the
// list were filled later, the recording would be thrown away — silently, with
// the meeting saved as though there had never been one.
test('ending a call mid-recording keeps the recording for the upload that follows', async () => {
  const f = setup();
  const clips = [];
  void f.manager.finished.then((result) => clips.push(result.blob)); // as when recording starts
  f.recorder.data('the whole meeting');

  const stopping = f.manager.stop();                                 // as when the call ends
  assert.equal(stopping, f.manager.finished, 'stop must hand back the same promise');
  f.recorder.dispatchEvent(new Event('stop'));
  await stopping;

  assert.equal(clips.length, 1, 'the clip is listed by the time the upload looks');
  assert.equal(await clips[0].text(), 'the whole meeting');
});
