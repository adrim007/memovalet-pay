// No API calls, emails, or live database writes: execute the real route against
// deterministic fakes, including failures between preservation and summarising.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const USER = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const copy = x => x == null ? x : JSON.parse(JSON.stringify(x));
const result = { meeting_summary: 'A valid summary', key_decisions: ['Ship safely'], action_items: [{ task: 'Test recordings' }] };
function fixture(options = {}) {
  const rows = new Map(options.rows || []);
  const calls = { ai: 0, exports: 0, tasks: 0 };
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'read'; }
    select() { return this; }
    eq(key, value) { this.filters.push([key, value]); return this; }
    insert(value) { this.op = 'insert'; this.value = value; return this; }
    update(value) { this.op = 'update'; this.value = value; return this; }
    matches(row) { return this.filters.every(([key, value]) => {
      if (key === 'metadata') return JSON.stringify(row.metadata) === value;
      if (key.startsWith('metadata->>')) return row.metadata?.[key.slice(11)] === value;
      return row[key] === value;
    }); }
    async run() {
      if (this.table === 'action_items') { calls.tasks++; return { error: options.tasksFail ? {} : null }; }
      if (this.table === 'projects') return { data: { id: 'project' } };
      if (this.op === 'insert') {
        if (options.saveFail) return { error: { code: 'FAIL' } };
        if (rows.has(this.value.id)) return { error: { code: '23505' } };
        rows.set(this.value.id, copy(this.value));
        return { data: copy(this.value) };
      }
      const row = [...rows.values()].find(row => this.matches(row));
      if (this.op === 'update' && row) {
        if (options.summarySaveFail && this.value.summary) return { error: {} };
        Object.assign(row, copy(this.value));
      }
      return { data: copy(row) || null };
    }
    single() { return this.run(); }
    maybeSingle() { return this.run(); }
    then(resolve, reject) { return this.run().then(resolve, reject); }
  }
  const supabase = { auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: USER } } }) }, from: table => new Query(table) };
  async function generateAIText() {
    calls.ai++;
    assert.equal(rows.size, 1, 'must persist before contacting AI');
    if (options.aiWait) await options.aiWait;
    if (options.missingKey) throw Object.assign(new Error('AI request failed'), { category: 'provider_or_configuration' });
    if (options.aiFail) throw Object.assign(new Error('AI request failed'), { category: 'provider_billing', status: 400 });
    if (options.truncated) throw Object.assign(new Error('AI request failed'), { category: 'invalid_output' });
    return options.invalidJson ? 'not json' : JSON.stringify(result);
  }
  const modules = {
    'next/server': { NextResponse: Response },
    '@/lib/ai/provider': {
      generateAIText,
      getAIErrorDetails: error => ({ provider: 'test', category: error instanceof SyntaxError ? 'invalid_output' : error.category || 'provider_or_configuration', status: error.status || null }),
    },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/exports': { runExports: async () => { calls.exports++; if (options.exportFail) throw new Error(); return {}; } },
    '@/lib/prompts': { buildTranscriptPrompt: t => t },
    '@/lib/types': { toMeetingResult: m => ({ meeting_summary: m.summary, key_decisions: m.decisions, action_items: m.action_items, metadata: m.metadata }) },
    '@/lib/recording-path': { parseRecordingPath: p => p.startsWith('private-recording:') ? p.slice(18) : null },
    '@/lib/recording-limits': recordingLimits,
  };
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('app/api/process-meeting/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports: module.exports, require: name => modules[name], crypto: { randomUUID }, process: { env: {} }, Response, console });
  async function send(extra = {}) {
    const response = await module.exports.POST(new Request('https://example.test/api/process-meeting', { method: 'POST', body: JSON.stringify({ requestId: ID, transcript: 'A sufficiently long meeting transcript.', ...extra }) }));
    return { status: response.status, body: await response.json() };
  }
  return { send, rows, calls };
}
// The real limits, not a copy, so the server check can't drift from what the
// call page actually produces.
const recordingLimits = (() => {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('lib/recording-limits.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports: module.exports, module });
  return module.exports;
})();
for (const failure of ['aiFail', 'missingKey', 'truncated', 'invalidJson', 'summarySaveFail']) test(failure + ' preserves original work', async () => {
  const f = fixture({ [failure]: true }); const r = await f.send();
  assert.equal(r.status, 200); assert.equal(r.body.meetingId, ID);
  assert.match(r.body.warning, /saved in History/);
  assert.equal(f.rows.get(ID).transcript, 'A sufficiently long meeting transcript.');
  assert.equal(f.rows.get(ID).summary, null); assert.equal(f.calls.exports, 0);
});
test('save failure never calls AI or claims success', async () => {
  const f = fixture({ saveFail: true }); assert.equal((await f.send()).status, 503); assert.equal(f.calls.ai, 0);
});
test('successful retry reuses meeting, tasks and exports', async () => {
  const f = fixture(); assert.equal((await f.send()).body.summaryStatus, 'ready'); await f.send();
  assert.equal(f.rows.size, 1); assert.equal(f.calls.ai, 1); assert.equal(f.calls.tasks, 1); assert.equal(f.calls.exports, 1);
});
test('history retry uses saved transcript and never sends exports', async () => {
  const f = fixture(); await f.send({ saveOnly: true });
  const r = await f.send({ meetingId: ID, transcript: 'malicious replacement' });
  assert.equal(r.body.summaryStatus, 'ready'); assert.equal(f.calls.exports, 0);
  assert.equal(f.rows.get(ID).transcript, 'A sufficiently long meeting transcript.');
});
test('recording-only meeting saves without AI', async () => {
  const f = fixture(); const r = await f.send({ transcript: '', videoUrl: 'private-recording:' + USER + '/' + ID + '.mp4' });
  assert.equal(r.status, 200); assert.equal(f.calls.ai, 0); assert.ok(f.rows.get(ID).video_url);
});
test('anonymous and other owners cannot retry a meeting', async () => {
  assert.equal((await fixture({ anonymous: true }).send()).status, 401);
  const f = fixture({ rows: [[ID, { id: ID, user_id: OTHER }]] });
  assert.equal((await f.send({ meetingId: ID })).status, 404); assert.equal(f.calls.ai, 0);
});
test('foreign recording is rejected before saving', async () => {
  const f = fixture(); assert.equal((await f.send({ videoUrl: 'private-recording:' + OTHER + '/' + ID + '.mp4' })).status, 403); assert.equal(f.rows.size, 0);
});
test('parallel retry cannot acquire processing twice', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const f = fixture({ aiWait: wait }); const first = f.send();
  await new Promise(resolve => setImmediate(resolve));
  const second = await f.send(); assert.match(second.body.warning, /already being generated/);
  release(); await first; assert.equal(f.calls.ai, 1); assert.equal(f.calls.tasks, 1);
});
test('export failure keeps completed meeting', async () => {
  const f = fixture({ exportFail: true }); const r = await f.send(); assert.equal(r.body.summaryStatus, 'ready'); assert.match(r.body.warning, /sharing/);
});

function wakeFixture(request) {
  let effect, warning;
  const listeners = new Map();
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('lib/use-wake-lock.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { exports: module.exports, require: () => ({ useEffect: fn => { effect = fn; }, useState: initial => [initial, v => { warning = v; }] }),
    navigator: { wakeLock: { request } }, document: { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
  });
  module.exports.useWakeLock(true);
  return { cleanup: effect(), warning: () => warning, listeners };
}
test('wake lock resolving after unmount is released', async () => {
  let resolve; let released = 0;
  const f = wakeFixture(() => new Promise(r => { resolve = r; }));
  f.cleanup(); resolve({ release: async () => { released++; } });
  await new Promise(r => setImmediate(r)); assert.equal(released, 1); assert.equal(f.listeners.size, 0);
});
test('denied wake lock produces a readable warning', async () => {
  const f = wakeFixture(async () => { throw new Error('low battery'); });
  await new Promise(r => setImmediate(r)); assert.match(f.warning(), /Keep the screen on/); f.cleanup();
});
test('wake lock pending acquisition is not duplicated', async () => {
  let resolve, calls = 0;
  const f = wakeFixture(() => { calls++; return new Promise(r => { resolve = r; }); });
  f.listeners.get('visibilitychange')(); assert.equal(calls, 1);
  f.cleanup(); resolve({ release: async () => {} }); await new Promise(r => setImmediate(r));
});

test('multiple recording clips survive saving and later summary generation', async () => {
  const urls = [ID, OTHER].map(id => 'private-recording:' + USER + '/' + id + '.mp4');
  const f = fixture();
  assert.equal((await f.send({ videoUrl: urls[0], recordingUrls: urls, saveOnly: true })).status, 200);
  assert.deepEqual(f.rows.get(ID).metadata.recording_urls, urls);
  await f.send({ meetingId: ID });
  assert.deepEqual(f.rows.get(ID).metadata.recording_urls, urls);
});
test('foreign extra recording clip is rejected even when the first clip belongs to the user', async () => {
  const own = 'private-recording:' + USER + '/' + ID + '.mp4';
  const f = fixture();
  assert.equal((await f.send({videoUrl: own, recordingUrls: [own, 'private-recording:' + OTHER + '/' + ID + '.mp4']})).status, 403);
  assert.equal(f.rows.size, 0);
});
test('a long recording saves in every one of its parts, and no more than the call page can make', async () => {
  const { MAX_RECORDING_CLIPS } = recordingLimits;
  const parts = n => Array.from({ length: n }, () => 'private-recording:' + USER + '/' + randomUUID() + '.webm');
  const full = parts(MAX_RECORDING_CLIPS);
  const f = fixture();
  const r = await f.send({ videoUrl: full[0], recordingUrls: full, saveOnly: true });
  assert.equal(r.status, 200);
  assert.equal(f.rows.get(ID).metadata.recording_urls.length, MAX_RECORDING_CLIPS);
  const tooMany = parts(MAX_RECORDING_CLIPS + 1);
  const g = fixture();
  assert.equal((await g.send({ videoUrl: tooMany[0], recordingUrls: tooMany })).status, 400);
  assert.equal(g.rows.size, 0);
});

test('a saved meeting gets its summary without anyone asking for it', async () => {
  // The call page saves first (saveOnly), then asks for the summary by id.
  // Seven of the first eight meetings ever saved had no summary because that
  // second step was left to the person.
  const f = fixture();
  const saved = await f.send({ saveOnly: true });
  assert.equal(saved.status, 200);
  assert.equal(f.calls.ai, 0, 'the save never waits on the AI');
  const summarised = await f.send({ meetingId: ID });
  assert.equal(summarised.body.summaryStatus, 'ready');
  assert.equal(f.calls.ai, 1);
  assert.equal(f.rows.get(ID).summary, 'A valid summary');
  assert.equal(f.calls.exports, 0, 'and asking by id never re-sends exports');
});
