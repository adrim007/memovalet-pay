const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const limits=(()=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/recording-limits.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});return module.exports;})();
const TWO_PARTS=['private-recording:owner/first.mp4','private-recording:owner/second.mp4'];
function fixture(clip, allowed=true, signedIn=true, parts=TWO_PARTS) {
  let signed, expiry;
  const module={exports:{}};
  const modules={
    'next/server':{NextResponse:{json:(b,o)=>new Response(JSON.stringify(b),o),redirect:()=>new Response(null,{status:307})}},
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})}})},
    '@/lib/database':{getMeeting:async()=>allowed?{video_url:parts[0],metadata:{recording_urls:parts}}:null},
    '@/lib/recording-limits':limits,
    '@/lib/recording-path':{parseRecordingPath:value=>value.slice(18)},
    '@/lib/supabase/service':{createServiceClient:()=>({storage:{from:()=>({createSignedUrl:async(path,expires)=>{signed=path;expiry=expires;return{data:{signedUrl:'https://local/signed'}}}})}})},
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/meetings/[id]/recording/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>modules[id],URL});
  return {get:()=>module.exports.GET(new Request('https://local/recording?clip='+clip),{params:Promise.resolve({id:'meeting'})}),signed:()=>signed,expiry:()=>expiry};
}
test('clip playback signs only the selected stored recording after RLS access succeeds',async()=>{const f=fixture('1');assert.equal((await f.get()).status,307);assert.equal(f.signed(),'owner/second.mp4');});
test('invalid indices, inaccessible meetings, and signed-out users cannot sign a recording',async()=>{
  for(const f of [fixture('-1'),fixture('999'),fixture('1.5'),fixture('0',false),fixture('1',true,false)]){assert.ok((await f.get()).status>=400);assert.equal(f.signed(),undefined);}
});
test('the last part of the longest recording the call page can make still plays',async()=>{
  const parts=Array.from({length:limits.MAX_RECORDING_CLIPS},(_,i)=>'private-recording:owner/part-'+i+'.webm');
  const last=fixture(String(limits.MAX_RECORDING_CLIPS-1),true,true,parts);
  assert.equal((await last.get()).status,307);assert.equal(last.signed(),'owner/part-'+(limits.MAX_RECORDING_CLIPS-1)+'.webm');
  const beyond=fixture(String(limits.MAX_RECORDING_CLIPS),true,true,parts);
  assert.equal((await beyond.get()).status,400);assert.equal(beyond.signed(),undefined);
});
test('the playback link outlasts the recording, so it does not stop partway through',async()=>{
  const f=fixture('0');assert.equal((await f.get()).status,307);
  // The player keeps fetching as it plays. At 300 seconds a nine-minute part
  // stopped playing halfway, and skipping ahead failed.
  assert.ok(f.expiry()>=60*60,`link lasts only ${f.expiry()} seconds`);
});
