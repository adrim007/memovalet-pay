const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
const taskId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
function compile(file, mocks) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module: mod, exports: mod.exports, Date, Intl, console, AbortSignal, URL, process,
    require: name => name in mocks ? mocks[name] : name.startsWith("@/") ? compile(name.slice(2) + ".ts", mocks) : require(name) });
  return mod.exports;
}
function setup() {
  const state = { signedIn: true, denied: null, fail: null, race: false, writes: [],
    meetings: [{ id: "source", user_id: "owner", title: "Launch review", created_at: "2090-10-01T12:00:00Z" }],
    action_items: [{ id: taskId, meeting_id: "source", user_id: "owner", task: "Send the brief", owner: "Priya", due_date: null, status: "done", priority: "high" }],
    live_sessions: [] };
  const db = { auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: "owner" } : null } }) },
    from(table) {
      let op = "select", payload, filter = [], cap = Infinity;
      const query = {
        select() { return query; }, eq(key, value) { filter.push(row => row[key] === value); return query; },
        gte(key, value) { filter.push(row => row[key] != null && row[key] >= value); return query; },
        lt(key, value) { filter.push(row => row[key] != null && row[key] < value); return query; },
        lte(key, value) { filter.push(row => row[key] != null && row[key] <= value); return query; },
        order() { return query; }, limit(n) { cap = n; return query; },
        range() { return query; }, abortSignal() { return query; },
        update(value) { op = "update"; payload = value; return query; },
        insert(value) { op = "insert"; payload = value; return query; },
        maybeSingle() { return exec(true); }, single() { return exec(true); },
        then(ok, bad) { return exec(false).then(ok, bad); }
      };
      async function exec(single) {
        if (state.fail === table + ":" + op) return { error: { code: "failure" }, data: null };
        let rows = (state[table] || []).filter(row => filter.every(check => check(row))).slice(0, cap);
        if (op === "insert") {
          if (state.race) {
            state.live_sessions.push({ ...payload }); state.race = false;
            return { error: { code: "23505" }, data: null };
          }
          if (state[table].some(row => row.id === payload.id)) return { error: { code: "23505" }, data: null };
          rows = [{ ...(table === "live_sessions" ? { status: "active" } : {}), ...payload }]; state[table].push(rows[0]); state.writes.push({ table, payload });
        } else if (op === "update") {
          rows.forEach(row => Object.assign(row, payload)); state.writes.push({ table, payload });
        }
        return { error: null, data: single ? rows[0] || null : rows };
      }
      return query;
    }
  };
  const mocks = {
    "next/server": { NextResponse: { json: (body, opts) => ({ body, status: opts.status, headers: opts.headers }) } },
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/plan-access": { featureError: async () => state.denied }
  };
  const routes = compile("app/api/meetings/[id]/follow-through/route.ts", mocks);
  const context = { params: Promise.resolve({ id: "source" }) };
  const post = (body, origin = "http://localhost:3000") => routes.POST({
    url: "http://localhost:3000/api/meetings/source/follow-through",
    headers: new Headers(origin ? { origin } : {}), json: async () => body
  }, context);
  const task = { kind: "task", confirmed: true, taskId, owner: "Alex", dueDate: "2090-10-20" };
  const meeting = { kind: "meeting", confirmed: true, requestId, title: "Launch follow-up",
    date: "2090-10-22", time: "15:00", timeZone: "Australia/Melbourne", durationMinutes: 30 };
  return { state, db, mocks, routes, context, post, task, meeting };
}

test("loads only the owner's stored tasks and never caches private data", async () => {
  const s = setup();
  s.state.action_items.push({ ...s.state.action_items[0], id: "other", user_id: "other" });
  const result = await s.routes.GET({}, s.context);
  assert.equal(result.status, 200); assert.equal(result.body.tasks.length, 1);
  assert.equal(result.headers["Cache-Control"], "private, no-store");
});

test("signed-out and non-owner reads/writes are rejected", async () => {
  const s = setup(); s.state.signedIn = false;
  assert.equal((await s.routes.GET({}, s.context)).status, 401);
  assert.equal((await s.post(s.task)).status, 401);
  s.state.signedIn = true; s.state.meetings[0].user_id = "someone-else";
  assert.equal((await s.routes.GET({}, s.context)).status, 404);
  assert.equal((await s.post(s.meeting)).status, 404); assert.equal(s.state.writes.length, 0);
});

test("requires same-origin requests and explicit confirmation", async () => {
  const s = setup();
  assert.equal((await s.post(s.task, "https://elsewhere.example")).status, 403);
  assert.equal((await s.post({ ...s.task, confirmed: false })).status, 400);
  assert.equal((await s.post(null)).status, 400); assert.equal(s.state.writes.length, 0);
});

test("updates the existing task and preserves its completion, text, priority and source", async () => {
  const s = setup(); const result = await s.post(s.task);
  assert.equal(result.status, 200);
  const row = s.state.action_items[0];
  assert.equal(row.owner, "Alex"); assert.equal(row.due_date, "2090-10-20");
  assert.equal(row.status, "done"); assert.equal(row.task, "Send the brief");
  assert.equal(row.priority, "high"); assert.equal(row.meeting_id, "source");
  assert.equal(s.state.action_items.length, 1);
  assert.deepEqual(Object.keys(s.state.writes[0].payload).sort(), ["due_date", "owner"]);
});

test("clearing a deadline is supported; invalid calendar dates are not", async () => {
  const s = setup();
  assert.equal((await s.post({ ...s.task, dueDate: "2090-02-30" })).status, 400);
  assert.equal((await s.post({ ...s.task, dueDate: "tomorrow" })).status, 400);
  assert.equal((await s.post({ ...s.task, owner: "a".repeat(121) })).status, 400);
  assert.equal(s.state.writes.length, 0);
  assert.equal((await s.post({ ...s.task, dueDate: "", owner: " " })).status, 200);
  assert.equal(s.state.action_items[0].due_date, null); assert.equal(s.state.action_items[0].owner, null);
});

test("cannot edit a task from another meeting or another user; zero rows is not success", async () => {
  const s = setup(); s.state.action_items[0].meeting_id = "different";
  assert.equal((await s.post(s.task)).status, 404);
  s.state.action_items[0].meeting_id = "source"; s.state.action_items[0].user_id = "other";
  assert.equal((await s.post(s.task)).status, 404);
  assert.equal(s.state.action_items[0].owner, "Priya");
});

test("database failures are reported rather than labelled saved", async () => {
  const s = setup(); s.state.fail = "action_items:update";
  assert.equal((await s.post(s.task)).status, 500);
  assert.equal(s.state.action_items[0].owner, "Priya");
  s.state.fail = "action_items:select"; assert.equal((await s.routes.GET({}, s.context)).status, 500);
  s.state.fail = "live_sessions:insert"; assert.equal((await s.post(s.meeting)).status, 500);
  assert.equal(s.state.live_sessions.length, 0);
});

test("meeting validation handles past time, missing time, timezone, duration and plan restrictions", async () => {
  const s = setup();
  for (const change of [{ date: "2000-01-01" }, { time: "" }, { timeZone: "Invalid" },
    { timeZone: "" }, { durationMinutes: 0 }, { durationMinutes: 30.5 }, { title: "" }, { requestId: "bad" }]) {
    assert.equal((await s.post({ ...s.meeting, ...change })).status, 400, JSON.stringify(change));
  }
  s.state.denied = "Hosting is unavailable on this plan.";
  assert.equal((await s.post(s.meeting)).status, 402); assert.equal(s.state.live_sessions.length, 0);
});

test("stores the timezone-correct follow-up and retries without creating another session", async () => {
  const s = setup(); const first = await s.post(s.meeting);
  assert.equal(first.status, 200);
  assert.equal(s.state.live_sessions[0].scheduled_start, "2090-10-22T04:00:00.000Z");
  assert.equal(s.state.live_sessions[0].created_by, "owner");
  assert.equal(s.state.live_sessions[0].meeting_id, undefined);
  const retry = await s.post(s.meeting); assert.equal(retry.status, 200); assert.equal(retry.body.reused, true);
  assert.equal(s.state.live_sessions.length, 1);
  assert.equal((await s.post({ ...s.meeting, title: "Different" })).status, 409);
});

test("parallel save collision recovers the matching session instead of duplicating it", async () => {
  const s = setup(); s.state.race = true;
  const result = await s.post(s.meeting);
  assert.equal(result.status, 200); assert.equal(result.body.reused, true); assert.equal(s.state.live_sessions.length, 1);
});

test("saved task and follow-up are consumed by the existing Calendar reader", async () => {
  const s = setup(); await s.post(s.task); await s.post(s.meeting);
  const { getWorkCalendar } = compile("lib/work-calendar-data.ts", s.mocks);
  const calendar = await getWorkCalendar(s.db, "owner", "2090-10", "Australia/Melbourne");
  assert.equal(calendar.warnings.length, 0);
  const task = calendar.entries.find(row => row.id === "action_items:" + taskId);
  const meeting = calendar.entries.find(row => row.id === "live_sessions:" + requestId);
  assert.equal(task.date, "2090-10-20"); assert.equal(task.completed, true);
  assert.equal(meeting.date, "2090-10-22"); assert.equal(meeting.at, "2090-10-22T04:00:00.000Z");
  assert.equal(meeting.href, "/live/" + requestId);
  const { getUpcomingMemoValetSessions } = compile("lib/upcoming-sessions.ts", s.mocks);
  const home = await getUpcomingMemoValetSessions(s.db, "owner", new Date("2090-10-20T00:00:00Z"));
  assert.equal(home.events.length, 1);
  assert.equal(home.events[0].meetLink, "/live/" + requestId);
  assert.equal(home.events[0].start, meeting.at);
});

