// Proves the simulated Alexa+ assistant never books a follow up without the user's OK. The real MCP
// server and the real assistant run here; only the AI model is replaced by a script, so each test can
// make the model try to book at the wrong moment and check that the code stops it.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const {Client}=require("@modelcontextprotocol/sdk/client/index.js");
const {StreamableHTTPClientTransport}=require("@modelcontextprotocol/sdk/client/streamableHttp.js");

function compile(file){
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
  {module,exports:module.exports,Date,Intl,URL,Request,Response,Headers,console,AbortSignal,AbortController,process,crypto:globalThis.crypto,
   fetch:(...args)=>globalThis.fetch(...args),setTimeout,clearTimeout,
   require:name=>name.startsWith("@/")?compile(name.slice(2)+".ts"):require(name)});
 return module.exports;
}
const route=compile("app/api/hackathon/mcp/route.ts");
const memory=compile("lib/hackathon/meeting-memory.ts");
const assistant=compile("lib/hackathon/assistant.ts");
const ORIGIN="http://localhost:3000";
// Values made inside the sandbox are copied out before comparing, since deepEqual checks prototypes.
const plain=value=>JSON.parse(JSON.stringify(value));
const slots=plain(memory.followUpTimes("launch-date").slots.map(slot=>slot.start));

// Serves the real MCP route in process, records every tool call that reaches it, and answers model
// requests from a script of Gemini replies.
function harness(script){
 const toolCalls=[],modelRequests=[];
 const fetch=async(input,init={})=>{
  const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);
  if(url.hostname==="generativelanguage.googleapis.com"){
   modelRequests.push(JSON.parse(init.body));
   const parts=script.shift();
   assert.ok(parts,"the model was asked for more turns than the test scripted");
   return Response.json({candidates:[{content:{role:"model",parts}}]});
  }
  if(url.pathname==="/api/hackathon/mcp"){
   const request=new Request(url,init);
   if(request.method==="POST"){
    const message=JSON.parse(init.body);
    for(const item of [].concat(message))if(item.method==="tools/call")toolCalls.push(item.params);
   }
   return route[request.method](request);
  }
  throw new Error("Unexpected request to "+url);
 };
 return {fetch,toolCalls,modelRequests};
}
async function withHarness(script,run){
 const original=globalThis.fetch,key=process.env.GEMINI_API_KEY,choice=process.env.MEMOVALET_AI_PROVIDER;
 const h=harness(script);
 globalThis.fetch=h.fetch;process.env.GEMINI_API_KEY="test key";delete process.env.MEMOVALET_AI_PROVIDER;
 try{return await run(h);}
 finally{
  globalThis.fetch=original;
  if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;
  if(choice!==undefined)process.env.MEMOVALET_AI_PROVIDER=choice;
 }
}
const call=(name,args)=>[{functionCall:{name,args}}];
const say=text=>[{text}];
const answersSentBack=request=>request.contents.at(-1).parts.map(part=>part.functionResponse).filter(Boolean);

test("the MCP server only books a time it offered, marks booking as its one write, and never sends reminders",async()=>{
 const client=new Client({name:"Approval test",version:"1.0.0"});
 await client.connect(new StreamableHTTPClientTransport(new URL(ORIGIN+"/api/hackathon/mcp"),{fetch:(url,init)=>route.POST(new Request(url,init))}));
 try{
  const {tools}=await client.listTools();
  assert.equal(tools.length,7);
  assert.deepEqual(tools.filter(tool=>tool.annotations.readOnlyHint!==true).map(tool=>tool.name),["book_follow_up"]);

  const unoffered=await client.callTool({name:"book_follow_up",arguments:{decisionId:"launch-date",start:"2026-10-22T09:00:00+11:00"}});
  assert.equal(unoffered.isError,true);

  const offered=await client.callTool({name:"find_follow_up_times",arguments:{decisionId:"launch-date"}});
  assert.deepEqual(offered.structuredContent.slots.map(slot=>slot.start),slots);
  const booked=await client.callTool({name:"book_follow_up",arguments:{decisionId:"launch-date",start:slots[0]}});
  assert.equal(booked.structuredContent.booking.start,slots[0]);
  assert.match(booked.structuredContent.savedTo,/No invitations are sent/);

  const reminders=await client.callTool({name:"draft_task_reminders",arguments:{decisionId:"launch-date",followUpStart:slots[0]}});
  assert.equal(reminders.structuredContent.sent,false);
  assert.ok(reminders.structuredContent.drafts.length>0);
 }finally{await client.close();}
});

const bookingsMade=h=>h.toolCalls.filter(params=>params.name==="book_follow_up").map(params=>params.arguments.start);
// Shows the three times in a first turn, so later turns can answer them.
const showTimes=[call("find_follow_up_times",{decisionId:"launch-date"}),say("Which time suits you?")];
const ask=(text,extra={})=>assistant.runAssistantTurn({origin:ORIGIN,text,...extra});

test("which time a spoken or typed reply picks: exactly one offered time, or none",()=>{
 const offered=plain(memory.followUpTimes("launch-date").slots);
 assert.deepEqual(offered.map(slot=>slot.label),["Thursday 22 October at 10 am","Thursday 22 October at 3 pm","Friday 23 October at 10 am"]);
 const picks={
  "Yes, Thursday at 10 am works":0,"Thursday at 10am please":0,"The 22nd at 10 a.m.":0,"3 pm please":1,"Friday works":2,
  "The second one":1,"the last one":2,
  "Yes":null,"Thursday":null,"10 am":null,"No, not Thursday at 10 am":null,"Don’t book Friday yet":null,
 };
 for(const [text,index] of Object.entries(picks)){
  assert.equal(assistant.approvedSlot(text,offered)?.start??null,index===null?null:offered[index].start,text);
 }
 assert.equal(assistant.approvedSlot("anything",offered,offered[1].start).start,offered[1].start);
 assert.equal(assistant.approvedSlot("anything",offered,"2026-10-22T09:00:00+11:00"),undefined);
 assert.equal(assistant.approvedSlot("Yes, Thursday at 10 am",[]),undefined);
});

test("before any times are shown, nothing books, even a request that says book",()=>withHarness(
 [call("find_follow_up_times",{decisionId:"launch-date"}),call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),say("Which one?")],
 async h=>{
  const turn=await ask("Yes, book a follow up for the launch meeting on Thursday at 10 am");
  assert.deepEqual(h.toolCalls.map(params=>params.name),["find_follow_up_times"]);
  assert.equal(turn.cards.some(card=>card.tool==="book_follow_up"),false);
  assert.match(JSON.stringify(answersSentBack(h.modelRequests[2])),/Not booked/);
 }));

test("tapping a time books exactly that time, even if the model tries another",()=>withHarness(
 [...showTimes,call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),call("book_follow_up",{decisionId:"launch-date",start:slots[1]}),say("All done.")],
 async h=>{
  const first=await ask("Set up a follow up for the launch meeting");
  const second=await ask("Book Thursday 22 October at 3 pm",{conversationId:first.conversationId,confirmStart:slots[1]});
  assert.equal(second.conversationId,first.conversationId);
  assert.deepEqual(bookingsMade(h),[slots[1]]);
  assert.deepEqual(plain(second.cards.filter(card=>card.tool==="book_follow_up").map(card=>card.data.booking.start)),[slots[1]]);
 }));

test("saying one time books that time, and the model cannot swap it",()=>withHarness(
 [...showTimes,call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),call("book_follow_up",{decisionId:"launch-date",start:slots[2]}),say("All done.")],
 async h=>{
  const first=await ask("Set up a follow up for the launch meeting");
  await ask("Yes, Friday works",{conversationId:first.conversationId});
  assert.deepEqual(bookingsMade(h),[slots[2]]);
 }));

test("a plain yes with three times on screen books nothing",()=>withHarness(
 [...showTimes,call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),say("Which one?")],
 async h=>{
  const first=await ask("Set up a follow up for the launch meeting");
  await ask("Yes",{conversationId:first.conversationId});
  assert.deepEqual(bookingsMade(h),[]);
 }));

test("a refusal never books, even when it names a time",()=>withHarness(
 [...showTimes,call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),say("No problem.")],
 async h=>{
  const first=await ask("Set up a follow up for the launch meeting");
  await ask("No, don't book Thursday at 10 am yet",{conversationId:first.conversationId});
  assert.deepEqual(bookingsMade(h),[]);
 }));

test("once a follow up is booked, a repeated confirmation does not book it again",()=>withHarness(
 [...showTimes,call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),say("Done."),
  call("book_follow_up",{decisionId:"launch-date",start:slots[0]}),say("It's already booked.")],
 async h=>{
  const first=await ask("Set up a follow up for the launch meeting");
  await ask("Book Thursday 22 October at 10 am",{conversationId:first.conversationId,confirmStart:slots[0]});
  const again=await ask("Yes, Thursday at 10 am",{conversationId:first.conversationId});
  assert.deepEqual(bookingsMade(h),[slots[0]]);
  assert.equal(again.cards.some(card=>card.tool==="book_follow_up"),false);
  assert.match(JSON.stringify(answersSentBack(h.modelRequests.at(-1))),/already booked/);
 }));
