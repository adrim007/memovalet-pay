const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) {
 const mod = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
 { module: mod, exports: mod.exports, Date, Intl, URL, Response, console, require: name => name in mocks ? mocks[name] : name.startsWith('./') ? load('lib/'+name.slice(2)+'.ts',mocks) : name.startsWith('@/') ? load(name.slice(2)+'.ts',mocks) : require(name) });
 return mod.exports;
}
const { matchesWorkFilter } = load('lib/work-filter.ts');
test('filters consistently handle personal tasks, meeting actions and sent work', () => {
 const now = new Date('2026-10-03T01:00:00Z');
 for (const status of ['done','completed']) { assert.equal(matchesWorkFilter('done',status),true); assert.equal(matchesWorkFilter('overdue',status,'2020-01-01'),false); }
 assert.equal(matchesWorkFilter('open','cancelled'),false);
 assert.equal(matchesWorkFilter('overdue','pending','2026-10-03','2026-10-03T00:00:00Z',now),true);
 assert.equal(matchesWorkFilter('overdue','todo','2026-10-03',null,now),false);
 assert.equal(matchesWorkFilter('overdue','pending','2020-01-01'),true);
});
const { explicitSchedule, reminderInstant } = load('lib/schedule-text.ts');
test('calendar fields preserve selected dates, optional times and daylight saving', () => {
 assert.equal(explicitSchedule('2026-10-05','13:00','Australia/Melbourne').at,'2026-10-05T02:00:00.000Z');
 assert.equal(explicitSchedule('2026-10-05','','Pacific/Auckland').at,null);
 assert.equal(explicitSchedule(null,null,'Australia/Melbourne'),null);
 assert.throws(()=>explicitSchedule('2026-02-30',null,'UTC'),/valid date/);
 assert.throws(()=>explicitSchedule('2026-10-04','02:30','Australia/Melbourne'),/clocks change/);
 assert.throws(()=>explicitSchedule('2026-10-05','25:00','UTC'),/valid time/);
 assert.throws(()=>explicitSchedule(null,'13:00','UTC'),/Choose a date/);
});
function editRoute({ user = { id: 'owner' }, exists = true, failure = false } = {}) {
 let patch, filters = [];
 const query = { update(value){patch=value;return query}, eq(key,value){filters.push([key,value]);return query}, select(){return query}, async maybeSingle(){return {data:exists?{id:'task',...patch}:null,error:failure?{message:'failed'}:null}} };
 const route=load('app/api/commitments/[id]/route.ts',{'next/server':{NextResponse:Response},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>query})}});
 return { call:body=>route.PATCH(new Request('https://example.test/api/commitments/task',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:'task'})}), filters, getPatch:()=>patch };
}
test('editing only updates the authenticated owner and can clear or reschedule dates',async()=>{
 const route=editRoute();
 assert.equal((await route.call({description:'Call Michelle',dueDate:'2026-10-05',dueTime:'13:00',timeZone:'Australia/Melbourne',user_id:'someone-else'})).status,200);
 assert.equal(route.getPatch().due_at,'2026-10-05T02:00:00.000Z');
 assert.ok(route.filters.some(([key,value])=>key==='user_id'&&value==='owner'));
 assert.equal(route.getPatch().user_id,undefined);
 await route.call({dueDate:null}); assert.equal(route.getPatch().due_at,null);
 await route.call({status:'pending'}); assert.equal(route.getPatch().completed_at,null);
});
test('edits cannot silently succeed for missing tasks, failed writes or invalid input',async()=>{
 assert.equal((await editRoute({user:null}).call({status:'completed'})).status,401);
 assert.equal((await editRoute({exists:false}).call({status:'completed'})).status,404);
 assert.equal((await editRoute({failure:true}).call({status:'completed'})).status,500);
 assert.equal((await editRoute().call({description:''})).status,400);
 assert.equal((await editRoute().call({dueDate:'2026-02-30'})).status,400);
});

test('personal reminder times reject invalid daylight saving times and can be removed',()=>{assert.equal(reminderInstant('2026-10-05T13:00','Australia/Melbourne'),'2026-10-05T02:00:00.000Z');assert.equal(reminderInstant(null,'UTC'),null);assert.throws(()=>reminderInstant('2026-10-04T02:30','Australia/Melbourne'),/clocks change/)});
