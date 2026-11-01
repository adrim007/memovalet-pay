const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},env={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,process:{env},Uint8Array,Float32Array,DataView,ArrayBuffer,console,require:n=>n==='server-only'?{}:n in mocks?mocks[n]:require(n)});return m.exports}
function access(plan,enforced=true,fail=false){return load('lib/plan-access.ts',{'@/lib/supabase/service':{createServiceClient:()=>({rpc:async()=>({data:{plan},error:fail?{}:null})})}},{BILLING_ENTITLEMENTS_VERIFIED:enforced?'true':'false'})}
test('Free remains usable before paid launch and paid features enforce their minimum plan',async()=>{
 assert.equal(await access('free',false).featureError('u','hosting'),null);
 assert.match(await access('free').featureError('u','hosting'),/Member or Business/);
 assert.equal(await access('member').featureError('u','hosting'),null);
 assert.match(await access('member').featureError('u','shared_work'),/Business/);
 assert.equal(await access('business').featureError('u','reports'),null);
 await assert.rejects(access('business',true,true).featureError('u','hosting'),/could not be checked/);
});
test('duration is measured from actual supported audio and forged headers are rejected',()=>{
 const {encodeWav}=load('lib/speech-segments.ts');const {wavSeconds}=load('lib/wav-duration.ts');
 const wav=encodeWav(new Float32Array(32000),16000);assert.equal(wavSeconds(wav),2);
 const forged=wav.slice();new DataView(forged.buffer).setUint32(28,999999,true);assert.throws(()=>wavSeconds(forged),/Invalid/);
 assert.throws(()=>wavSeconds(wav.slice(0,-10)),/Invalid/);
 assert.throws(()=>wavSeconds(encodeWav(new Float32Array(16000*22),16000)),/too long/);
});
