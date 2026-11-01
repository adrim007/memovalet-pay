// MemoValet's own transcription cuts a microphone into pieces of speech. These
// pin down what gets sent: speech, whole, with its first word — and never
// silence, a cough, or a humming fan.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, module, Float32Array, Int16Array, Uint8Array, DataView, Math });
  return module.exports;
}
const { createSpeechSegmenter, encodeWav, frameLevel } = load('lib/speech-segments.ts');

const RATE = 48000;
const FRAME = 4096; // what the browser hands over at a time, about 85 ms
const FRAME_MS = (FRAME / RATE) * 1000;

// A voice-like tone, silence, or steady background noise, as browser frames.
const tone = (amplitude) => (i) => amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE);
// Speech rises and falls with each syllable, four or so a second, dipping
// almost to nothing between them.
const speech = (amplitude) => (i) => tone(amplitude)(i) * (0.5 + 0.5 * Math.sin((2 * Math.PI * 4 * i) / RATE)) ** 2;
const quiet = () => 0;
let seed = 7;
const noise = (amplitude) => () => { seed = (seed * 16807) % 2147483647; return amplitude * ((seed / 2147483647) * 2 - 1); };

function feed(segmenter, clock, ms, sample) {
  const frames = Math.round(ms / FRAME_MS);
  for (let f = 0; f < frames; f++) {
    const frame = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) frame[i] = sample(clock.sample + i);
    clock.sample += FRAME;
    clock.now += FRAME_MS;
    segmenter.push(frame, clock.now);
  }
}

function run(script, options = {}) {
  const segments = [];
  const segmenter = createSpeechSegmenter({ sampleRate: RATE, onSegment: (s) => segments.push(s), ...options });
  const clock = { now: 1000, sample: 0 };
  for (const [ms, sample] of script) feed(segmenter, clock, ms, sample);
  return { segments, segmenter, clock };
}

test('silence is never sent anywhere', () => {
  assert.equal(run([[10000, quiet]]).segments.length, 0);
});

test('a sentence becomes one piece, ending at the pause, with its first word kept', () => {
  const { segments } = run([[1000, quiet], [1500, speech(0.4)], [1200, quiet]]);
  assert.equal(segments.length, 1);
  const [piece] = segments;
  const seconds = piece.samples.length / RATE;
  assert.ok(seconds >= 1.5 + 0.25, `the lead-in before the first word is kept (${seconds.toFixed(2)}s)`);
  assert.ok(seconds < 1.5 + 0.3 + 0.8 + 0.2, `and the piece stops at the pause (${seconds.toFixed(2)}s)`);
  assert.ok(piece.voicedMs > 1000 && piece.voicedMs <= 1500 + FRAME_MS, `${piece.voicedMs} ms of voice`);
  // Speech began at about 2000 on the clock; the piece starts just before it.
  assert.ok(piece.startedAt <= 2000 && piece.startedAt >= 2000 - 400, `started at ${piece.startedAt}`);
});

test('a cough or a door is not worth transcribing', () => {
  assert.equal(run([[500, quiet], [150, tone(0.3)], [1500, quiet]]).segments.length, 0);
});

test('someone who never pauses still gets captions, in pieces of at most twenty seconds', () => {
  const { segments, segmenter } = run([[25000, speech(0.4)]]);
  segmenter.flush();
  assert.equal(segments.length, 2);
  for (const piece of segments) assert.ok(piece.samples.length / RATE <= 20.2);
  const total = segments.reduce((sum, piece) => sum + piece.samples.length, 0) / RATE;
  assert.ok(total >= 24.5, `nothing said is dropped between pieces (${total.toFixed(1)}s kept)`);
});

test('a long talker is cut at a short breath once the piece is long, not mid-word', () => {
  const script = [];
  for (let i = 0; i < 8; i++) script.push([2000, speech(0.4)], [300, quiet]);
  const { segments } = run(script);
  assert.ok(segments.length >= 1);
  const first = segments[0].samples.length / RATE;
  assert.ok(first >= 9 && first < 12.5, `first piece ends at a breath after the soft limit (${first.toFixed(1)}s)`);
});

test('a steady fan or traffic hum stops counting as speech once it has been heard', () => {
  const { segments } = run([[12000, noise(0.03)]]);
  assert.ok(segments.length <= 1, `${segments.length} pieces of background noise`);
  const later = run([[12000, noise(0.03)], [6000, noise(0.03)]]);
  assert.equal(later.segments.length, segments.length, 'nothing more is sent while only the hum continues');
});

test('speech is still heard over a steady hum', () => {
  const background = noise(0.01);
  const voice = speech(0.5);
  const { segments } = run([[8000, background], [1500, (i) => background(i) + voice(i)], [1500, background]]);
  const spoken = segments.filter((piece) => piece.voicedMs >= 1000);
  assert.equal(spoken.length, 1);
});

test('every frame is reported as voice or not, for noticing speech without sending it', () => {
  let voiced = 0;
  let quietMs = 0;
  run([[1000, quiet], [2000, tone(0.2)], [1000, quiet]], {
    onFrame: (isVoice, ms) => { if (isVoice) voiced += ms; else quietMs += ms; },
  });
  assert.ok(Math.abs(voiced - 2000) < 2 * FRAME_MS, `${voiced} ms of voice`);
  assert.ok(quietMs > 1800);
});

test('a piece is packed as a 16 kHz, 16-bit mono WAV whatever the microphone ran at', () => {
  const second = new Float32Array(RATE).map((_, i) => (i % 2 ? 1 : -1) * 0.5);
  second[0] = 1; second[1] = 1; second[2] = 1;
  const wav = encodeWav(second, RATE);
  const view = new DataView(wav.buffer);
  const text = (offset, length) => String.fromCharCode(...wav.slice(offset, offset + length));
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint16(20, true), 1, 'PCM');
  assert.equal(view.getUint16(22, true), 1, 'mono');
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 16000 * 2, 'one second of sound');
  assert.equal(wav.length, 44 + 32000);
  assert.equal(view.getInt16(44, true), 32767, 'full scale stays full scale');
});

test('a microphone slower than 16 kHz is kept at its own rate rather than stretched', () => {
  const wav = encodeWav(new Float32Array(8000), 8000);
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 8000);
});

test('level of a frame', () => {
  assert.equal(frameLevel(new Float32Array(10)), 0);
  assert.ok(Math.abs(frameLevel(new Float32Array(10).fill(0.5)) - 0.5) < 1e-9);
});

test('a pure unbroken tone is background, not speech, once it has gone on a while', () => {
  const { segments, segmenter } = run([[12000, tone(0.2)]]);
  segmenter.flush();
  assert.ok(segments.length <= 1);
  assert.ok(segments.every((piece) => piece.samples.length / RATE < 5));
});
