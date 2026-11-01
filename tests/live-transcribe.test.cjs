// MemoValet's own transcription of a call's microphone: only for people let
// into that call, only while it runs (plus the last words after it ends), and
// never an open relay to the AI service.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(file, sandbox = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transpile(file), { exports: module.exports, module, ...sandbox });
  return module.exports;
}

const window = load('lib/live-transcription.ts');
const wav = load('lib/wav-duration.ts', { DataView, Uint8Array });
const encoder = load('lib/speech-segments.ts', { DataView, Uint8Array, Float32Array, ArrayBuffer });
const ROOM = '11111111-1111-4111-8111-111111111111';

function fixture({ session = { status: 'active' }, claims = { video: { room: ROOM, roomJoin: true } }, text = 'Hello everyone.', heard = 'English', aiError = null, quotaError = false } = {}) {
  const calls = { ai: [], refunds: 0 };
  class AIProviderError extends Error { constructor(provider, category, status = null) { super('AI'); this.provider = provider; this.category = category; this.status = status; } }
  const modules = {
    '@/lib/wav-duration': wav,
    '@/lib/plan-access': { reserveTranscription: async () => {if(quotaError)throw new Error('Monthly allowance used');return 'reservation'}, refundTranscription: async () => {calls.refunds++} },
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: init?.headers }) } },
    'livekit-server-sdk': { TokenVerifier: class { async verify(token) { if (token !== 'good-token') throw new Error('bad'); return claims; } } },
    '@/lib/database': { getLiveSessionPublic: async (id) => (id === ROOM ? session : null) },
    '@/lib/ai/provider': { AIProviderError },
    '@/lib/ai/transcribe': { transcribeSpeech: async (options) => { calls.ai.push(options); if (aiError) throw new AIProviderError('gemini', aiError, 429); return { text, language: heard }; } },
    '@/lib/speechRecognition': {
      SPEECH_LANGUAGE_OPTIONS: [{ code: 'en-US', label: 'English' }, { code: 'si-LK', label: 'Sinhala' }],
      AUTO_LANGUAGE: 'auto',
      languageLabelFor: (value) => (typeof value === 'string' && value.trim() ? value.trim() : null),
    },
    '@/lib/live-transcription': window,
  };
  const module = { exports: {} };
  vm.runInNewContext(transpile('app/api/live/[id]/transcribe/route.ts'), {
    exports: module.exports, module, require: (name) => modules[name], Response, URL, Uint8Array, Number, Date, console: { error() {} },
    process: { env: { LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' } },
  });
  const post = ({ token = 'good-token', origin = 'https://memovalet.com', type = 'audio/wav', bytes = 32044, lang = 'en-US', room = ROOM } = {}) =>
    module.exports.POST(
      new Request(`https://memovalet.com/api/live/${room}/transcribe?lang=${lang}`, {
        method: 'POST',
        headers: { origin, 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: bytes>=44 && bytes<=700000 ? encoder.encodeWav(new Float32Array((bytes-44)/2),16000) : new Uint8Array(bytes),
      }),
      { params: Promise.resolve({ id: room }) }
    );
  return { post, calls };
}

test("someone in the call gets their words back, with their chosen language as the hint", async () => {
  const f = fixture();
  const response = await f.post({ lang: 'si-LK' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'Hello everyone.');
  assert.equal(f.calls.ai.length, 1);
  assert.equal(f.calls.ai[0].languageLabel, 'Sinhala');
  assert.equal(f.calls.ai[0].mimeType, 'audio/wav');
});

test('no pass, a forged pass, or a pass for another call gets nothing transcribed', async () => {
  for (const [f, options] of [
    [fixture(), { token: null }],
    [fixture(), { token: 'forged' }],
    [fixture({ claims: { video: { room: 'another-room', roomJoin: true } } }), {}],
    [fixture({ claims: { video: { room: ROOM, roomJoin: false } } }), {}],
  ]) {
    const response = await f.post(options);
    assert.ok(response.status === 401 || response.status === 403, `status ${response.status}`);
    assert.equal(f.calls.ai.length, 0);
  }
});

test('another website cannot send sound here from a visitor\'s browser', async () => {
  const f = fixture();
  assert.equal((await f.post({ origin: 'https://evil.example' })).status, 403);
  assert.equal(f.calls.ai.length, 0);
});

test('a call that ended a while ago takes no more speech', async () => {
  const f = fixture({ session: { status: 'ended', endedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() } });
  assert.equal((await f.post()).status, 410);
  assert.equal(f.calls.ai.length, 0);
});

test('the last sentence said as the call is ended still makes the transcript', async () => {
  const f = fixture({ session: { status: 'ended', endedAt: new Date(Date.now() - 20 * 1000).toISOString() } });
  assert.equal((await f.post()).status, 200);
});

test('only short WAV pieces: nothing large, nothing else, and a blip is not worth a request', async () => {
  const big = fixture();
  assert.equal((await big.post({ bytes: 2 * 1024 * 1024 })).status, 413);
  const other = fixture();
  assert.equal((await other.post({ type: 'video/webm' })).status, 415);
  const blip = fixture();
  const response = await blip.post({ bytes: 100 });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, '');
  assert.equal(big.calls.ai.length + other.calls.ai.length + blip.calls.ai.length, 0);
});

test('a busy AI service is reported as busy, so the page tries once more', async () => {
  const f = fixture({ aiError: 'provider_rate_limit' });
  assert.equal((await f.post()).status, 429);
});

test('the grace after a call ends is short, and only for calls that really ended', () => {
  const now = Date.parse('2026-09-19T10:00:00Z');
  const endedAgo = (ms) => ({ status: 'ended', endedAt: new Date(now - ms).toISOString() });
  assert.equal(window.takesSpeech({ status: 'active' }, now), true);
  assert.equal(window.takesSpeech(endedAgo(30 * 1000), now), true);
  assert.equal(window.takesSpeech(endedAgo(window.LAST_WORDS_GRACE_MS + 1000), now), false);
  assert.equal(window.takesSpeech({ status: 'ended', endedAt: null }, now), false);
  assert.equal(window.takesSpeech({ status: 'cancelled' }, now), false);
});

test('a call nobody ended stops taking speech once no real meeting could still be going', () => {
  const now = Date.parse('2026-09-19T10:00:00Z');
  const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();
  assert.equal(window.takesSpeech({ status: 'active', createdAt: hoursAgo(1) }, now), true);
  assert.equal(window.takesSpeech({ status: 'active', createdAt: hoursAgo(13) }, now), false);
  // Set up days ahead for a meeting booked for this morning: still fine.
  assert.equal(window.takesSpeech({ status: 'active', createdAt: hoursAgo(72), scheduledStart: hoursAgo(1) }, now), true);
});

test('an abandoned call\'s link gets nothing transcribed', async () => {
  const f = fixture({ session: { status: 'active', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() } });
  assert.equal((await f.post()).status, 410);
  assert.equal(f.calls.ai.length, 0);
});

// What comes back from the AI service.
const { cleanTranscript, transcriptionPrompt } = load('lib/ai/transcribe.ts', {
  require: (name) => (name === './provider' ? { AIProviderError: class {}, categoryFor: () => 'x' } : undefined),
});

test('a stage direction for silence is not a caption', () => {
  for (const said of ['[silence]', '(no speech)', 'Inaudible.', '[Music]', '  ', null, 42]) {
    assert.equal(cleanTranscript(said), '', String(said));
  }
  assert.equal(cleanTranscript('  We ship on   Friday. '), 'We ship on Friday.');
});

test('the words are asked for as said: not translated, not tidied', () => {
  const prompt = transcriptionPrompt('Sinhala');
  assert.match(prompt, /word for word/);
  assert.match(prompt, /Do not translate/);
  assert.match(prompt, /Sinhala/);
});

test('nobody has to say what they speak: the language heard comes back with the words', async () => {
  const f = fixture({ text: 'مرحبا بالجميع', heard: 'Arabic' });
  const response = await f.post({ lang: 'auto' });
  const body = await response.json();
  assert.equal(body.text, 'مرحبا بالجميع');
  assert.equal(body.language, 'Arabic');
  // Asked to detect, so no language is put in the transcriber's head.
  assert.equal(f.calls.ai[0].languageLabel, null);
});

test('a chosen language is still passed on as a hint', async () => {
  const f = fixture();
  await f.post({ lang: 'si-LK' });
  assert.equal(f.calls.ai[0].languageLabel, 'Sinhala');
});

test('a depleted host allowance prevents transcription and failed processing refunds it',async()=>{const limited=fixture({quotaError:true});assert.equal((await limited.post()).status,402);assert.equal(limited.calls.ai.length,0);const failed=fixture({aiError:'provider_rate_limit'});await failed.post();assert.equal(failed.calls.refunds,1);const ok=fixture();await ok.post();assert.equal(ok.calls.refunds,0)});
