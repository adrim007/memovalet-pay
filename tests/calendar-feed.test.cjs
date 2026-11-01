// The calendar link: MemoValet's tasks, deadlines and calls, as a calendar
// file Google Calendar and Apple Calendar subscribe to. Two things matter
// most: the file must be one every calendar app reads (RFC 5545), and a link
// must only ever show the person it belongs to.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function load(file, seen = {}) {
  if (seen[file]) return seen[file].exports;
  const module = { exports: {} };
  seen[file] = module;
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const requireLocal = (spec) => {
    if (spec.startsWith('./')) return load(path.join(path.dirname(file), `${spec}.ts`), seen);
    throw new Error(`unexpected import ${spec}`);
  };
  vm.runInNewContext(source, { exports: module.exports, module, require: requireLocal, TextEncoder, Date, Math, Number, Array, encodeURIComponent });
  return module.exports;
}
const { buildCalendarFeed, feedEvents, fold, escapeText, FEED_TOKEN } = load('lib/calendar-feed.ts');

const SITE = 'https://memovalet.com';
const none = { commitments: [], projects: [], actionItems: [], sentTasks: [], calls: [] };
const feed = (rows) => buildCalendarFeed(feedEvents({ ...none, ...rows }, SITE), { now: new Date('2026-10-01T00:00:00Z') });
const unfold = (text) => text.replace(/\r\n /g, '');

test('a task with a time is an event at that time; one with only a day fills the day', () => {
  const text = unfold(feed({
    commitments: [
      { id: 'a', description: 'Send the proposal tomorrow at 10am', direction: 'i_owe', person_name: null, due_date: '2026-10-01', due_at: '2026-10-01T00:00:00.000Z', priority: 'high' },
      { id: 'b', description: 'Book the plumber', direction: 'i_owe', person_name: null, due_date: '2026-10-31', due_at: null, priority: null },
    ],
  }));
  assert.match(text, /UID:commitment-a@memovalet\.com\r\nDTSTAMP:20261001T000000Z\r\nDTSTART:20261001T000000Z\r\nDTEND:20261001T003000Z/);
  assert.match(text, /SUMMARY:Send the proposal tomorrow at 10am\r\n/);
  assert.match(text, /PRIORITY:1\r\n/);
  // A whole day ends at the start of the next (here, into November).
  assert.match(text, /DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101\r\nTRANSP:TRANSPARENT/);
});

test('promises read the way Needs you says them, and every kind of item has its place', () => {
  const text = unfold(feed({
    commitments: [
      { id: 'c', description: 'Signed contract', direction: 'they_owe', person_name: 'Sarah', due_date: '2026-10-02', priority: 'low' },
      { id: 'd', description: 'Send updated pricing', direction: 'i_owe', person_name: 'James', due_date: '2026-10-02', priority: 'medium' },
    ],
    projects: [{ id: 'p', name: 'Kitchen renovation', due_date: '2026-11-20' }],
    actionItems: [{ id: 'i', task: 'Send the deck', due_date: '2026-10-03' }],
    sentTasks: [{ id: 's', title: 'Install kitchen splashback', recipient_email: 'sam@tiling.example', due_date: '2026-10-02' }],
    calls: [{ id: 'l', title: 'Client sync', scheduled_start: '2026-10-05T03:00:00.000Z', duration_minutes: 45 }],
  }));
  assert.match(text, /SUMMARY:Sarah owes you: Signed contract/);
  assert.match(text, /SUMMARY:You promised James: Send updated pricing/);
  assert.match(text, /PRIORITY:9\r\n/);
  assert.match(text, /PRIORITY:5\r\n/);
  assert.match(text, /SUMMARY:Project deadline: Kitchen renovation/);
  assert.match(text, /SUMMARY:Send the deck/);
  assert.match(text, /SUMMARY:Sent to sam@tiling\.example: Install kitchen splashback/);
  assert.match(text, /DTSTART:20261005T030000Z\r\nDTEND:20261005T034500Z\r\nSUMMARY:Client sync/);
  assert.match(text, /URL:https:\/\/memovalet\.com\/live\/l/);
  // Each item once, each with its own id.
  const uids = [...text.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
  assert.equal(uids.length, 6);
  assert.equal(new Set(uids).size, 6);
});

test('items without a usable date are left out, not guessed', () => {
  const text = feed({
    commitments: [{ id: 'x', description: 'Someday', direction: 'i_owe', person_name: null, due_date: null }],
    calls: [{ id: 'y', title: 'Unscheduled', scheduled_start: 'not a date', duration_minutes: null }],
  });
  assert.doesNotMatch(text, /BEGIN:VEVENT/);
});

test('the file is one every calendar app reads', () => {
  const text = feed({
    commitments: [{
      id: 'long', direction: 'i_owe', person_name: null, due_date: '2026-10-01',
      description: 'Call the builder; ask about tiles, grout and the splashback\nthen book the plumber — and confirm the café booking 🎉 for Friday afternoon, please',
    }],
  });
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.doesNotMatch(text.replace(/\r\n/g, ''), /\n/, 'every line ends CRLF');
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `too long: ${line}`);
  assert.match(text, /X-WR-CALNAME:MemoValet/);
  // Commas, semicolons and line breaks are escaped; folding never splits a character.
  const summary = unfold(text).match(/SUMMARY:(.*)\r\n/)[1];
  assert.equal(summary, escapeText('Call the builder; ask about tiles, grout and the splashback\nthen book the plumber — and confirm the café booking 🎉 for Friday afternoon, please'));
  assert.ok(!unfold(text).includes('�'));
  assert.equal(fold('short'), 'short');
});

test('a link is 32 random bytes, and nothing else gets through', () => {
  for (let i = 0; i < 20; i++) assert.match(crypto.randomBytes(32).toString('base64url'), FEED_TOKEN);
  for (const bad of ['', 'abc', '../etc/passwd', `${'a'.repeat(43)}.ics`, 'a'.repeat(44), `${'a'.repeat(42)}=`]) assert.doesNotMatch(bad, FEED_TOKEN);
  const data = fs.readFileSync('lib/calendar-feed-data.ts', 'utf8');
  assert.match(data, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(data, /if \(!FEED_TOKEN\.test\(token\)\) return null;/);
});

test('every read behind a link names its owner (the service role skips row level security)', () => {
  const data = fs.readFileSync('lib/calendar-feed-data.ts', 'utf8');
  const owners = { commitments: 'user_id', projects: 'created_by', action_items: 'user_id', task_assignments: 'created_by', live_sessions: 'created_by' };
  for (const [table, owner] of Object.entries(owners)) {
    const at = data.indexOf(`db.from("${table}")`);
    assert.ok(at > 0, `${table} is read`);
    const statement = data.slice(at, data.indexOf('.limit(', at));
    assert.ok(statement.includes(`.eq("${owner}", userId)`), `${table} is filtered to its owner by ${owner}`);
  }
  // The link table itself is only reached by the server: RLS on, no policies.
  const migration = fs.readdirSync('supabase/migrations').find((f) => f.endsWith('calendar_links.sql'));
  assert.ok(migration, 'the migration exists');
  const sql = fs.readFileSync(path.join('supabase/migrations', migration), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /create policy/i);
});

test('the Calendar page offers it, and signed-out requests can only read a link', () => {
  assert.match(fs.readFileSync('components/WorkCalendar.tsx', 'utf8'), /<CalendarSync /);
  const manage = fs.readFileSync('app/api/calendar/feed/route.ts', 'utf8');
  for (const verb of ['GET', 'POST', 'DELETE']) {
    const at = manage.indexOf(`export async function ${verb}`);
    assert.ok(at >= 0, verb);
    assert.match(manage.slice(at, at + 260), /if \(!user\) return NextResponse\.json\(\{ error: "Sign in required" \}, \{ status: 401/, `${verb} needs a signed-in person`);
  }
  const link = fs.readFileSync('app/api/calendar/feed/[token]/route.ts', 'utf8');
  assert.match(link, /status: 404/);
  assert.match(link, /text\/calendar; charset=utf-8/);
  assert.doesNotMatch(link, /export async function (POST|PUT|PATCH|DELETE)/);
});
