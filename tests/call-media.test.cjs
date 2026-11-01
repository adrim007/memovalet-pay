const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
class Stream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
}
function load(file, requireModule = require) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: requireModule, MediaStream: Stream });
  return module.exports;
}
const { setCallDevice, callDeviceError } = load('lib/call-media.ts');
for (const kind of ['audio', 'video']) {
  test(`${kind} off/on uses published device controls and replaces restarted tracks`, async () => {
    const old = { kind, readyState: 'live' };
    const fresh = { kind, readyState: 'live' };
    const other = { kind: kind === 'audio' ? 'video' : 'audio', readyState: 'live' };
    const calls = [];
    const participant = {
      [kind === 'audio' ? 'setMicrophoneEnabled' : 'setCameraEnabled']: async enabled => {
        calls.push(enabled);
        return { track: { mediaStreamTrack: enabled ? fresh : old } };
      },
    };
    const off = await setCallDevice(participant, new Stream([old, other]), kind, false);
    const on = await setCallDevice(participant, off, kind, true);
    assert.deepEqual(calls, [false, true]);
    assert.equal(on.getTracks().includes(fresh), true);
    assert.equal(on.getTracks().includes(old), false);
    assert.equal(on.getTracks().includes(other), true);
  });
}
test('permission failure propagates without changing the current stream', async () => {
  const stream = new Stream([{ kind: 'audio' }]);
  await assert.rejects(setCallDevice({ setCameraEnabled: async () => { throw new Error('denied'); } }, stream, 'video', true), /denied/);
  assert.equal(stream.getTracks().length, 1);
});
test('missing and ended devices cannot be reported as enabled', async () => {
  for (const publication of [undefined, { track: { mediaStreamTrack: { readyState: 'ended' }, restartTrack: async () => {}, unmute: async () => {} } }]) {
    await assert.rejects(setCallDevice({ setMicrophoneEnabled: async () => publication }, null, 'audio', true), /live track/);
  }
});
for (const kind of ['audio', 'video']) {
  const method = kind === 'audio' ? 'setMicrophoneEnabled' : 'setCameraEnabled';
  test(`${kind} repeatedly recovers ended tracks and preserves the other device`, async () => {
    const other = { kind: kind === 'audio' ? 'video' : 'audio', readyState: 'live' };
    const calls = [];
    const local = {
      mediaStreamTrack: { kind, readyState: 'ended' },
      async restartTrack() { calls.push('restart'); this.mediaStreamTrack = { kind, readyState: 'live' }; },
      async unmute() { calls.push('unmute'); },
    };
    const participant = { [method]: async enabled => {
      if (!enabled) local.mediaStreamTrack.readyState = 'ended';
      return { track: local };
    } };
    let stream = new Stream([local.mediaStreamTrack, other]);
    for (let i = 0; i < 4; i++) {
      stream = await setCallDevice(participant, stream, kind, false);
      assert.equal(calls.length, i * 2, 'turning off never reacquires a device');
      const old = local.mediaStreamTrack;
      stream = await setCallDevice(participant, stream, kind, true);
      assert.equal(stream.getTracks().includes(old), false);
      assert.equal(stream.getTracks().includes(other), true);
      assert.equal(stream.getTracks().includes(local.mediaStreamTrack), true);
      assert.equal(stream.getTracks().length, 2);
    }
    assert.deepEqual(calls, Array(4).fill(['restart', 'unmute']).flat());
  });
  test(`${kind} restart rejection preserves the supplied stream and permits retry`, async () => {
    const old = { kind, readyState: 'ended' };
    let denied = true;
    const local = { mediaStreamTrack: old,
      async restartTrack() { if (denied) throw new Error('denied'); this.mediaStreamTrack = { kind, readyState: 'live' }; },
      async unmute() {},
    };
    const stream = new Stream([old]);
    const participant = { [method]: async () => ({ track: local }) };
    await assert.rejects(setCallDevice(participant, stream, kind, true), /denied/);
    assert.equal(stream.getTracks()[0], old);
    denied = false;
    assert.equal((await setCallDevice(participant, stream, kind, true)).getTracks()[0].readyState, 'live');
  });
  test(`${kind} already live does not restart and a missing publication is rejected`, async () => {
    const live = { kind, readyState: 'live' };
    const local = { mediaStreamTrack: live, restartTrack: () => assert.fail('unnecessary restart') };
    const result = await setCallDevice({ [method]: async () => ({ track: local }) }, null, kind, true);
    assert.equal(result.getTracks()[0], live);
    await assert.rejects(setCallDevice({ [method]: async () => undefined }, null, kind, true), /live track/);
  });
}
test('device errors distinguish permission, missing hardware, and busy capture without leaking raw errors', () => {
  assert.match(callDeviceError({ name: 'NotAllowedError' }, 'camera'), /website settings/);
  assert.match(callDeviceError({ name: 'NotFoundError' }, 'microphone'), /No microphone/);
  assert.match(callDeviceError({ name: 'NotReadableError' }, 'camera'), /Close other apps/);
  assert.doesNotMatch(callDeviceError(new Error('private detail'), 'camera'), /private detail/);
});
const noop = () => null;
const { default: Room } = load('components/LiveMeetingRoom.tsx', id => {
  if (id === 'next/link') return ({ children }) => React.createElement('a', null, children);
  if (id === 'next/image' || id === '@/components/Logo' || id === '@/components/LiveMeetingChat' || id === '@/components/LiveTranslationPanel') return noop;
  if (id === '@phosphor-icons/react') return new Proxy({}, { get: () => noop });
  if (id === '@/lib/speechRecognition') return { SPEECH_LANGUAGE_OPTIONS: [{ code: 'en-US', label: 'English' }] };
  // Static markup runs no effects, so nothing is ever attached here; the real
  // behaviour has its own tests in video-attach.test.cjs.
  if (id === '@/lib/video-attach') return { attachStream: () => () => {} };
  return require(id);
});
function render(participants, deviceBusy = false, extra = {}) {
  return renderToStaticMarkup(React.createElement(Room, {
    title: 'QA call', elapsedLabel: '00:01', participants, participantCount: participants.length,
    captions: [], myLangCode: 'en-US', notes: { discussionPoints: [], nextSteps: [] },
    micEnabled: true, cameraEnabled: true, deviceBusy,
    onLanguageChange: noop, onToggleMic: noop, onToggleCamera: noop,
    onShare: noop, onFinish: noop, onNotesChange: noop,
    ...extra,
  }));
}
// Only the big frame offers "Enlarge"; the small ones offer to swap themselves in.
const bigOne = (html) => html.match(/aria-label="Enlarge video for ([^"]+)"/)?.[1];
const smallOnes = (html) => [...html.matchAll(/aria-label="Show ([^"]+) in the big view"/g)].map(m => m[1]);
test('camera off keeps the stream video element mounted but hidden and muted', () => {
  const html = render([{ id: 'local', name: 'QA', langLabel: 'English', isLocal: true, stream: new Stream(), cameraEnabled: false }]);
  assert.match(html, /<video[^>]*muted=""[^>]*class="[^"]*hidden/);
  assert.match(html, /Camera is off/);
  assert.equal((html.match(/<audio/g) || []).length, 0);
});
test('all remote participants retain independent audio beyond the tiles on screen', () => {
  const participants = Array.from({ length: 12 }, (_, i) => ({
    id: String(i), name: `Person ${i}`, langLabel: 'English', stream: new Stream(), isLocal: i === 0,
  }));
  const html = render(participants);
  // Everyone is heard; only so many faces are drawn, and it says how many more.
  assert.equal((html.match(/<audio/g) || []).length, 11);
  assert.equal((html.match(/<video/g) || []).length, 10, 'the big frame plus nine small tiles');
  assert.equal((html.match(/<video[^>]*muted=""/g) || []).length, 10);
  assert.match(html, /\+2 more/);
});
const room = (...names) =>
  names.map((name, i) => ({
    id: name.toLowerCase(), name, langLabel: 'English', stream: new Stream(), isLocal: i === 0,
  }));

test('whoever is speaking holds the big frame, everyone else a small tile', () => {
  const html = render(room('You', 'Sofia', 'Marco'), false, { activeSpeakerId: 'marco' });
  assert.equal(bigOne(html), 'Marco');
  assert.deepEqual(smallOnes(html).sort(), ['Sofia', 'You']);
});

test('the big frame follows the talking, without anyone clicking', () => {
  const people = room('You', 'Sofia', 'Marco');
  assert.equal(bigOne(render(people, false, { activeSpeakerId: 'sofia' })), 'Sofia');
  assert.equal(bigOne(render(people, false, { activeSpeakerId: 'marco' })), 'Marco');
});

test('with nobody talking yet you watch the other person, not yourself', () => {
  const html = render(room('You', 'Sofia'));
  assert.equal(bigOne(html), 'Sofia');
  assert.deepEqual(smallOnes(html), ['You']);
});

test('the big frame fills the room and the small tiles stay small', () => {
  const html = render(room('You', 'Sofia'), false, { activeSpeakerId: 'sofia' });
  assert.match(html, /class="[^"]*h-full w-full rounded-lg[^"]*"/, 'the big one takes the height');
  assert.match(html, /class="[^"]*aspect-video w-28 shrink-0 rounded-lg sm:w-36[^"]*"/);
  assert.doesNotMatch(html, /max-h-\[55dvh\]/, 'no longer capped to part of the screen');
});

test('you hear everyone until you choose otherwise', () => {
  const html = render(room('You', 'Sofia', 'Marco'));
  assert.doesNotMatch(html, /<audio[^>]*muted/, 'nobody is silenced by default');
});

test('device controls are disabled while a change is pending', () => {
  const html = render([], true);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Mute"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Stop camera"/);
});
test('self-view is mirrored like Teams, while other people are shown naturally', () => {
  const html = render([
    { id: 'remote', name: 'Remote', langLabel: 'English', stream: new Stream() },
    { id: 'local', name: 'You', langLabel: 'English', isLocal: true, stream: new Stream() },
  ]);
  const videos = html.match(/<video[^>]*>/g) || [];

  assert.equal(videos.length, 2);
  assert.equal(videos.filter((tag) => tag.includes('-scale-x-100')).length, 1,
    'only the local self-view is mirrored');
  assert.ok(html.indexOf('aria-label="Meeting conversation"') > html.indexOf('aria-label="Leave"'));
});

test('the rule holds in a call where the only camera is someone else’s', () => {
  const html = render([{ id: 'remote', name: 'Remote', langLabel: 'English', stream: new Stream() }]);
  assert.doesNotMatch(html, /<video[^>]*-scale-x-100/);
});

test('a shared screen takes the stage and puts every face in the strip', () => {
  const people = room('You', 'Marco');
  const html = render(people, false, {
    activeSpeakerId: 'marco',
    screenShare: { stream: new Stream(), name: 'Marco' },
  });

  assert.match(html, /Marco&#x27;s screen/, 'the stage says whose screen it is');
  // Nobody is spotlighted while the screen is up, so both faces are small.
  assert.deepEqual(smallOnes(html).sort(), ['Marco', 'You']);
  assert.equal(bigOne(html), undefined, 'no camera is holding the big frame');
});

test('a shared screen is never flipped and never cropped', () => {
  const html = render(room('You', 'Marco'), false, {
    screenShare: { stream: new Stream(), name: 'Marco' },
  });
  const screen = html.match(/<video[^>]*object-contain[^>]*>/)?.[0];

  assert.ok(screen, 'the screen is fitted whole, not cropped to fill');
  assert.doesNotMatch(screen, /-scale-x-100/, 'text on a shared screen must read the right way round');
});

test('your own shared screen is played back silently, so you do not hear yourself', () => {
  const mine = render(room('You'), false, {
    screenShare: { stream: new Stream(), name: 'You', isMine: true },
  });
  assert.match(mine, /You are sharing your screen/);
  assert.match(mine.match(/<video[^>]*object-contain[^>]*>/)[0], /muted=""/);

  const theirs = render(room('You', 'Marco'), false, {
    screenShare: { stream: new Stream(), name: 'Marco' },
  });
  assert.doesNotMatch(theirs.match(/<video[^>]*object-contain[^>]*>/)[0], /muted=""/,
    'you need to hear what they are playing');
});

test('Leave remains enabled while recording is finalizing and save is busy', () => {
  const html = renderToStaticMarkup(React.createElement(Room, {
    title:'QA', elapsedLabel:'00:02', participants:[], participantCount:1, captions:[], myLangCode:'en-US',
    notes:{discussionPoints:[],nextSteps:[]}, micEnabled:true, cameraEnabled:true,
    recordingBusy:true, saving:true, canFinish:true, onToggleRecording:noop,
    onLanguageChange:noop,onToggleMic:noop,onToggleCamera:noop,onShare:noop,onFinish:noop,onLeave:noop,onNotesChange:noop,
  }));
  const leave = html.match(/<button[^>]*aria-label="Leave"[^>]*>/)?.[0];
  assert.ok(leave); assert.doesNotMatch(leave, /\sdisabled(?:=|\s|>)/);
  assert.match(html, /aria-label="Leave and end meeting options"/);
  assert.match(html, /aria-controls="call-end-options"/);
  assert.match(html, /aria-label="Expand meeting"/);
});
test('guests have Leave but no end-for-everyone control', () => {
  const html=renderToStaticMarkup(React.createElement(Room, {
    title:'QA',elapsedLabel:'00:02',participants:[],participantCount:1,captions:[],myLangCode:'en-US',
    notes:{discussionPoints:[],nextSteps:[]},micEnabled:true,cameraEnabled:true,canFinish:false,
    onLanguageChange:noop,onToggleMic:noop,onToggleCamera:noop,onShare:noop,onFinish:noop,onLeave:noop,onNotesChange:noop,
  }));
  assert.match(html,/aria-label="Leave"/); assert.doesNotMatch(html,/aria-label="Leave and end meeting options"/);
});

// Red means recording. The call header used to be red whether or not anything
// was being captured, and whole meetings went by with nobody recording them.
test('the header says plainly when nothing is being recorded, and offers the host a Record button', () => {
  const html = render(room('You', 'Sofia'), false, { onToggleRecording: noop, recording: false });
  const status = html.match(/<div role="status"[^>]*>[\s\S]*?<\/div>/)[0];

  assert.match(status, /Not recording/);
  assert.doesNotMatch(status.match(/class="[^"]*"/)[0], /red/, 'not recording must not be drawn in the recording colour');
  assert.match(status, /<button[^>]*>[\s\S]*Record<\/button>/, 'the host can start it from right there');
});

test('a recording in progress is red and says so', () => {
  const html = render(room('You', 'Sofia'), false, { onToggleRecording: noop, recording: true, localRecording: true });
  const status = html.match(/<div role="status"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.match(status, /Recording/);
  assert.match(status, /red/);
  assert.doesNotMatch(status, /Not recording/);
});

test('a guest sees whether they are being recorded, without a button they cannot use', () => {
  const html = render(room('You', 'Sofia'), false, { recording: false });
  const status = html.match(/<div role="status"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.match(status, /Not recording/);
  assert.doesNotMatch(status, /<button/);
});
