const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function fixture(options = {}) {
  const calls = [];
  const query = { select() {return this;}, eq() {return this;}, maybeSingle: async () => ({ data: options.foreign ? null : { id: 'saved' } }) };
  const modules = {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: options.guest ? null : { id: 'host' } } }) }, from: () => query }) },
    '@/lib/database': {
      getLiveSessionPublic: async () => ({ status: options.ended ? 'ended' : 'active' }),
      getLiveSessionForHost: async () => options.notOwner ? null : { meeting_id: 'previous' },
      endLiveSession: async (id, saved) => { calls.push(['database', id, saved]); return !options.dbFail; },
    },
    'livekit-server-sdk': {
      RoomServiceClient: class { constructor(url, key, secret, settings) { assert.equal(url, 'https://test.livekit.cloud'); assert.equal(settings.requestTimeout, 8); }
        async deleteRoom(id) { calls.push(['disconnect', id]); if (options.transportFail) throw { code: options.transportFail }; }
      },
      AccessToken: class { constructor() { calls.push(['token']); } addGrant() {} async toJwt() { return 'test-token'; } },
    },
  };
  function load(path) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { module, exports: module.exports, require: id => { assert.ok(modules[id], id); return modules[id]; },
        console: { warn() {}, error() {} }, process: { env: { NEXT_PUBLIC_LIVEKIT_URL: 'wss://test.livekit.cloud', LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 'test' } } });
    return module.exports;
  }
  return { calls, close: body => load('app/api/live/[id]/route.ts').PATCH(new Request('https://local/api/live/room', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'room' }) }),
    token: () => load('app/api/live/[id]/livekit-token/route.ts').POST(new Request('https://local/token', { method: 'POST', body: JSON.stringify({ name: 'test', identity: 'test' }) }), { params: Promise.resolve({ id: 'room' }) }) };
}
test('host closes the session and transport, preserving an already-linked recording', async () => {
  const f = fixture(); assert.equal((await f.close({ meetingId: null })).status, 200);
  assert.deepEqual(f.calls, [['database', 'room', 'previous'], ['disconnect', 'room']]);
});
test('guest and non-owner cannot end other participants calls', async () => {
  for (const options of [{guest:true}, {notOwner:true}]) { const f=fixture(options); assert.ok((await f.close({})).status >=400); assert.deepEqual(f.calls, []); }
});
test('foreign saved meeting cannot be attached', async () => {
  const f=fixture({foreign:true}); assert.equal((await f.close({meetingId:'foreign'})).status,404); assert.deepEqual(f.calls,[]);
});
test('failed database closure does not report success or kick participants', async () => {
  const f=fixture({dbFail:true}); assert.equal((await f.close({})).status,500); assert.equal(f.calls.length,1);
});
test('retrying an already removed room succeeds; transport failures remain retryable', async () => {
  assert.equal((await fixture({transportFail:'not_found'}).close({})).status,200);
  assert.equal((await fixture({transportFail:'unavailable'}).close({})).status,503);
});
test('ended session refuses new video tokens', async () => {
  const f=fixture({ended:true}); assert.equal((await f.token()).status,410); assert.deepEqual(f.calls,[]);
});
