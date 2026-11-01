// Video freezing or going black. Both failure modes are silent, so these hold
// the two behaviours that stop them: keep the element playing, and never leave
// a dead track in front of a live one.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, sandbox) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, module, require, ...sandbox });
  return module.exports;
}

class FakeTrack {
  constructor(kind, readyState = 'live') {
    this.kind = kind; this.readyState = readyState; this.listeners = {};
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  emit(type) { (this.listeners[type] || []).forEach(fn => fn()); }
}

class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(track) { this.tracks.push(track); }
}

class FakeVideo {
  constructor() { this.srcObject = null; this.paused = true; this.plays = 0; this.listeners = {}; }
  play() { this.plays += 1; this.paused = false; return Promise.resolve(); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  emit(type) { (this.listeners[type] || []).forEach(fn => fn()); }
}

const fakeDocument = () => {
  const listeners = {};
  return {
    hidden: false,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
    emit(type) { (listeners[type] || []).forEach(fn => fn()); },
  };
};

function setup() {
  const doc = fakeDocument();
  const { attachStream, withTrack } = load('lib/video-attach.ts', { document: doc, MediaStream: FakeStream });
  return { attachStream, withTrack, doc };
}

test('the stream goes on the element and starts playing', () => {
  const { attachStream } = setup();
  const video = new FakeVideo();
  const stream = new FakeStream([new FakeTrack('video')]);

  attachStream(video, stream);
  assert.equal(video.srcObject, stream);
  assert.equal(video.plays, 1);
});

test('an element that stops on its own is started again — a frozen picture', () => {
  const { attachStream } = setup();
  const video = new FakeVideo();
  attachStream(video, new FakeStream([new FakeTrack('video')]));

  video.paused = true;      // a rejected play() leaves it exactly like this
  video.emit('pause');
  assert.equal(video.plays, 2, 'picked up again');
});

test('a deliberate pause is not fought over', () => {
  const { attachStream } = setup();
  const video = new FakeVideo();
  attachStream(video, new FakeStream([new FakeTrack('video')]));

  video.paused = false;     // still playing; the event was spurious
  video.emit('pause');
  assert.equal(video.plays, 1, 'left alone');
});

test('a track that starts arriving again brings the picture back', () => {
  const { attachStream } = setup();
  const video = new FakeVideo();
  const track = new FakeTrack('video');
  attachStream(video, new FakeStream([track]));

  video.paused = true;
  track.emit('unmute');
  assert.equal(video.plays, 2);
});

test('coming back to the tab restarts a frozen call', () => {
  const { attachStream, doc } = setup();
  const video = new FakeVideo();
  attachStream(video, new FakeStream([new FakeTrack('video')]));

  video.paused = true;
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.equal(video.plays, 1, 'nothing to do while hidden');

  doc.hidden = false;
  doc.emit('visibilitychange');
  assert.equal(video.plays, 2);
});

test('releasing stops the watching and lets the element go', () => {
  const { attachStream, doc } = setup();
  const video = new FakeVideo();
  const track = new FakeTrack('video');
  const release = attachStream(video, new FakeStream([track]));

  release();
  assert.equal(video.srcObject, null);
  video.paused = true;
  video.emit('pause');
  track.emit('unmute');
  doc.emit('visibilitychange');
  assert.equal(video.plays, 1, 'no further nudging after release');
});

test('a replaced camera does not leave the dead one in front — the black rectangle', () => {
  const { withTrack } = setup();
  const dead = new FakeTrack('video', 'ended');
  const microphone = new FakeTrack('audio');
  const fresh = new FakeTrack('video');

  const next = withTrack(new FakeStream([dead, microphone]), fresh);

  assert.deepEqual([...next.getVideoTracks()], [fresh], 'only the live camera remains');
  assert.ok(next.getTracks().includes(microphone), 'their microphone is untouched');
  assert.equal(next.getTracks().length, 2);
});

test('a first track needs no existing stream', () => {
  const { withTrack } = setup();
  const track = new FakeTrack('audio');
  const tracks = [...withTrack(undefined, track).getTracks()];
  assert.deepEqual(tracks, [track]);
});
