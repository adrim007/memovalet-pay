// A call's pass lasts four hours. Captions and translation show it with every
// line, so a long meeting is given a fresh one before it runs out.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/call-pass.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, atob, JSON, Number });
const { passExpiresAt, passNeedsRenewing, RENEW_WITHIN_MS } = loaded.exports;

const pass = (claims) => {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.signature`;
};
const NOW = Date.parse('2026-09-28T12:00:00Z');
const hours = (count) => count * 60 * 60 * 1000;

test('reads when a pass runs out', () => {
  const exp = Math.floor((NOW + hours(4)) / 1000);
  assert.equal(passExpiresAt(pass({ exp, video: { room: 'a-room-with-ümlauts' } })), exp * 1000);
});

test('a fresh pass is left alone; one close to running out is renewed', () => {
  const fresh = pass({ exp: Math.floor((NOW + hours(4)) / 1000) });
  const ending = pass({ exp: Math.floor((NOW + RENEW_WITHIN_MS - 60_000) / 1000) });
  const gone = pass({ exp: Math.floor((NOW - hours(1)) / 1000) });
  assert.equal(passNeedsRenewing(fresh, NOW), false);
  assert.equal(passNeedsRenewing(ending, NOW), true);
  assert.equal(passNeedsRenewing(gone, NOW), true, 'already run out: still worth a fresh one');
});

test('a four-hour pass is renewed well before a long meeting loses captions', () => {
  const issued = pass({ exp: Math.floor((NOW + hours(4)) / 1000) });
  // Checked every five minutes: the first check inside the window renews it.
  const firstRenewal = Array.from({ length: 60 }, (_, i) => NOW + i * 5 * 60_000).find((at) => passNeedsRenewing(issued, at));
  assert.ok(firstRenewal, 'it is renewed at some point');
  assert.ok(NOW + hours(4) - firstRenewal >= 40 * 60_000, 'with plenty of time to spare');
});

test('no pass, or one that cannot be read, is not chased', () => {
  assert.equal(passNeedsRenewing(null, NOW), false);
  assert.equal(passNeedsRenewing('not-a-token', NOW), false);
  assert.equal(passNeedsRenewing('a.%%%.c', NOW), false);
  assert.equal(passExpiresAt(pass({ sub: 'no expiry' })), null);
});
