// The host muting someone for the whole room. Run against fakes: no LiveKit,
// no database. The point of the tests is who is allowed to do it, and that it
// can only ever silence a microphone — never switch one back on.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const MICROPHONE = 2; // TrackSource.MICROPHONE

function load(file, world) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const req = (name) => world.modules[name] || require(name);
  vm.runInNewContext(js, {
    exports: module.exports, module, require: req, Response, Request, URL,
    console: { error() {}, warn() {} },
    process: { env: { NEXT_PUBLIC_LIVEKIT_URL: 'wss://lk.example', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's', ...world.env } },
  });
  return module.exports;
}

function fakeWorld({ user = { id: 'host' }, host = true, participant, getParticipantThrows = false } = {}) {
  const calls = { muted: [], clientArgs: null };

  class FakeRoomService {
    constructor(url, key, secret, options) { calls.clientArgs = { url, key, secret, options }; }
    async getParticipant(room, identity) {
      if (getParticipantThrows) throw new Error('participant not found');
      calls.lookedUp = { room, identity };
      return participant;
    }
    async mutePublishedTrack(room, identity, sid, muted) {
      calls.muted.push({ room, identity, sid, muted });
    }
  }

  return {
    calls,
    modules: {
      'next/server': { NextResponse: Response },
      'livekit-server-sdk': { RoomServiceClient: FakeRoomService, TrackSource: { MICROPHONE: MICROPHONE } },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
      '@/lib/database': { getLiveSessionForHost: async () => (host ? { id: 'session-1' } : null) },
    },
  };
}

const post = (body, origin = 'https://memovalet.com') =>
  new Request('https://memovalet.com/api/live/session-1/mute', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
const params = { params: Promise.resolve({ id: 'session-1' }) };

const withLiveMic = {
  tracks: [
    { sid: 'TR_cam', source: 1, muted: false },
    { sid: 'TR_mic', source: MICROPHONE, muted: false },
  ],
};

test('the host silences a live microphone for the whole room', async () => {
  const world = fakeWorld({ participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  const res = await POST(post({ identity: 'guest-7' }), params);

  assert.equal(res.status, 200);
  assert.deepEqual(world.calls.muted, [
    { room: 'session-1', identity: 'guest-7', sid: 'TR_mic', muted: true },
  ]);
});

test('it reaches for the microphone, not the camera', async () => {
  const world = fakeWorld({ participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  await POST(post({ identity: 'guest-7' }), params);
  assert.equal(world.calls.muted[0].sid, 'TR_mic', 'their video is left alone');
});

test('muted is always true — this cannot switch a microphone back on', async () => {
  const world = fakeWorld({ participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  // Even asked directly to unmute, the route only ever mutes.
  await POST(post({ identity: 'guest-7', muted: false }), params);
  assert.equal(world.calls.muted[0].muted, true);
});

test('someone who is already muted is a quiet success, not an error', async () => {
  const world = fakeWorld({
    participant: { tracks: [{ sid: 'TR_mic', source: MICROPHONE, muted: true }] },
  });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  const res = await POST(post({ identity: 'guest-7' }), params);

  assert.equal(res.status, 200);
  assert.equal((await res.json()).alreadyMuted, true);
  assert.equal(world.calls.muted.length, 0, 'nothing sent to LiveKit');
});

test('a guest in the meeting cannot mute anyone', async () => {
  const world = fakeWorld({ host: false, participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  const res = await POST(post({ identity: 'the-host' }), params);

  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /Only the host/);
  assert.equal(world.calls.muted.length, 0);
});

test('signed-out requests are refused', async () => {
  const world = fakeWorld({ user: null, participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  assert.equal((await POST(post({ identity: 'guest-7' }), params)).status, 401);
  assert.equal(world.calls.muted.length, 0);
});

test('a request from another website is refused', async () => {
  const world = fakeWorld({ participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  assert.equal((await POST(post({ identity: 'guest-7' }, 'https://evil.example'), params)).status, 403);
  assert.equal(world.calls.muted.length, 0);
});

test('someone who already left says so plainly', async () => {
  const world = fakeWorld({ getParticipantThrows: true });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  const res = await POST(post({ identity: 'gone' }), params);

  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /already left/);
});

test('a missing name is refused before LiveKit is called', async () => {
  const world = fakeWorld({ participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  assert.equal((await POST(post({}), params)).status, 400);
  assert.equal(world.calls.lookedUp, undefined);
});

test('the websocket url is turned into an http one for the admin call', async () => {
  const world = fakeWorld({ participant: withLiveMic });
  const { POST } = load('app/api/live/[id]/mute/route.ts', world);
  await POST(post({ identity: 'guest-7' }), params);
  assert.equal(world.calls.clientArgs.url, 'https://lk.example');
});
