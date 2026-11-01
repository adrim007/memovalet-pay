const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript'), fs = require('node:fs'), vm = require('node:vm');
function compile(file,mocks){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date,Intl,console,require:n=>n in mocks?mocks[n]:n.startsWith('@/')?compile(n.slice(2)+'.ts',mocks):require(n)});return mod.exports;}
for(const kind of ['commitments','projects','live']) test(`${kind} validates and persists the parsed schedule with authenticated ownership`,async()=>{
 let saved; let signedIn=true;
 const mocks={
 '@/lib/plan-access':{featureError:async()=>null},
 'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},
 '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})}})},
 '@/lib/database':Object.fromEntries(['createCommitment','createProject','createLiveSession'].map(n=>[n,async input=>{saved=input;return {id:'saved'}}])),
 };
 const route=compile(`app/api/${kind}/route.ts`,mocks).POST;
 const body=kind==='commitments'?{description:'1pm call Michelle on 5 October 2090',direction:'i_owe'}:kind==='projects'?{name:'1pm finish launch on 5 October 2090'}:{title:'Review',naturalText:'1pm meeting on 5 October 2090'};
 body.timeZone='Australia/Melbourne';
 const call=()=>route({json:async()=>body});
 assert.equal((await call()).status,200);
 assert.equal(saved.userId,'owner');
 assert.equal(saved.dueAt||saved.scheduledStart,'2090-10-05T02:00:00.000Z');
 if(kind!=='live')assert.equal(saved.dueDate,'2090-10-05');
 saved=null;body.timeZone='Invalid';assert.equal((await call()).status,400);assert.equal(saved,null);
 signedIn=false;assert.equal((await call()).status,401);assert.equal(saved,null);
});
