// The daily overdue-reminder job, run against fakes: no emails, no database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const LONG_AGO = '2020-01-01';
const schedulerAuth = (() => {
  const m = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/scheduler-auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: m, exports: m.exports, require });
  return m.exports;
})();

function load({ items = [], users = {}, owners = [], secret = 'cron-secret' } = {}) {
  const sent = [];
  const table = (name) => {
    const q = {
      select() { return q; }, eq() { return q; }, in() { return q; }, not() { return q; }, lte() { return q; },
      then(resolve) {
        const data = name === 'action_items' ? items : name === 'team_members' ? owners : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return q;
  };
  const service = {
    from: table,
    auth: { admin: { getUserById: async (id) => ({ data: { user: users[id] || null } }) } },
  };
  const js = ts.transpileModule(fs.readFileSync('app/api/action-items/remind/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, Response, URL, Date, Math, Map, Set, Array, isNaN,
    process: { env: { CRON_SECRET: secret } }, console: { error() {} },
    require: (name) => ({
      'next/server': { NextResponse: Response },
      '@/lib/supabase/service': { createServiceClient: () => service },
      '@/lib/database': { createNotification: async () => {} },
      '@/lib/scheduler-auth': schedulerAuth,
      '@/lib/email/send': { sendAppEmail: async (input) => { sent.push(input); return { sent: true, via: 'resend' }; } },
    })[name],
  });
  return { GET: module.exports.GET, sent };
}

const cron = (headers = {}) => new Request('https://memovalet.com/api/action-items/remind', { headers });
const AUTH = { authorization: 'Bearer cron-secret' };

test('without the scheduler secret, nothing runs', async () => {
  const { GET, sent } = load({ items: [{ user_id: 'u1', task: 't', due_date: LONG_AGO, meetings: { title: 'M' } }], users: { u1: { email: 'a@x.com' } } });
  assert.equal((await GET(cron())).status, 401);
  assert.equal(sent.length, 0);
});

test('the secret in the web address no longer works (addresses end up in logs)', async () => {
  const { GET } = load();
  const res = await GET(new Request('https://memovalet.com/api/action-items/remind?secret=cron-secret'));
  assert.equal(res.status, 401);
});

test('overdue items reach the person by MemoValet email — no Google connection needed', async () => {
  const { GET, sent } = load({
    items: [{ user_id: 'u1', task: 'Send the proposal', due_date: LONG_AGO, meetings: { title: 'Kickoff' } }],
    users: { u1: { email: 'ada@example.com', user_metadata: {} } },
  });
  const res = await GET(cron(AUTH));
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ada@example.com');
  assert.match(sent[0].text, /Send the proposal/);
  assert.match(sent[0].text, /turn these emails off in Settings/);
});

test('someone who turned the emails off gets none', async () => {
  const { GET, sent } = load({
    items: [{ user_id: 'u1', task: 't', due_date: LONG_AGO, meetings: { title: 'M' } }],
    users: { u1: { email: 'ada@example.com', user_metadata: { notification_prefs: { overdue_digest: false } } } },
  });
  const body = await (await GET(cron(AUTH))).json();
  assert.equal(sent.length, 0);
  assert.equal(body.usersOptedOut, 1);
});

test('items not yet due, or with no date, send nothing', async () => {
  const { GET, sent } = load({
    items: [
      { user_id: 'u1', task: 'future', due_date: '2999-01-01', meetings: { title: 'M' } },
      { user_id: 'u1', task: 'undated', due_date: null, meetings: { title: 'M' } },
      { user_id: 'u1', task: 'vague', due_date: 'next Friday', meetings: { title: 'M' } },
    ],
    users: { u1: { email: 'ada@example.com' } },
  });
  await GET(cron(AUTH));
  assert.equal(sent.length, 0);
});

test('team owners hear about long-overdue team items, unless they opted out', async () => {
  const items = [{ user_id: 'u1', task: 'Ship it', owner: 'Ben', due_date: LONG_AGO, meetings: { title: 'Standup', team_id: 'team-1' } }];
  const owners = [{ team_id: 'team-1', user_id: 'boss' }];
  const on = load({ items, owners, users: { u1: { email: 'u1@x.com' }, boss: { email: 'boss@x.com' } } });
  await on.GET(cron(AUTH));
  assert.ok(on.sent.some((m) => m.to === 'boss@x.com' && /owner: Ben/.test(m.text)));

  const off = load({ items, owners, users: { u1: { email: 'u1@x.com' }, boss: { email: 'boss@x.com', user_metadata: { notification_prefs: { overdue_digest: false } } } } });
  await off.GET(cron(AUTH));
  assert.ok(!off.sent.some((m) => m.to === 'boss@x.com'));
});
