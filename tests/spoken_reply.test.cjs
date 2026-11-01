// Spoken replies for the dashboard search bar: what part of an answer is read aloud, and when the
// server's natural voice is allowed (signed in, under the daily limit), with every failure leaving
// the page free to use the browser's own voice.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");

function compile(file,mocks={}){
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
  {module,exports:module.exports,Request,Response,Headers,process,Buffer,console,
   require:name=>name in mocks?mocks[name]:name.startsWith("@/")?compile(name.slice(2)+".ts",mocks):require(name)});
 return module.exports;
}
const {spokenSummary}=compile("lib/spokenSummary.ts");

test("a short answer is read out as it is, without its formatting",()=>{
 assert.equal(spokenSummary("Two tasks are still open."),"Two tasks are still open.");
 assert.equal(spokenSummary("**Priya**: Finish the copy. Due: 20 October.\n\n* Alex: Draft the playbook."),
  "Priya: Finish the copy. Due: 20 October. Alex: Draft the playbook.");
 assert.equal(spokenSummary("See [the launch meeting](/history/launch) for details."),"See the launch meeting for details.");
 assert.equal(spokenSummary("   "),"");
});

test("a long answer gives its first sentences and points to the screen for the rest",()=>{
 const answer="Priya owes the onboarding copy by Tuesday. Alex owes the support playbook by Wednesday. The pilot launches on 28 October. Support reviews feedback first.";
 assert.equal(spokenSummary(answer,90),"Priya owes the onboarding copy by Tuesday. Alex owes the support playbook by Wednesday. The rest is on screen.");
});

test("a first sentence longer than the limit is cut at a word, and decimals are not sentence ends",()=>{
 const long="The team agreed to launch the pilot with invited customers only, so support can review every piece of feedback before a wider release goes out later this year";
 const spoken=spokenSummary(long,60);
 assert.match(spoken,/^The team agreed to launch the pilot with invited customers\. The rest is on screen\.$/);
 assert.equal(spokenSummary("It takes 3.5 hours. Then we review the results together.",20),"It takes 3.5 hours. The rest is on screen.");
});

// The voice endpoint, with the database and the voice service replaced by stand ins.
function speakRoute({user={id:"u1"},claim={data:true,error:null},audio=new Uint8Array([82,73,70,70]),fail=false}={}){
 const calls=[];
 const route=compile("app/api/speak/route.ts",{
  "@/lib/supabase/server":{createClient:async()=>{
   if(fail)throw new Error("Supabase is not configured");
   return {auth:{getUser:async()=>({data:{user}})},rpc:async(name,args)=>{calls.push({name,args});return claim;}};
  }},
  "@/lib/ai/speech":{synthesizeSpeech:async()=>audio},
 });
 const post=text=>route.POST(new Request("http://localhost:3000/api/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})}));
 return {post,calls};
}
async function withKey(run){
 const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY="test key";
 try{return await run();}finally{if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
}

test("the natural voice is only for signed in people, and only counts real requests",()=>withKey(async()=>{
 const signedOut=speakRoute({user:null});
 assert.equal((await signedOut.post("Hello")).status,401);
 assert.equal(signedOut.calls.length,0);
 const empty=speakRoute();
 assert.equal((await empty.post("   ")).status,400);
 assert.equal((await empty.post("x".repeat(401))).status,400);
 assert.equal(empty.calls.length,0);
}));

test("each spoken reply is counted against the daily limit, and the limit is enforced",()=>withKey(async()=>{
 const ok=speakRoute();
 const response=await ok.post("Two tasks are still open.");
 assert.equal(response.status,200);
 assert.equal(response.headers.get("Content-Type"),"audio/wav");
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[82,73,70,70]);
 assert.deepEqual(JSON.parse(JSON.stringify(ok.calls)),[{name:"claim_spoken_reply",args:{p_limit:40}}]);
 assert.equal((await speakRoute({claim:{data:false,error:null}}).post("Hello")).status,429);
}));

test("anything missing or failing answers with an error, so the page uses the browser's voice",()=>withKey(async()=>{
 assert.equal((await speakRoute({claim:{data:null,error:{message:"function claim_spoken_reply does not exist"}}}).post("Hello")).status,503);
 assert.equal((await speakRoute({fail:true}).post("Hello")).status,503);
 assert.equal((await speakRoute({audio:null}).post("Hello")).status,502);
 delete process.env.GEMINI_API_KEY;
 assert.equal((await speakRoute().post("Hello")).status,503);
}));
