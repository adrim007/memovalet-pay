// Calls nobody closed. LiveKit holds a room only while somebody is in it, so
// that is the truth a session is measured against — carefully, because closing
// a meeting that is actually happening is far worse than leaving one open.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/stale-sessions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, Set, Date, Math, Number });
const { finishedSessions, longAbandonedSessions, SETTLING_MS, LONGEST_CALL_MS } = loaded.exports;

const NOW = Date.parse('2026-09-28T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const session = (id, minutesAgo, scheduledStart) => ({ id, createdAt: ago(minutesAgo * 60_000), scheduledStart });

test('a call with nobody in it, set up a while ago, is over', () => {
  const closed = finishedSessions({ open: [session('a', 60)], liveRooms: [], now: NOW });
  assert.deepEqual([...closed], ['a']);
});

test('a call somebody is actually in is never closed', () => {
  const closed = finishedSessions({ open: [session('a', 60), session('b', 90)], liveRooms: ['b'], now: NOW });
  assert.deepEqual([...closed], ['a'], 'b is occupied');
});

test('a room just made, before anyone has joined, is left alone', () => {
  const justNow = { id: 'new', createdAt: ago(60_000) };
  assert.deepEqual([...finishedSessions({ open: [justNow], liveRooms: [], now: NOW })], []);
  // And once the settling time has passed with nobody in it, it closes.
  const older = { id: 'new', createdAt: ago(SETTLING_MS + 60_000) };
  assert.deepEqual([...finishedSessions({ open: [older], liveRooms: [], now: NOW })], ['new']);
});

test('a meeting booked for later is judged from when it was booked for, not when it was made', () => {
  // Set up last week, due to start two minutes ago: still settling.
  const booked = { id: 'booked', createdAt: ago(7 * 24 * 60 * 60_000), scheduledStart: ago(2 * 60_000) };
  assert.deepEqual([...finishedSessions({ open: [booked], liveRooms: [], now: NOW })], []);
});

test('when LiveKit cannot be reached, only calls too old to be real are closed', () => {
  const open = [session('recent', 90), session('ancient', 60 * 24)];
  // A service hiccup must never end a meeting that is happening.
  assert.deepEqual([...longAbandonedSessions({ open, now: NOW })], ['ancient']);
  assert.ok(LONGEST_CALL_MS >= 12 * 60 * 60 * 1000);
});

test('a session with no usable dates is left for a person to deal with', () => {
  const broken = { id: 'odd', createdAt: 'not a date' };
  assert.deepEqual([...finishedSessions({ open: [broken], liveRooms: [], now: NOW })], []);
  assert.deepEqual([...longAbandonedSessions({ open: [broken], now: NOW })], []);
});

test('the 26 sessions left open in production would all be closed by this', () => {
  // They were created days ago and LiveKit holds no rooms for them.
  const open = Array.from({ length: 26 }, (_, i) => session(`old-${i}`, 60 * 24 * (i + 1)));
  assert.equal(finishedSessions({ open, liveRooms: [], now: NOW }).length, 26);
});
