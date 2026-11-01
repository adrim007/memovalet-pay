const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const schedulerAuth=(()=>{const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/scheduler-auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require});return m.exports})();
const job={id:'delivery',user_id:'owner',source_kind:'action_item',source_id:'task',scheduled_at:'2026-10-03T01:00:00Z',title:'Call Michelle',link:'/tasks?task=task',email_to:null};
function load({source={status:'todo',reminder_at:job.scheduled_at}, optout=false, emailOK=true, secret='secret',dbError=false}={}){
 const emails=[], notifications=[], updates=[];let claims=0;
 const db={rpc:async()=>{claims++;return{data:[job],error:null}},auth:{admin:{getUserById:async()=>({data:{user:{email:'owner@example.test',user_metadata:{notification_prefs:{timed_reminders:!optout}}}},error:null})}},
 from:name=>{let values;const q={select(){return q},eq(){return q},update(v){values=v;return q},async maybeSingle(){return{data:source,error:dbError?{}:null}},async upsert(v){notifications.push(v);return{error:null}},then(resolve){updates.push(values);return Promise.resolve({error:null}).then(resolve)}};return q}};
 const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/reminders/deliver/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date,process:{env:{CRON_SECRET:secret}},require:n=>({'next/server':{NextResponse:Response},'@/lib/scheduler-auth':schedulerAuth,'node:crypto':{randomUUID:()=> 'lease'},'@/lib/supabase/service':{createServiceClient:()=>db},'@/lib/email/send':{sendAppEmail:async input=>{emails.push(input);return{sent:emailOK}}}})[n]});
 return{run:auth=>mod.exports.GET(new Request('https://example.test/api/reminders/deliver',{headers:auth?{authorization:'Bearer secret'}:{}})),emails,notifications,updates,claims:()=>claims};
}
test('only an authenticated scheduler can claim jobs',async()=>{const x=load();assert.equal((await x.run(false)).status,401);assert.equal(x.claims(),0);assert.equal((await load({secret:''}).run(true)).status,401)});
test('delivery uses stable notification and provider idempotency keys',async()=>{const x=load();assert.equal((await x.run(true)).status,200);assert.equal(x.emails[0].idempotencyKey,'timed-reminder/delivery');assert.equal(x.notifications[0].id,'delivery');assert.equal(x.updates.at(-1).state,'sent');assert.equal(x.emails[0].userId,undefined)});
test('completed, deleted, rescheduled and opted out reminders send nothing',async()=>{for(const opts of [{source:null},{source:{status:'done',reminder_at:job.scheduled_at}},{source:{status:'todo',reminder_at:'2026-10-04T01:00:00Z'}},{optout:true}]){const x=load(opts);await x.run(true);assert.equal(x.emails.length,0);assert.equal(x.notifications.length,0);assert.equal(x.updates.at(-1).state,'skipped')}});
test('email failure schedules a retry without falsely recording success',async()=>{const x=load({emailOK:false});assert.equal((await x.run(true)).status,503);assert.equal(x.updates.at(-1).state,undefined);assert.ok(x.updates.at(-1).next_attempt_at);assert.equal(x.updates.at(-1).lock_token,null)});
test('source lookup failures do not send or discard a reminder',async()=>{const x=load({dbError:true});await x.run(true);assert.equal(x.emails.length,0);assert.equal(x.updates.at(-1).state,undefined)});

// A database dispatch token is checked through the service role, not accepted by shape alone.
test('forged database scheduler tokens fail closed',async()=>{
 const source=fs.readFileSync('app/api/reminders/deliver/route.ts','utf8');const m={exports:{}};let claims=0;
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,process:{env:{}},require:n=>({'next/server':{NextResponse:Response},'@/lib/scheduler-auth':schedulerAuth,'node:crypto':{randomUUID:()=> 'x'},'@/lib/email/send':{},'@/lib/supabase/service':{createServiceClient:()=>({rpc:async name=>{if(name==='verify_reminder_dispatch')return{data:false};claims++;return{data:[]}}})}})[n]});
 const r=await m.exports.GET(new Request('https://example.test',{headers:{authorization:'Bearer 1791010000.'+ 'a'.repeat(64)}}));assert.equal(r.status,401);assert.equal(claims,0);
});
