const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript"), fs = require("node:fs"), vm = require("node:vm");
function compile(file, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module, exports: module.exports, Date, console: { error() {} },
    require: name => mocks[name] ?? require(name) });
  return module.exports;
}
function database(rows, failure = false) {
  const calls = [];
  const db = { from(table) {
    assert.equal(table, "live_sessions");
    const filters = []; let limit = Infinity, sort;
    const query = {
      select() { return query; },
      eq(key, value) { calls.push(["eq",key,value]); filters.push(row => row[key] === value); return query; },
      gte(key, value) { calls.push(["gte",key,value]); filters.push(row => row[key] >= value); return query; },
      lte(key, value) { calls.push(["lte",key,value]); filters.push(row => row[key] <= value); return query; },
      order(key) { sort=key; return query; },
      limit(value) { limit=value; calls.push(["limit",value]); return query; },
      then(ok, bad) {
        let found=rows.filter(row=>filters.every(f=>f(row)));
        if(sort) found=found.sort((a,b)=>a[sort].localeCompare(b[sort]));
        return Promise.resolve({data:failure?null:found.slice(0,limit),error:failure?{}:null}).then(ok,bad);
      }
    }; return query;
  }};
  return { db, calls };
}
const { getUpcomingMemoValetSessions } = compile("lib/upcoming-sessions.ts", {});
const now = new Date("2090-10-20T00:00:00Z");
const row = {id:"one",created_by:"owner",status:"active",title:"Launch follow-up",scheduled_start:"2090-10-22T04:00:00.000Z",duration_minutes:30};

test("Home receives only owned, active calls in the next seven days with real join links", async () => {
  const {db,calls}=database([row,{...row,id:"other",created_by:"other"},{...row,id:"ended",status:"ended"},
    {...row,id:"past",scheduled_start:"2090-10-19T00:00:00Z"},{...row,id:"later",scheduled_start:"2090-11-01T00:00:00Z"}]);
  const result=await getUpcomingMemoValetSessions(db,"owner",now);
  assert.equal(result.events.length,1); assert.equal(result.incomplete,false);
  assert.equal(result.events[0].title,"Launch follow-up");
  assert.equal(result.events[0].meetLink,"/live/one");
  assert.equal(result.events[0].end,"2090-10-22T04:30:00.000Z");
  assert.ok(calls.some(c=>c[0]==="limit"&&c[1]===101));
});

test("bounded Home results disclose truncation, and database failures are not empty success", async () => {
  const rows=Array.from({length:101},(_,i)=>({...row,id:String(i)}));
  const result=await getUpcomingMemoValetSessions(database(rows).db,"owner",now);
  assert.equal(result.events.length,100); assert.equal(result.incomplete,true);
  await assert.rejects(getUpcomingMemoValetSessions(database([],true).db,"owner",now),/Couldn't load/);
});

function routeSetup({signedIn=true,googleFails=false,memoFails=false}={}) {
  let read=0;
  const mocks={
    "next/server":{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},
    "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:"owner"}:null}})}})},
    "@/lib/google/calendar":{getUpcomingMeetingEvents:async id=>{read++;assert.equal(id,"owner");if(googleFails)throw Error("Google down");return [{id:"google",start:"2090-10-22T05:00:00Z"}];}},
    "@/lib/google/gmailScan":{scanGmailForMeetings:async()=>[]},
    "@/lib/upcoming-sessions":{getUpcomingMemoValetSessions:async(db,id)=>{read++;assert.equal(id,"owner");if(memoFails)throw Error("Storage down");return {events:[{id:"memo",start:"2090-10-22T04:00:00Z"}],incomplete:false};}},
  };
  return {GET:compile("app/api/calendar/upcoming/route.ts",mocks).GET,reads:()=>read};
}
test("upcoming route merges MemoValet and connected-calendar events in time order", async () => {
  const result=await routeSetup().GET();
  assert.equal(result.status,200); assert.equal(result.body.incomplete,false);
  assert.equal(result.body.events[0].id,"memo");assert.equal(result.body.events[1].id,"google");
});
test("one failed schedule source preserves the other with an incomplete warning", async () => {
  for (const options of [{googleFails:true},{memoFails:true}]) {
    const result=await routeSetup(options).GET();
    assert.equal(result.status,200);assert.equal(result.body.incomplete,true);assert.equal(result.body.events.length,1);
  }
});
test("signed-out upcoming requests never read any schedule source", async () => {
  const s=routeSetup({signedIn:false});
  assert.equal((await s.GET()).status,401);assert.equal(s.reads(),0);
});

