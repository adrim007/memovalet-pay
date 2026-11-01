const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file, modules = {}, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, require: name => modules[name] ?? require(name), Date, Intl, URL, URLSearchParams, Response, AbortSignal, Error, process: { env: {} }, console, ...extra,
  });
  return module.exports;
}
const work = compile('lib/work-calendar.ts');
const model = compile('lib/google/calendar-sync-model.ts', { '@/lib/work-calendar': work });
const plain = value => JSON.parse(JSON.stringify(value));
const row = { id: 'item', description: 'Call Michelle', due_date: '2026-10-10', due_at: '2026-10-10T02:00:00Z', reminder_at: '2026-10-10T01:45:00Z', status: 'pending' };
const base = model.sourceSnapshot('commitment', row, 'Australia/Melbourne');
const later = { ...base, at: '2026-10-10T03:00:00.000Z' };
function event(value = base) { return { id: 'event', etag: 'v1', ...model.googleBody(value, 'user', 'commitment:item', 'Australia/Melbourne') }; }

test('1pm Melbourne keeps its local day and the exact instant in Google', () => {
  assert.equal(base.at, '2026-10-10T02:00:00.000Z');
  assert.equal(base.date, '2026-10-10');
  assert.equal(model.googleBody(base, 'user', 'key', 'Australia/Melbourne').start.timeZone, 'Australia/Melbourne');
  assert.deepEqual(plain(model.remoteSnapshot(event(), 'commitment', 'Australia/Melbourne')), plain(base));
});
test('midnight and Auckland daylight saving do not shift the deadline day', () => {
  const value = model.sourceSnapshot('commitment', { ...row, due_at: '2026-10-09T11:30:00Z' }, 'Pacific/Auckland');
  assert.equal(value.date, '2026-10-10');
  const allDay = model.sourceSnapshot('project', { name: 'Delivery', due_date: '2026-10-10', status: 'active' }, 'America/Los_Angeles');
  assert.equal(model.googleBody(allDay, 'u', 'k', 'America/Los_Angeles').start.date, '2026-10-10');
});
test('invalid dates never become scheduled events', () => {
  assert.equal(model.sourceSnapshot('project', { name: 'Delivery', due_date: '2026-02-30', status: 'active' }, 'UTC'), null);
});
test('edits in only one system are propagated and simultaneous edits conflict', () => {
  assert.equal(model.syncDecision(base, later, base), 'push');
  assert.equal(model.syncDecision(base, base, later), 'pull');
  assert.equal(model.syncDecision(base, later, { ...base, title: 'Different' }), 'conflict');
  assert.equal(model.syncDecision(base, later, later), 'same');
  assert.equal(model.syncDecision(base, null, later), 'conflict');
});
test('deleting from Google clears schedule without deleting work and cancels its timed reminder', () => {
  const changes = model.sourceChanges('commitment', null, row);
  assert.deepEqual(plain(changes), { due_date: null, due_at: null, reminder_at: null });
});
test('rescheduling preserves the existing reminder offset', () => {
  assert.equal(model.sourceChanges('commitment', later, row).reminder_at, '2026-10-10T02:45:00.000Z');
});
test('recurrence, guests, all day calls and timed date-only tasks are rejected explicitly', () => {
  assert.throws(() => model.remoteSnapshot({ ...event(), recurrence: ['RRULE:FREQ=DAILY'] }, 'commitment', 'UTC'), /Repeating/);
  assert.throws(() => model.remoteSnapshot({ ...event(), attendees: [{ email: 'guest@example.test' }] }, 'commitment', 'UTC'), /guests/);
  assert.throws(() => model.remoteSnapshot(event(), 'action_item', 'UTC'), /dates only/);
  assert.throws(() => model.remoteSnapshot({ ...event(), start: { date: '2026-10-10' } }, 'call', 'UTC'), /need a time/);
});

class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
function harness(options = {}) {
  let source = { ...row, ...options.source };
  let remote = options.remote === undefined ? event() : options.remote;
  const item = { user_id: 'user', kind: 'commitment', source_id: 'item', event_id: 'event', base: options.base === undefined ? base : options.base, pending_create: false, issue: null, checked_at: '2026-10-01T00:00:00Z', ...options.item };
  const writes = [], updates = [], saves = [], releases = [], reads = [], retired = [], calls = { calendars: 0, feeds: [] };
  const store = {
    claim: async () => options.busy ? null : ({ token: 'lease', config: { calendar_id: 'calendar', time_zone: 'Australia/Melbourne', enabled: options.enabled !== false, kinds: ['commitment'], remote_seen_at: options.seen ?? null } }),
    release: async (...args) => releases.push(args), discover: async () => {},
    mappings: async () => [item], retire: async list => retired.push(...list),
    sources: async () => new Map(options.missing ? [] : [['commitment:item', source]]),
    source: async () => options.missing ? null : source,
    save: async (_, values) => { saves.push(plain(values)); Object.assign(item, values); },
    updateSource: async (_, before, values) => { if (options.race) throw new Error('This item changed in MemoValet while syncing. Please retry.'); updates.push(plain(values)); source = { ...source, ...values }; },
  };
  const api = {
    CalendarAccessError: AccessError,
    syncAccessToken: async () => 'token', writableCalendars: async () => { calls.calendars++; return options.revoked ? [] : [{ id: 'calendar' }]; },
    changedEventIds: async (token, calendar, since) => { calls.feeds.push(since); return options.feed === undefined ? null : options.feed && new Set(options.feed); },
    readGoogleEvent: async () => { reads.push('event'); return remote; },
    eventPath: (c, e) => `${c}/${e || ''}`,
    googleRequest: async (token, path, op) => {
      writes.push({ path, ...plain(op) });
      if (options.outage) throw new AccessError('Google unavailable', 503);
      if (options.precondition) throw new AccessError('Event changed', 412);
      if (op.method === 'DELETE') { remote = null; return {}; }
      remote = { id: op.body.id || 'event', etag: 'v2', ...op.body };
      return remote;
    },
  };
  const engine = compile('lib/google/calendar-sync.ts', { './calendar-sync-api': api, './calendar-sync-model': model, './calendar-sync-store': { syncStore: () => store } });
  return { run: (resolution, opts) => engine.runCalendarSync('user', resolution, opts), item, writes, updates, saves, releases, reads, retired, calls };
}
test('unchanged events do not write to Google or local work', async () => {
  const h = harness(); await h.run(); assert.equal(h.writes.length, 0); assert.equal(h.updates.length, 0);
});
test('a local edit patches only its mapped Google event with If-Match', async () => {
  const h = harness({ source: { due_at: later.at } }); await h.run();
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].method, 'PATCH'); assert.equal(h.writes[0].etag, 'v1');
});
test('a remote edit updates the source date, time and reminder', async () => {
  const h = harness({ remote: event(later) }); await h.run();
  assert.equal(h.writes.length, 0); assert.equal(h.updates[0].due_at, later.at); assert.equal(h.updates[0].reminder_at, '2026-10-10T02:45:00.000Z');
});
test('Google deletion preserves the underlying work', async () => {
  const h = harness({ remote: { id: 'event', status: 'cancelled' } }); await h.run();
  assert.equal(h.updates[0].due_at, null); assert.equal('status' in h.updates[0], false); assert.equal(h.writes.length, 0);
});
test('completion removes only the mapped event and never edits the completed task', async () => {
  const h = harness({ source: { status: 'completed' } }); await h.run();
  assert.equal(h.writes[0].method, 'DELETE'); assert.equal(h.writes[0].etag, 'v1'); assert.equal(h.updates.length, 0);
});
test('an unrelated event with a colliding ID is never touched', async () => {
  const h = harness({ remote: { ...event(), extendedProperties: { private: { memovaletOwner: 'other' } } } }); await h.run();
  assert.equal(h.writes.length, 0); assert.equal(h.updates.length, 0); assert.match(h.item.issue, /not owned/);
});
test('permission loss cannot be mistaken for deletion of all events', async () => {
  const h = harness({ revoked: true, remote: null }); await assert.rejects(h.run(), /no longer writable/);
  assert.equal(h.updates.length, 0); assert.equal(h.releases.length, 1);
});
test('conflicts retain both versions for an explicit choice', async () => {
  const h = harness({ source: { due_at: later.at }, remote: event({ ...base, title: 'Google title' }) }); await h.run();
  assert.equal(h.writes.length, 0); assert.equal(h.updates.length, 0); assert.match(h.item.issue, /both calendars/);
  assert.equal(h.item.conflict.remote.title, 'Google title');
});
test('a stale conflict decision does not overwrite newer work', async () => {
  const h = harness({ source: { due_at: later.at }, remote: event({ ...base, title: 'New Google edit' }) });
  await h.run({ kind: 'commitment', sourceId: 'item', use: 'memovalet', expected: { local: later, remote: base } });
  assert.equal(h.writes.length, 0); assert.match(h.item.issue, /both calendars/);
});
test('a concurrent local edit is not acknowledged as successfully synced', async () => {
  const h = harness({ remote: event(later), race: true }); await h.run();
  assert.deepEqual(plain(h.item.base), plain(base)); assert.match(h.item.issue, /changed in MemoValet/);
});
test('a concurrent remote edit fails its precondition and retains the previous baseline', async () => {
  const h = harness({ source: { due_at: later.at }, precondition: true }); await h.run();
  assert.deepEqual(plain(h.item.base), plain(base)); assert.match(h.item.issue, /Event changed/);
});
test('a new event reserves its payload and uses the durable event ID', async () => {
  const h = harness({ remote: null, base: null, item: { pending_create: true } }); await h.run();
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].body.id, 'event'); assert.equal(h.item.pending_create, false);
  assert.deepEqual(h.saves[0].base, plain(base));
});
test('an uncertain insert retries the same ID and saved payload', async () => {
  const h = harness({ remote: null, item: { pending_create: true }, source: { due_at: later.at } }); await h.run();
  assert.equal(h.writes[0].body.id, 'event'); assert.equal(h.writes[0].body.start.dateTime, base.at);
  assert.equal(h.writes[1].method, 'PATCH'); assert.equal(h.writes[1].body.start.dateTime, later.at);
});
test('a lost insert acknowledgement reconciles without a duplicate', async () => {
  const h = harness({ item: { pending_create: true } }); await h.run(); assert.equal(h.writes.length, 0); assert.equal(h.item.pending_create, false);
});
test('an outage preserves the baseline and releases the lease with an error', async () => {
  const h = harness({ source: { due_at: later.at }, outage: true }); await assert.rejects(h.run(), /unavailable/);
  assert.deepEqual(plain(h.item.base), plain(base)); assert.equal(h.releases.length, 1); assert.match(h.releases[0][1].last_error, /unavailable/);
});
test('a lease prevents overlapping runs and paused connections never call Google', async () => {
  const busy = harness({ busy: true }); await assert.rejects(busy.run(), /already running/);
  const paused = harness({ enabled: false }); await assert.rejects(paused.run(), /paused/); assert.equal(paused.writes.length, 0);
});

const seen = '2026-10-12T04:00:00.000Z';
test('an idle pass asks Google only what changed, from just before the last complete pass', async () => {
  const h = harness({ seen, feed: [] }); const result = await h.run();
  assert.deepEqual(h.calls.feeds, ['2026-10-12T03:58:00.000Z']);
  assert.equal(h.reads.length, 0); assert.equal(h.calls.calendars, 0); assert.equal(h.writes.length, 0);
  assert.equal(result.more, false); assert.ok(Date.parse(h.releases[0][1].remote_seen_at) > Date.parse(seen));
});
test('an event Google lists as changed is read and applied', async () => {
  const h = harness({ seen, feed: ['other', 'event'], remote: event(later) }); await h.run();
  assert.equal(h.reads.length, 1); assert.equal(h.calls.calendars, 1); assert.equal(h.updates[0].due_at, later.at);
});
test('a MemoValet edit is pushed even when Google reports no changes', async () => {
  const h = harness({ seen, feed: [], source: { due_at: later.at } }); await h.run();
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].method, 'PATCH');
});
test('without a usable change list every linked event is checked', async () => {
  const first = harness({ feed: [] }); await first.run(); assert.equal(first.calls.feeds.length, 0); assert.equal(first.reads.length, 1);
  const expired = harness({ seen, feed: null }); await expired.run(); assert.equal(expired.reads.length, 1);
});
test('problem items are retried after a while, not every minute', async () => {
  const fresh = harness({ seen, feed: [], item: { issue: 'Google is busy', checked_at: new Date().toISOString() } }); await fresh.run();
  assert.equal(fresh.reads.length, 0);
  const old = harness({ seen, feed: [], item: { issue: 'Google is busy', checked_at: '2026-10-12T03:00:00Z' } }); await old.run();
  assert.equal(old.reads.length, 1);
});
test('finished work with no Google event is forgotten without asking Google', async () => {
  const h = harness({ seen, feed: [], base: null, source: { status: 'completed' } }); await h.run();
  assert.equal(h.retired.length, 1); assert.equal(h.reads.length, 0); assert.equal(h.calls.calendars, 0);
  const pending = harness({ seen, feed: [], base: null, remote: null, item: { pending_create: true }, source: { status: 'completed' } }); await pending.run();
  assert.equal(pending.retired.length, 0);
});
test('a pass cut short keeps the change list where an unapplied Google edit may wait', async () => {
  const h = harness({ seen, feed: ['event'], item: { checked_at: '2026-10-12T03:30:00.000Z' } });
  const result = await h.run(undefined, { until: Date.now() - 1 });
  assert.equal(result.more, true); assert.equal(h.reads.length, 0);
  assert.equal(h.releases[0][1].remote_seen_at, '2026-10-12T03:30:00.000Z');
});
test('a conflict decision never moves the change list', async () => {
  const h = harness({ seen, source: { due_at: later.at }, remote: event({ ...base, title: 'Google title' }) });
  await h.run({ kind: 'commitment', sourceId: 'item', use: 'memovalet', expected: { local: later, remote: { ...base, title: 'Google title' } } });
  assert.equal(h.calls.feeds.length, 0); assert.equal('remote_seen_at' in h.releases[0][1], false); assert.equal(h.writes[0].method, 'PATCH');
});
test('the change list pages through Google and gives up when too much changed', async () => {
  const urls = [];
  const pages = [{ items: [{ id: 'a' }], nextPageToken: 'p2' }, { items: [{ id: 'b' }] }];
  const api = compile('lib/google/calendar-sync-api.ts', { '@/lib/google/tokens': {} }, { fetch: async url => { urls.push(String(url)); return Response.json(pages.shift()); } });
  assert.deepEqual([...await api.changedEventIds('token', 'cal', seen)], ['a', 'b']);
  const query = new URL(urls[0]).searchParams;
  assert.equal(query.get('updatedMin'), seen); assert.equal(query.get('showDeleted'), 'true'); assert.equal(new URL(urls[1]).searchParams.get('pageToken'), 'p2');
  const endless = compile('lib/google/calendar-sync-api.ts', { '@/lib/google/tokens': {} }, { fetch: async () => Response.json({ items: [{ id: 'x' }], nextPageToken: 'more' }) });
  assert.equal(await endless.changedEventIds('token', 'cal', seen), null);
  const expired = compile('lib/google/calendar-sync-api.ts', { '@/lib/google/tokens': {} }, { fetch: async () => new Response(null, { status: 410 }) });
  assert.equal(await expired.changedEventIds('token', 'cal', seen), null);
});
test('the background run serves many customers in parallel and isolates failures', async () => {
  const users = Array.from({ length: 12 }, (_, i) => `user-${i}`);
  let active = 0, peak = 0; const ran = [];
  const query = { select() { return query; }, eq() { return query; }, lte() { return query; }, order() { return query; }, limit(n) { assert.equal(n, 60); return Promise.resolve({ data: users.map(user_id => ({ user_id })), error: null }); } };
  const route = compile('app/api/calendar/google/dispatch/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/service': { createServiceClient: () => ({ from: () => query, rpc: async () => ({ data: true, error: null }) }) },
    '@/lib/google/calendar-sync-auth': { calendarSyncAvailable: () => true },
    '@/lib/scheduler-auth': compile('lib/scheduler-auth.ts'),
    '@/lib/google/calendar-sync': { runCalendarSync: async (userId, resolution, options) => {
      assert.equal(resolution, undefined); assert.ok(options.until > Date.now());
      active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; ran.push(userId);
      if (userId === 'user-3') throw new Error('Google denied access');
    } },
  }, { setTimeout, Promise, Array, Math, process: { env: { CRON_SECRET: 'secret' } } });
  const response = await route.GET(new Request('https://memovalet.com/api/calendar/google/dispatch', { headers: { authorization: 'Bearer secret' } }));
  assert.deepEqual(await response.json(), { synced: 11, failed: 1, waiting: 0 });
  assert.equal(ran.length, 12); assert.equal(peak, 5);
});
test('new work is linked by one database call', async () => {
  const rpcs = [];
  const store = compile('lib/google/calendar-sync-store.ts', {
    '@/lib/supabase/service': { createServiceClient: () => ({ rpc: async (name, args) => { rpcs.push([name, args]); return { data: 3, error: null }; } }) }, './calendar-sync-model': model,
  }).syncStore('owner');
  await store.discover(['commitment', 'project']);
  assert.deepEqual(plain(rpcs), [['reserve_calendar_sync_items', { p_user: 'owner', p_kinds: ['commitment', 'project'] }]]);
});

test('calendar access refuses an old read-only token and permits exact new scopes', async () => {
  let scope = 'https://www.googleapis.com/auth/calendar.readonly';
  const api = compile('lib/google/calendar-sync-api.ts', { '@/lib/google/tokens': { getStoredGoogleRefreshTokenService: async () => 'refresh' } }, {
    fetch: async () => Response.json({ access_token: 'access', scope }),
  });
  await assert.rejects(api.syncAccessToken('user'), /allow calendar updates/);
  scope = api.CALENDAR_SCOPES.join(' ');
  assert.equal(await api.syncAccessToken('user'), 'access');
});
test('calendar API requests encode IDs and preserve ETags without logging provider errors', async () => {
  const requests = [];
  const api = compile('lib/google/calendar-sync-api.ts', { '@/lib/google/tokens': {} }, {
    fetch: async (url, init) => { requests.push({ url, init }); return new Response(null, { status: 412 }); },
  });
  const path = api.eventPath('owner@example.com/a', 'id/b');
  assert.equal(path, 'calendars/owner%40example.com%2Fa/events/id%2Fb');
  await assert.rejects(api.googleRequest('token', path, { method: 'PATCH', etag: 'etag', body: { summary: 'Title' } }), /changed while syncing/);
  assert.equal(requests[0].init.headers['If-Match'], 'etag');
});
test('calendar list pagination filters out read-only calendars', async () => {
  const pages = [
    { items: [{ id: 'own', accessRole: 'owner', summary: 'Mine' }, { id: 'read', accessRole: 'reader' }], nextPageToken: 'next' },
    { items: [{ id: 'shared', accessRole: 'writer', summary: 'Shared' }] },
  ];
  const api = compile('lib/google/calendar-sync-api.ts', { '@/lib/google/tokens': {} }, { fetch: async () => Response.json(pages.shift()) });
  assert.deepEqual(plain(await api.writableCalendars('token')).map(c => c.id), ['own', 'shared']);
});
test('API authentication rejects signed out, incomplete MFA and cross-site writes', async () => {
  let user = null, assurance = { currentLevel: 'aal1', nextLevel: 'aal2' };
  const guard = compile('lib/google/calendar-sync-auth.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: assurance }) } } }) },
    './calendar-sync-api': { CalendarAccessError: AccessError },
  });
  await assert.rejects(guard.calendarSyncUser(new Request('https://memovalet.com/api/calendar/google')), /Sign in/);
  user = { id: 'user' };
  await assert.rejects(guard.calendarSyncUser(new Request('https://memovalet.com/api/calendar/google')), /two step/);
  assurance = { currentLevel: 'aal2', nextLevel: 'aal2' };
  assert.equal((await guard.calendarSyncUser(new Request('https://memovalet.com/api/calendar/google'))).id, 'user');
  await assert.rejects(guard.calendarSyncUser(new Request('https://memovalet.com/api/calendar/google', { method: 'POST', headers: { origin: 'https://attacker.test' } })), /from your MemoValet/);
});
test('source updates are scoped to owner and every field from the earlier read', async () => {
  const filters = [];
  const query = { update() { return query; }, eq(k,v) { filters.push(['eq',k,v]); return query; }, is(k,v) { filters.push(['is',k,v]); return query; }, select() { return query; }, then(fn) { return Promise.resolve({ data: [{ id: 'item' }], error: null }).then(fn); } };
  const store = compile('lib/google/calendar-sync-store.ts', {
    '@/lib/supabase/service': { createServiceClient: () => ({ from: () => query }) }, './calendar-sync-model': model,
  }).syncStore('owner');
  await store.updateSource({ kind: 'commitment', source_id: 'item' }, { ...row, reminder_at: null }, { due_at: later.at });
  assert.ok(filters.some(([op,k,v]) => op==='eq' && k==='user_id' && v==='owner'));
  assert.ok(filters.some(([op,k,v]) => op==='eq' && k==='id' && v==='item'));
  assert.ok(filters.some(([op,k,v]) => op==='eq' && k==='due_at' && v===row.due_at));
  assert.ok(filters.some(([op,k,v]) => op==='is' && k==='reminder_at' && v===null));
});
