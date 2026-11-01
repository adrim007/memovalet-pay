// The API guard for two-step verification, run against a fake Supabase. It sits
// in front of every request, so both ways of getting it wrong matter: failing to
// block a half-signed-in session, and blocking people it should never touch.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ user, aal, aalThrows = false, refreshedCookie = null }) {
  class FakeResponse {
    constructor(body, status) {
      this.body = body;
      this.status = status;
      const jar = new Map();
      this.cookies = {
        set: (nameOrCookie, value) => {
          const c = typeof nameOrCookie === 'object' ? nameOrCookie : { name: nameOrCookie, value };
          jar.set(c.name, c);
        },
        getAll: () => [...jar.values()],
      };
    }
    static next() { return new FakeResponse(null, 200); }
    static json(body, init) { return new FakeResponse(body, init?.status ?? 200); }
  }

  const modules = {
    'next/server': { NextResponse: FakeResponse },
    '@supabase/ssr': {
      createServerClient: (_url, _key, { cookies }) => ({
        auth: {
          getUser: async () => {
            // A real refresh rewrites the session cookie mid-request.
            if (refreshedCookie) cookies.setAll([refreshedCookie]);
            return { data: { user } };
          },
          mfa: {
            getAuthenticatorAssuranceLevel: async () => {
              if (aalThrows) throw new Error('network');
              return { data: aal };
            },
          },
        },
      }),
    },
  };

  const js = ts.transpileModule(fs.readFileSync('lib/supabase/middleware.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports,
    module,
    require: (name) => modules[name],
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' } },
    console: { error() {} },
  });
  return module.exports.updateSession;
}

function request(path) {
  const jar = new Map();
  return {
    nextUrl: { pathname: path },
    cookies: { getAll: () => [...jar.values()], set: (name, value) => jar.set(name, { name, value }) },
  };
}

const USER = { id: 'u1', created_at: '2026-09-01' };
const NO_MFA = { currentLevel: 'aal1', nextLevel: 'aal1' };
const MFA_DONE = { currentLevel: 'aal2', nextLevel: 'aal2' };
const MFA_PENDING = { currentLevel: 'aal1', nextLevel: 'aal2' };

test('signed-out visitors reach the API untouched (shared links, webhooks)', async () => {
  const res = await load({ user: null, aal: null })(request('/api/shared-files/abc/def'));
  assert.equal(res.status, 200);
});

test('accounts without 2-step are never blocked', async () => {
  const res = await load({ user: USER, aal: NO_MFA })(request('/api/meetings'));
  assert.equal(res.status, 200);
});

test('accounts that have entered their code are never blocked', async () => {
  const res = await load({ user: USER, aal: MFA_DONE })(request('/api/meetings'));
  assert.equal(res.status, 200);
});

test('password-only session on a 2-step account is blocked from the API', async () => {
  const res = await load({ user: USER, aal: MFA_PENDING })(request('/api/meetings'));
  assert.equal(res.status, 401);
  assert.match(res.body.error, /Two-step verification required/);
});

test('pages are left to the app layout, which sends them to /mfa', async () => {
  const res = await load({ user: USER, aal: MFA_PENDING })(request('/dashboard'));
  assert.equal(res.status, 200);
});

test('a blocked response keeps the refreshed session cookie, so nobody is signed out', async () => {
  const cookie = { name: 'sb-access-token', value: 'fresh', options: {} };
  const res = await load({ user: USER, aal: MFA_PENDING, refreshedCookie: cookie })(request('/api/meetings'));
  assert.equal(res.status, 401);
  assert.equal(res.cookies.getAll().find((c) => c.name === 'sb-access-token')?.value, 'fresh');
});

test('an unavailable level check cannot bypass two-step verification', async () => {
  const res = await load({ user: USER, aal: null, aalThrows: true })(request('/api/meetings'));
  assert.equal(res.status, 503);
});

test('missing assurance data blocks the API and preserves refreshed cookies', async () => {
  const cookie = { name: 'sb-access-token', value: 'fresh', options: {} };
  const res = await load({ user: USER, aal: null, refreshedCookie: cookie })(request('/api/documents'));
  assert.equal(res.status, 503);
  assert.equal(res.cookies.getAll()[0].value, 'fresh');
});

 test('free accounts can use the app without a subscription', async () => {
  assert.equal((await load({ user: USER, aal: NO_MFA })(request('/api/projects'))).status,200);
});
