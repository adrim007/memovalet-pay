const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, Date, Intl, URL, AbortSignal,
    console: { error() {} },
    require: name => name in mocks ? mocks[name] : name.startsWith('@/') ? compile(name.slice(2) + '.ts', mocks) : require(name),
  });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const calendar = compile('lib/work-calendar.ts');

function db(fixtures = {}, failures = []) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [], order: [] };
      calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return this; },
        gte(...args) { call.filters.push(['gte', ...args]); return this; },
        lt(...args) { call.filters.push(['lt', ...args]); return this; },
        eq(...args) { call.filters.push(['eq', ...args]); return this; },
        order(column) { call.order.push(column); return this; },
        range(start, end) { call.range = [start, end]; return this; },
        abortSignal() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: (fixtures[table] || []).slice(call.range[0], call.range[1] + 1), error: failures.includes(table) ? new Error('unavailable') : null }).then(resolve, reject); },
      };
      return query;
    },
  };
}
const { getWorkCalendar } = compile('lib/work-calendar-data.ts');

test('month boundaries include UTC extremes, December rollover and leap day', () => {
  const range = calendar.monthRange('2026-12');
  assert.equal(range.next, '2027-01-01');
  assert.equal(range.start, '2026-11-30T10:00:00.000Z');
  assert.equal(range.end, '2027-01-01T14:00:00.000Z');
  const leap = calendar.calendarDays('2024-02');
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap[3], '2024-02-01');
  assert.equal(leap.length % 7, 0);
  assert.equal(calendar.shiftMonth('2026-01', -1), '2025-12');
});

test('rejects malformed and unbounded month queries', () => {
  for (const month of ['', '2026-00', '2026-13', '2026-1', '0000-01', '2200-01', '2026-09-01']) assert.throws(() => calendar.monthRange(month));
});

test('changing month or year preserves the day and clamps short months and leap years', () => {
  assert.equal(calendar.dateInMonth('2026-01-31', '2026-02'), '2026-02-28');
  assert.equal(calendar.dateInMonth('2026-01-31', '2024-02'), '2024-02-29');
  assert.equal(calendar.dateInMonth('2024-02-29', '2025-02'), '2025-02-28');
  assert.equal(calendar.dateInMonth('2026-09-14', '2020-12'), '2020-12-14');
  assert.throws(() => calendar.dateInMonth('2026-09-14', '2200-01'));
});

test('Auckland and western timezones place the same saved work on different dates', () => {
  const date = new Date('2026-09-30T12:30:00Z');
  assert.equal(calendar.dateKey(date, 'Pacific/Auckland'), '2026-10-01');
  assert.equal(calendar.dateKey(date, 'America/Los_Angeles'), '2026-09-30');
});

test('month query reopens each exact source and preserves completed task history', async () => {
  const client = db({
    notes: [{ id: 'n1', title: null, body: 'First line\nNext line', created_at: '2026-09-01T01:00:00Z' }],
    documents: [{ id: 'd1', title: 'Brief', created_at: '2026-09-02T00:00:00Z' }],
    meetings: [{ id: 'm1', title: 'Review', created_at: '2026-09-01T02:00:00Z' }],
    action_items: [{ id: 't1', task: 'Send brief', due_date: '2026-09-01', status: 'done' }],
    task_assignments: [{ id: 'a1', title: 'Assigned task', due_date: '2026-09-05', status: 'pending' }],
    live_sessions: [{ id: 'l1', title: 'Call', scheduled_start: '2026-09-21T08:00:00Z', status: 'ended', meeting_id: 'm2' }],
  });
  const result = await getWorkCalendar(client, 'owner', '2026-09', 'America/Los_Angeles');
  const items = Object.fromEntries(result.entries.map(entry => [entry.id, entry]));
  assert.equal(items['notes:n1'], undefined, 'UTC first day is still August in this timezone');
  assert.equal(items['action_items:t1'].date, '2026-09-01');
  assert.equal(items['action_items:t1'].completed, true);
  assert.equal(items['action_items:t1'].href, '/tasks?task=t1#task-t1');
  assert.equal(items['documents:d1'].href, '/documents?document=d1');
  assert.equal(items['task_assignments:a1'].href, '/assigned/a1');
  assert.equal(items['live_sessions:l1'].href, '/history/m2');
  const utc = await getWorkCalendar(client, 'owner', '2026-09', 'UTC');
  assert.equal(utc.entries.find(entry => entry.id === 'notes:n1').href, '/notes?note=n1#note-n1');
  assert.equal(utc.entries.find(entry => entry.id === 'notes:n1').title, 'First line');
  assert.equal(utc.entries.find(entry => entry.id === 'meetings:m1').href, '/history/m1');
  assert.deepEqual(plain(result.warnings), []);
});

test('owner filters and date-only query bounds are applied without bypassing RLS', async () => {
  const client = db();
  await getWorkCalendar(client, 'owner', '2026-09', 'Pacific/Auckland');
  for (const table of ['documents', 'task_assignments', 'live_sessions']) {
    const call = client.calls.find(call => call.table === table);
    assert.ok(call.filters.some(filter => filter[0] === 'eq' && filter[2] === 'owner'));
  }
  const action = client.calls.find(call => call.table === 'action_items');
  assert.deepEqual(action.filters, [['gte', 'due_date', '2026-09-01'], ['lt', 'due_date', '2026-10-01']]);
  assert.deepEqual(action.order, ['due_date', 'id']);
});

test('older work is paginated instead of silently truncated at the Library limit', async () => {
  const client = db({ notes: Array.from({ length: 503 }, (_, id) => ({ id: String(id), body: 'note', created_at: '2020-02-14T12:00:00Z' })) });
  const result = await getWorkCalendar(client, 'owner', '2020-02', 'UTC');
  assert.equal(result.entries.length, 503);
  assert.equal(client.calls.filter(call => call.table === 'notes').length, 2);
});

test('failed sources retain successful work and explicitly warn that the view is incomplete', async () => {
  const client = db({ documents: [{ id: 'd1', title: 'File', created_at: '2026-09-03T12:00:00Z' }] }, ['notes']);
  const result = await getWorkCalendar(client, 'owner', '2026-09', 'UTC');
  assert.equal(result.entries.length, 1);
  assert.match(result.warnings[0], /Notes.*could not/);
});

test('invalid timestamps are skipped and open calls link to their room', async () => {
  const result = await getWorkCalendar(db({ live_sessions: [
    { id: 'l1', title: 'Call', scheduled_start: '2026-09-21T08:00:00Z', status: 'active' },
    { id: 'l2', title: 'Invalid', scheduled_start: 'not-a-date' },
  ] }), 'owner', '2026-09', 'UTC');
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].href, '/live/l1');
});

function route(user, callback = async () => ({ entries: [], warnings: [] })) {
  return compile('app/api/calendar/work/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/work-calendar-data': { getWorkCalendar: callback },
  }).GET;
}

test('work calendar requires authentication before reading work', async () => {
  let reads = 0;
  const result = await route(null, async () => { reads++; })(new Request('https://example.com/api/calendar/work?month=2026-09'));
  assert.equal(result.status, 401);
  assert.equal(reads, 0);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
});

test('work calendar rejects invalid timezone and range; passes user identity to data loader', async () => {
  let args;
  const get = route({ id: 'me' }, async (...values) => { args = values; return { entries: [], warnings: [] }; });
  assert.equal((await get(new Request('https://example.com/api/calendar/work?month=2026-13'))).status, 400);
  assert.equal((await get(new Request('https://example.com/api/calendar/work?month=2026-09&timeZone=Nowhere'))).status, 400);
  assert.equal((await get(new Request('https://example.com/api/calendar/work?month=2026-09&timeZone=Pacific%2FAuckland'))).status, 200);
  assert.deepEqual(args.slice(1), ['me', '2026-09', 'Pacific/Auckland']);
});

test('server failure is an error, never an empty successful calendar', async () => {
  const result = await route({ id: 'me' }, async () => { throw new Error('offline'); })(new Request('https://example.com/api/calendar/work?month=2026-09'));
  assert.equal(result.status, 500);
  assert.match(result.body.error, /could not be loaded/);
});

test('task status succeeds only when an accessible row was actually updated', async () => {
  for (const [result, expected] of [[{ data: { id: 't1' }, error: null }, true], [{ data: null, error: null }, false], [{ data: null, error: new Error('offline') }, false]]) {
    const calls = [];
    const query = {
      update(value) { calls.push(value); return this; },
      eq(column, id) { assert.equal(column, 'id'); assert.equal(id, 't1'); return this; },
      select(value) { assert.equal(value, 'id'); return this; },
      async maybeSingle() { return result; },
    };
    const { updateActionItemStatus } = compile('lib/database.ts', {
      './supabase/server': { createClient: async () => ({ from: () => query }) },
      './supabase/service': {},
    });
    assert.equal(await updateActionItemStatus('t1', 'done'), expected);
    assert.equal(calls[0].status, 'done');
    assert.ok(calls[0].completed_at);
  }
});

test('deep-link lookup uses the authenticated client, handles deletion and surfaces read failures', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  let reads = 0;
  let result = { data: { id }, error: null };
  const { calendarSourceItem } = compile('lib/calendar-source-item.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ from(table) {
      assert.equal(table, 'notes'); reads++;
      return { select: () => ({ eq: (column, value) => {
        assert.equal(column, 'id'); assert.equal(value, id);
        return { maybeSingle: async () => result };
      } }) };
    } }) },
  });
  assert.equal(await calendarSourceItem('notes', 'invalid'), null);
  assert.equal(reads, 0);
  assert.equal((await calendarSourceItem('notes', id)).id, id);
  result = { data: null, error: null };
  assert.equal(await calendarSourceItem('notes', id), null);
  result = { data: null, error: new Error('offline') };
  await assert.rejects(calendarSourceItem('notes', id), /Couldn't reopen/);
});

test('personal tasks and project deadlines retain exact times and reopen their source', async () => {
  const result = await getWorkCalendar(db({
    commitments: [{id:'c1', description:'Call Sam', direction:'i_owe',due_date:'2026-10-01',due_at:'2026-09-30T22:00:00Z',status:'pending'}],
    projects: [{id:'p1',name:'Launch',due_date:'2026-09-30',due_at:null,status:'completed'}],
  }), 'owner','2026-09','America/Los_Angeles');
  const task = result.entries.find(e=>e.id==='commitments:c1');
  assert.equal(task.date,'2026-09-30');
  assert.equal(task.at,'2026-09-30T22:00:00Z');
  assert.equal(task.href,'/tasks?tab=i-owe#commitment-c1');
  const project = result.entries.find(e=>e.id==='projects:p1');
  assert.equal(project.date,'2026-09-30');
  assert.equal(project.at,undefined);
  assert.equal(project.kind,'project');
  assert.equal(project.completed,true);
  assert.equal(project.href,'/projects/p1');
});
