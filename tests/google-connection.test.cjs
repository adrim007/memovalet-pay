// Google Calendar/Gmail connection, run against fakes: no calls to Google, no
// database. Covers when access is saved, and when a dead token is let go.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file, modules, extra = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, require: (name) => modules[name] ?? require(name),
    Response, URL, URLSearchParams, process: { env: {} }, console: { error() {} }, ...extra,
  });
  return module.exports;
}

const pending = compile('lib/google/pending-connection.ts', {}, { Buffer, process: { env: { GOOGLE_CLIENT_SECRET: 'test-secret-only' } } });
const redirectResponse = { redirect(url) {
  const response = new Response(null, { status: 307, headers: { location: url } });
  response.savedCookies = [];
  response.cookies = { set: (...args) => response.savedCookies.push(args) };
  return response;
} };

// A fake table that records deletes and upserts.
function fakeTable() {
  const ops = [];
  const from = (table) => ({
    delete() {
      const filters = {};
      const q = { eq(k, v) { filters[k] = v; return q; }, then(r) { ops.push({ table, op: 'delete', filters }); return Promise.resolve({ error: null }).then(r); } };
      return q;
    },
    upsert(row) { ops.push({ table, op: 'upsert', row }); return Promise.resolve({ error: null }); },
  });
  return { ops, from };
}

function tokens(googleReplies) {
  const db = fakeTable();
  const lib = compile('lib/google/tokens.ts', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/supabase/service': { createServiceClient: () => db },
  }, {
    fetch: async () => {
      const { status, body } = googleReplies;
      return { ok: status < 400, status, json: async () => body };
    },
  });
  return { ...lib, ops: db.ops };
}

test('a working token returns an access token and removes nothing', async () => {
  const t = tokens({ status: 200, body: { access_token: 'ya29.ok' } });
  assert.equal(await t.exchangeForAccessToken('1//good', 'user-1'), 'ya29.ok');
  assert.equal(t.ops.length, 0);
});

test('a dead token (invalid_grant) is removed, so Settings stops saying "Connected"', async () => {
  const t = tokens({ status: 400, body: { error: 'invalid_grant', error_description: 'Bad Request' } });
  await assert.rejects(t.exchangeForAccessToken('M.C-microsoft-token', 'user-1'), /Reconnect Google in Settings/);
  assert.deepEqual(t.ops, [{
    table: 'user_google_tokens', op: 'delete',
    // Only this exact token: a reconnect that raced the failure survives.
    filters: { user_id: 'user-1', refresh_token: 'M.C-microsoft-token' },
  }]);
});

test('a Google outage never disconnects anyone', async () => {
  const t = tokens({ status: 503, body: { error: 'backend_error' } });
  await assert.rejects(t.exchangeForAccessToken('1//good', 'user-1'));
  assert.equal(t.ops.length, 0);
});

test('without knowing whose token it is, nothing is removed', async () => {
  const t = tokens({ status: 400, body: { error: 'invalid_grant' } });
  await assert.rejects(t.exchangeForAccessToken('1//dead'));
  assert.equal(t.ops.length, 0);
});

function callback(session, assurance = { currentLevel: 'aal1', nextLevel: 'aal1' }) {
  const db = fakeTable();
  const supabase = { auth: { exchangeCodeForSession: async () => ({ data: { session }, error: null }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: assurance, error: null }) } }, from: db.from };
  const route = compile('app/auth/callback/route.ts', {
    'next/server': { NextResponse: redirectResponse },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/displayName': { hasCompleteProfile: () => true },
    '@/lib/google/pending-connection': pending,
  });
  return { GET: route.GET, ops: db.ops };
}

test('Google OAuth waits for MFA without saving a connection or exposing its token', async () => {
  const { GET, ops } = callback({ user: { id: 'user-1' }, provider_refresh_token: 'private-test-token' }, { currentLevel: 'aal1', nextLevel: 'aal2' });
  const res = await GET(new Request('https://memovalet.com/auth/callback?code=abc&connect=google&next=%2Fcalendar%3Fsync%3D1'));
  assert.equal(ops.length, 0);
  assert.equal(res.headers.get('location'), 'https://memovalet.com/mfa?next=%2Fauth%2Fgoogle%2Fcomplete');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const [name, value, options] = res.savedCookies[0];
  assert.equal(name, pending.GOOGLE_PENDING_COOKIE);
  assert.equal(value.includes('private-test-token'), false);
  assert.equal(options.httpOnly, true); assert.equal(options.secure, true);
  assert.equal(options.path, '/auth/google/complete'); assert.equal(options.maxAge, 600);
  assert.equal(pending.openGoogleConnection(value, 'user-1').next, '/calendar?sync=1');
});

test('pending Google credentials reject wrong users, expiry, tampering and external redirects', () => {
  const sealed = pending.sealGoogleConnection('user-1', 'test-token', '//external.test', 1000);
  assert.equal(pending.openGoogleConnection(sealed, 'user-1', 1001).next, '/dashboard');
  assert.equal(pending.openGoogleConnection(sealed, 'user-2', 1001), null);
  assert.equal(pending.openGoogleConnection(sealed, 'user-1', 601000), null);
  assert.equal(pending.openGoogleConnection(sealed.slice(0, 30) + (sealed[30] === 'x' ? 'y' : 'x') + sealed.slice(31), 'user-1', 1001), null);
  assert.equal(pending.googleNextPath('/\\external.test'), '/dashboard');
});

function complete({ userId = 'user-1', level = 'aal2', value, saveError = false, authError = false, assuranceError = false } = {}) {
  const writes = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: authError }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: level, nextLevel: 'aal2' }, error: assuranceError }) } },
    from: table => ({ upsert: async row => { writes.push({ table, row }); return { error: saveError }; } }),
  };
  const route = compile('app/auth/google/complete/route.ts', {
    'next/server': { NextResponse: redirectResponse },
    'next/headers': { cookies: async () => ({ get: () => value ? { value } : undefined }) },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/displayName': { hasCompleteProfile: () => true },
    '@/lib/google/pending-connection': pending,
  });
  return { run: () => route.GET(new Request('https://memovalet.com/auth/google/complete')), writes };
}

test('after MFA, completion saves the matching Google connection and returns to Calendar', async () => {
  const value = pending.sealGoogleConnection('user-1', 'test-token', '/calendar?sync=1');
  const h = complete({ value }); const res = await h.run();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].row.user_id, 'user-1'); assert.equal(h.writes[0].row.refresh_token, 'test-token');
  assert.equal(res.headers.get('location'), 'https://memovalet.com/calendar?sync=1');
  assert.equal(res.savedCookies[0][2].maxAge, 0);
});

test('completion never saves before MFA and retains the encrypted pending result for verification', async () => {
  const h = complete({ level: 'aal1', value: pending.sealGoogleConnection('user-1', 'test-token', '/calendar') }); const res = await h.run();
  assert.equal(h.writes.length, 0); assert.equal(res.savedCookies.length, 0);
  assert.match(res.headers.get('location'), /\/mfa\?next=/);
});

test('completion refuses missing, expired and account-switched credentials', async () => {
  for (const value of [undefined, 'invalid', pending.sealGoogleConnection('user-2', 'test-token', '/calendar'), pending.sealGoogleConnection('user-1', 'test-token', '/calendar', Date.now() - 601000)]) {
    const h = complete({ value }); const res = await h.run();
    assert.equal(h.writes.length, 0); assert.match(res.headers.get('location'), /google=failed/); assert.equal(res.savedCookies[0][2].maxAge, 0);
  }
});

test('failed authentication, assurance lookup or database save cannot report a successful connection', async () => {
  for (const options of [{ authError: true }, { assuranceError: true }, { saveError: true }]) {
    const h = complete({ value: pending.sealGoogleConnection('user-1', 'test-token', '/calendar'), ...options }); const res = await h.run();
    assert.doesNotMatch(res.headers.get('location'), /\/calendar/);
    if (!options.saveError) assert.equal(h.writes.length, 0);
    assert.equal(res.savedCookies[0][2].maxAge, 0);
  }
});

const emailFirstUser = { id: 'user-1', app_metadata: { provider: 'email' } };

test('Connect Google saves access even when the account was made with email and password', async () => {
  const { GET, ops } = callback({ user: emailFirstUser, provider_refresh_token: '1//calendar' });
  const res = await GET(new Request('https://memovalet.com/auth/callback?code=abc&connect=google&next=/settings'));
  assert.equal(res.headers.get('location'), 'https://memovalet.com/settings');
  assert.equal(ops.length, 1);
  assert.equal(ops[0].row.user_id, 'user-1');
  assert.equal(ops[0].row.refresh_token, '1//calendar');
});

test('an ordinary sign-in (Microsoft here) saves nothing into the Google slot', async () => {
  const { GET, ops } = callback({ user: { id: 'user-1', app_metadata: { provider: 'google' } }, provider_refresh_token: 'M.C-microsoft' });
  await GET(new Request('https://memovalet.com/auth/callback?code=abc&next=/dashboard'));
  assert.equal(ops.length, 0);
});

test('a refused Google link (already belongs to another account) lands in Settings with the reason', async () => {
  const { GET, ops } = callback({ user: emailFirstUser });
  const res = await GET(new Request('https://memovalet.com/auth/callback?connect=google&next=/settings&error=invalid_request&error_code=identity_already_exists'));
  assert.equal(res.headers.get('location'), 'https://memovalet.com/settings?google=taken#integrations');
  assert.equal(ops.length, 0);
});

test('any other refused Google link lands in Settings too — not on the login page while signed in', async () => {
  const { GET } = callback({ user: emailFirstUser });
  const res = await GET(new Request('https://memovalet.com/auth/callback?connect=google&error=access_denied'));
  assert.equal(res.headers.get('location'), 'https://memovalet.com/settings?google=failed#integrations');
});
