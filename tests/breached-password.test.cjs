// Passwords already stolen from other companies are the ones tried first in
// every automated attack. Supabase only checks that list on its paid plan, so
// MemoValet checks the same free list itself — without ever sending the
// password anywhere.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/breached-password.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: loaded.exports, module: loaded, TextEncoder, Uint8Array, Number, Math,
  setTimeout, clearTimeout, AbortController, globalThis: {},
});
const {
  passwordHash, splitHash, countInRange, checkPasswordBreached,
  PREFIX_LENGTH, BREACHED_HINT, PWNED_RANGE_URL,
} = loaded.exports;

const { subtle } = require('node:crypto').webcrypto;

test('the password is hashed the way the published list is', async () => {
  // The documented example: SHA-1 of "password" in uppercase hex.
  assert.equal(await passwordHash('password', subtle), '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
});

test('only a fragment of the hash ever leaves the device', async () => {
  const hash = await passwordHash('correct horse battery staple', subtle);
  const { prefix, suffix } = splitHash(hash);
  assert.equal(prefix.length, PREFIX_LENGTH, 'five characters, about a millionth of the list');
  assert.equal(prefix + suffix, hash);
  // The part that identifies the password stays here.
  assert.ok(suffix.length > 30);
  assert.ok(!prefix.includes(suffix));
});

test('a match in the list is found, and a near miss is not', () => {
  const body = ['0018A45C4D1DEF81644B54AB7F969B88D65:1', 'AB3B9F3A5A1D2B4C6D7E8F9012345678901:42'].join('\r\n');
  assert.equal(countInRange(body, '0018A45C4D1DEF81644B54AB7F969B88D65'), 1);
  assert.equal(countInRange(body, 'ab3b9f3a5a1d2b4c6d7e8f9012345678901'), 42, 'case does not matter');
  assert.equal(countInRange(body, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'), 0, 'not on the list');
  assert.equal(countInRange('', 'ANY'), 0);
  assert.equal(countInRange('nonsense\n:::\n', 'ANY'), 0, 'a broken answer is not a match');
  // Padding entries are sent with a count of zero and must not count as a hit.
  assert.equal(countInRange('DEADBEEF00000000000000000000000000:0', 'DEADBEEF00000000000000000000000000'), 0);
});

test('a known-breached password is refused, and only its prefix is requested', async () => {
  let asked = null;
  const result = await checkPasswordBreached('password', {
    subtle,
    fetch: async (url, options) => {
      asked = { url, padding: options.headers['Add-Padding'] };
      // The real service answers with suffixes only, never the prefix.
      return { ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9999999' };
    },
  });
  assert.deepEqual({ ...result }, { breached: true, unchecked: false });
  assert.equal(asked.url, `${PWNED_RANGE_URL}5BAA6`);
  // Everything after the address is the five-character prefix and nothing
  // else — no password, no full hash, no account it belongs to.
  assert.equal(asked.url.slice(PWNED_RANGE_URL.length), '5BAA6');
  assert.equal(asked.padding, 'true', 'every answer is the same size, so its size reveals nothing');
});

test('a password that is not on the list is allowed through', async () => {
  const result = await checkPasswordBreached('u7!vQ2marmaladeTrombone', {
    subtle,
    fetch: async () => ({ ok: true, text: async () => '0000000000000000000000000000000000A:3' }),
  });
  assert.deepEqual({ ...result }, { breached: false, unchecked: false });
});

test('when the list cannot be reached, nobody is locked out of signing up', async () => {
  const offline = await checkPasswordBreached('anything', {
    subtle, fetch: async () => { throw new Error('offline'); },
  });
  assert.deepEqual({ ...offline }, { breached: false, unchecked: true });

  const refused = await checkPasswordBreached('anything', {
    subtle, fetch: async () => ({ ok: false, text: async () => '' }),
  });
  assert.deepEqual({ ...refused }, { breached: false, unchecked: true });

  const slow = await checkPasswordBreached('anything', {
    subtle, timeoutMs: 20,
    fetch: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  assert.deepEqual({ ...slow }, { breached: false, unchecked: true }, 'a slow list never stalls sign-up');
});

test('an old browser without the crypto it needs does not break sign-up', async () => {
  const result = await checkPasswordBreached('anything', { subtle: undefined, fetch: async () => ({ ok: true, text: async () => '' }) });
  assert.deepEqual({ ...result }, { breached: false, unchecked: true });
});

// A browser's fetch throws "Illegal invocation" if it is called detached from
// the window. Because this check lets everything through when it fails, that
// mistake made every password look safe while appearing to work — it shipped
// once and was only caught by driving the real form.
test('the browser entry point passes a fetch that actually works detached', async () => {
  const windowish = {};
  const browserFetch = function (url) {
    if (this !== windowish) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    return Promise.resolve({ ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9999999' });
  };
  windowish.fetch = browserFetch;
  windowish.crypto = { subtle };

  // What checkPasswordBreachedHere does with the real window.
  const result = await checkPasswordBreached('password', {
    fetch: windowish.fetch.bind(windowish),
    subtle: windowish.crypto?.subtle,
  });
  assert.deepEqual({ ...result }, { breached: true, unchecked: false });

  // And the mistake this guards against: unbound, it silently allows everything.
  const unbound = await checkPasswordBreached('password', { fetch: windowish.fetch, subtle });
  assert.deepEqual({ ...unbound }, { breached: false, unchecked: true }, 'fails open, which is why it must be bound');
});

test('the browser entry point binds fetch to the window', () => {
  const source = fs.readFileSync('lib/breached-password.ts', 'utf8');
  const entry = source.slice(source.indexOf('export function checkPasswordBreachedHere'));
  assert.match(entry, /fetch: globalThis\.fetch\?\.bind\(globalThis\)/);
});

test('the wording tells people what to do without scoring the password', () => {
  assert.match(BREACHED_HINT, /data breach/i);
  assert.match(BREACHED_HINT, /choose a different one/i);
  assert.doesNotMatch(BREACHED_HINT, /\d/, 'never show how many times it was found');
});

// The check has to actually run before the account is made, in both places a
// password is set — easy to drop in a refactor, and nothing else would notice.
test('sign-up and password reset both run the check before saving', () => {
  const signup = fs.readFileSync('app/login/page.tsx', 'utf8');
  const reset = fs.readFileSync('components/ResetPasswordForm.tsx', 'utf8');
  for (const [name, source, save] of [['sign-up', signup, 'auth.signUp'], ['reset', reset, 'auth.updateUser']]) {
    const checkAt = source.indexOf('checkPasswordBreachedHere');
    assert.ok(checkAt > 0, `${name} does not check at all`);
    assert.ok(checkAt < source.indexOf(save), `${name} checks after saving, which is too late`);
  }
});
