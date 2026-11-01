// The protections every answer from the site carries. These are easy to lose
// in a config edit and nothing else would notice, so they are pinned here —
// including the ones a live call depends on being allowed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('next.config.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, Promise, require: () => ({}) });
const config = loaded.exports.default;

const rules = config.headers();
const headers = async () => {
  const [rule] = await rules;
  assert.equal(rule.source, '/:path*', 'every page and API answer, not just some');
  return Object.fromEntries(rule.headers.map((h) => [h.key.toLowerCase(), h.value]));
};

test('no other website can frame MemoValet and harvest clicks', async () => {
  const sent = await headers();
  assert.match(sent['content-security-policy'], /frame-ancestors 'self'/);
  assert.equal(sent['x-frame-options'], 'SAMEORIGIN', 'the same rule for older browsers');
});

test('a meeting id never travels to another site in the address', async () => {
  const sent = await headers();
  assert.equal(sent['referrer-policy'], 'strict-origin-when-cross-origin');
});

test('files are the type they say they are', async () => {
  assert.equal((await headers())['x-content-type-options'], 'nosniff');
});

test('a call keeps the camera, microphone, screen sharing and location it needs', async () => {
  const allowed = (await headers())['permissions-policy'];
  for (const capability of ['camera', 'microphone', 'display-capture', 'geolocation']) {
    assert.match(allowed, new RegExp(`${capability}=\\(self\\)`), `${capability} must still work in a call`);
  }
});

test('everything the site does not use is refused', async () => {
  const allowed = (await headers())['permissions-policy'];
  for (const capability of ['payment', 'usb', 'serial', 'bluetooth', 'midi', 'idle-detection']) {
    assert.match(allowed, new RegExp(`${capability}=\\(\\)`), `${capability} should be off`);
  }
});

test('sign-in and checkout popups still work, but cannot reach back in', async () => {
  assert.equal((await headers())['cross-origin-opener-policy'], 'same-origin-allow-popups');
});

test('the framework and its version are not advertised to scanners', () => {
  assert.equal(config.poweredByHeader, false);
});
