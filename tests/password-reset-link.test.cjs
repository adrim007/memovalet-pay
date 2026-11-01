// Emailed sign-up and password reset links, run against fakes: no email, no
// Supabase. What matters most:
//   * wherever Supabase sends a link, it ends on the right page — never
//     silently on the homepage (the reset address wasn't on Supabase's
//     allow-list);
//   * opening a link spends nothing — work email security (Microsoft 365 Safe
//     Links) opens every link before the person does, and used to burn them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, require: (name) => modules[name] ?? require(name),
    Response, URL, URLSearchParams, console: { error() {} },
  });
  return module.exports;
}

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const MINUTE = 60 * 1000;
// Objects built inside the vm have their own prototypes; compare their contents.
const plain = (value) => JSON.parse(JSON.stringify(value));

// ------------------------------------------------------------------ proxy.ts

function runProxy(href) {
  let passedThrough = false;
  const { proxy } = compile('proxy.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/middleware': { updateSession: () => { passedThrough = true; return 'session refreshed'; } },
  });
  const nextUrl = new URL(href);
  nextUrl.clone = () => new URL(nextUrl.href);
  const result = proxy({ nextUrl, url: href });
  return { passedThrough, location: result instanceof Response ? result.headers.get('location') : null };
}

test('a link Supabase sent to the bare site is handed to /auth/confirm, code intact', () => {
  const r = runProxy('https://memovalet.com/?code=pkce-abc');
  assert.equal(r.passedThrough, false);
  assert.equal(r.location, 'https://memovalet.com/auth/confirm?code=pkce-abc');
});

test('the homepage without a code is left alone', () => {
  const r = runProxy('https://memovalet.com/');
  assert.equal(r.passedThrough, true);
  assert.equal(r.location, null);
});

test('codes meant for other routes are never intercepted', () => {
  for (const href of [
    'https://memovalet.com/auth/callback?code=google',
    'https://memovalet.com/auth/confirm?code=x&type=recovery',
    'https://memovalet.com/api/integrations/notion/callback?code=notion',
    'https://memovalet.com/api/integrations/slack/callback?code=slack',
  ]) {
    const r = runProxy(href);
    assert.equal(r.passedThrough, true, href);
    assert.equal(r.location, null, href);
  }
});

// -------------------------------------------------------- /auth/confirm route

function confirmRoute({ exchange, verify } = {}) {
  const verifyCalls = [];
  const supabase = {
    auth: {
      exchangeCodeForSession: async () => exchange,
      verifyOtp: async (args) => { verifyCalls.push(args); return verify; },
    },
  };
  const route = compile('app/auth/confirm/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => supabase },
  });
  const get = async (href) => (await route.GET(new Request(href))).headers.get('location');
  const post = async (fields, origin = 'https://memovalet.com') => {
    const res = await route.POST(new Request('https://memovalet.com/auth/confirm', {
      method: 'POST',
      headers: origin ? { origin } : {},
      body: new URLSearchParams(fields),
    }));
    return { status: res.status, location: res.headers.get('location') };
  };
  return { get, post, verifyCalls };
}

const signedIn = (user = {}) => ({ data: { session: { user }, user }, error: null });
const refused = { data: { session: null, user: null }, error: { message: 'invalid flow state' } };
const verified = { data: {}, error: null };

// Supabase's default (PKCE) links

test('a code reset link with its type intact opens "Choose a new password"', async () => {
  const { get } = confirmRoute({ exchange: signedIn() });
  assert.equal(await get('https://memovalet.com/auth/confirm?code=c&type=recovery'), 'https://memovalet.com/reset-password');
});

test('a code reset link that lost its type on the way still opens "Choose a new password"', async () => {
  const { get } = confirmRoute({ exchange: signedIn({ recovery_sent_at: ago(5 * MINUTE) }) });
  assert.equal(await get('https://memovalet.com/auth/confirm?code=c'), 'https://memovalet.com/reset-password');
});

test('a reset asked for hours ago does not hijack an ordinary sign-in link', async () => {
  const { get } = confirmRoute({ exchange: signedIn({ recovery_sent_at: ago(3 * 60 * MINUTE) }) });
  assert.equal(await get('https://memovalet.com/auth/confirm?code=c'), 'https://memovalet.com/dashboard');
});

test('a code sign-up confirmation with no reset request goes to the dashboard', async () => {
  const { get } = confirmRoute({ exchange: signedIn({}) });
  assert.equal(await get('https://memovalet.com/auth/confirm?code=c'), 'https://memovalet.com/dashboard');
});

test('an expired or reused code reset link says so on the login page', async () => {
  const { get } = confirmRoute({ exchange: refused });
  assert.equal(await get('https://memovalet.com/auth/confirm?code=c&type=recovery'), 'https://memovalet.com/login?error=reset-link');
});

// Custom-template (token_hash) links: scanner-proof

test('opening a token_hash link spends nothing — it shows the Continue page instead', async () => {
  const r = confirmRoute({ verify: verified });
  assert.equal(
    await r.get('https://memovalet.com/auth/confirm?token_hash=h&type=recovery'),
    'https://memovalet.com/auth/continue?token_hash=h&type=recovery'
  );
  assert.equal(r.verifyCalls.length, 0, 'a scanner opening the link must not use up the one-time token');
});

test('pressing Continue on a reset link opens "Choose a new password"', async () => {
  const r = confirmRoute({ verify: verified });
  const res = await r.post({ token_hash: 'h', type: 'recovery' });
  assert.equal(res.status, 303, 'the browser must follow with a GET, not post again');
  assert.equal(res.location, 'https://memovalet.com/reset-password');
  assert.deepEqual(plain(r.verifyCalls), [{ type: 'recovery', token_hash: 'h' }]);
});

test('pressing Confirm on a sign-up link goes where the sign-up was headed', async () => {
  const r = confirmRoute({ verify: verified });
  assert.equal((await r.post({ token_hash: 'h', type: 'email', next: '/settings' })).location, 'https://memovalet.com/settings');
});

test('a next address pointing off-site is ignored', async () => {
  const r = confirmRoute({ verify: verified });
  assert.equal((await r.post({ token_hash: 'h', type: 'email', next: '//evil.example' })).location, 'https://memovalet.com/dashboard');
});

test('another website cannot press Continue on someone’s behalf', async () => {
  for (const origin of ['https://evil.example', null]) {
    const r = confirmRoute({ verify: verified });
    const res = await r.post({ token_hash: 'h', type: 'recovery' }, origin);
    assert.equal(res.status, 403, String(origin));
    assert.equal(r.verifyCalls.length, 0, String(origin));
  }
});

test('an expired or already-used token_hash reset link says so on the login page', async () => {
  const r = confirmRoute({ verify: { data: {}, error: { message: 'Token has expired or is invalid' } } });
  const res = await r.post({ token_hash: 'h', type: 'recovery' });
  assert.equal(res.status, 303);
  assert.equal(res.location, 'https://memovalet.com/login?error=reset-link');
});

test('an unknown link type is refused before it reaches Supabase', async () => {
  const r = confirmRoute({ verify: verified });
  const res = await r.post({ token_hash: 'h', type: 'phone_change' });
  assert.equal(res.location, 'https://memovalet.com/login?error=link');
  assert.equal(r.verifyCalls.length, 0);
});
