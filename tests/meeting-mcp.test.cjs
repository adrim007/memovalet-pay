const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const {Client}=require("@modelcontextprotocol/sdk/client/index.js");
const {StreamableHTTPClientTransport}=require("@modelcontextprotocol/sdk/client/streamableHttp.js");
function compile(file,mocks={}) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,Date,Intl,URL,Request,Response,Headers,console,AbortSignal,process,
 require:name=>name in mocks?mocks[name]:name.startsWith("@/")?compile(name.slice(2)+".ts",mocks):require(name)});
 return module.exports;
}
const lib=compile("lib/mcp/follow-through-server.ts");
const snapshot={
 meeting:{id:"source",title:"Launch review"},
 tasks:[
  {id:"ready",task:"Draft brief",owner:"Alex",due_date:"2090-10-20",status:"todo"},
  {id:"missing",task:"Review copy",owner:null,due_date:"next week",status:"todo"},
  {id:"done",task:"Approve pilot",owner:null,due_date:null,status:"done"},
  {id:"invalid",task:"Check support",owner:"Priya",due_date:"2090-02-30",status:"todo"},
 ]
};
test("preparation retains the source, excludes completed work, flags real gaps and never changes stored tasks",()=>{
 const before=JSON.stringify(snapshot);
 const plan=lib.prepareFollowThrough(snapshot);
 assert.equal(plan.source.href,"/history/source");assert.equal(plan.openTasks.length,3);
 assert.equal(plan.completedCount,1);assert.equal(plan.missingOwners.length,1);
 assert.equal(plan.missingDeadlines.length,2);assert.equal(plan.reviewRequired,true);
 assert.equal(plan.followUp.title,"Follow up: Launch review");
 assert.equal(JSON.stringify(snapshot),before);
});
test("official client and real SDK transport initialize, discover and prepare without any write hook",async()=>{
 let reads=0;
 const client=new Client({name:"Protocol test",version:"1.0.0"});
 const transport=new StreamableHTTPClientTransport(new URL("http://localhost:3000/mcp"),{
  fetch:async(url,options)=>lib.handleMcp(new Request(url,options),lib.createFollowThroughServer(async()=>{reads++;return snapshot;}))
 });
 try {
  await client.connect(transport);
  assert.equal(reads,0);
  const tools=await client.listTools();assert.equal(tools.tools.length,1);
  assert.equal(tools.tools[0].annotations.readOnlyHint,true);assert.equal(reads,0);
  const result=await client.callTool({name:"prepare_follow_through",arguments:{}});
  assert.equal(result.structuredContent.source.id,"source");assert.equal(result.structuredContent.completedCount,1);
  assert.equal(reads,1);
 }finally{await client.close();}
});
test("MCP blocks cross-site and unknown-host requests",async()=>{
 for(const [url,headers]of [
  ["http://localhost:3000/mcp",{origin:"https://elsewhere.example"}],
  ["http://untrusted.example/mcp",{}],
  ["http://localhost:3000/mcp",{"sec-fetch-site":"cross-site"}],
 ]) {
  const response=await lib.handleMcp(new Request(url,{method:"POST",headers,body:"{}"}),lib.createFollowThroughServer(async()=>snapshot));
  assert.equal(response.status,403);
 }
});
test("MCP validates protocol envelopes and Accept headers rather than treating arbitrary JSON as a tool call",async()=>{
 for(const [body,accept]of [
  ["{","application/json, text/event-stream"],
  [JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"test",version:"1"}}}),"text/plain"],
 ]) {
  const response=await lib.handleMcp(new Request("http://localhost:3000/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:accept},body}),lib.createFollowThroughServer(async()=>snapshot));
  assert.ok(response.status>=400);
 }
});
test("MCP initialization negotiates the required protocol, notifications are empty and no private data is loaded",async()=>{
 let reads=0;
 const server=()=>lib.createFollowThroughServer(async()=>{reads++;return snapshot;});
 const request=body=>new Request("http://localhost:3000/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify(body)});
 const init=await lib.handleMcp(request({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"test",version:"1"}}}),server());
 assert.equal((await init.json()).result.protocolVersion,"2025-11-25");
 assert.equal(init.headers.get("cache-control"),"private, no-store");
 const notice=await lib.handleMcp(request({jsonrpc:"2.0",method:"notifications/initialized"}),server());
 assert.equal(notice.status,202);assert.equal(await notice.text(),"");assert.equal(reads,0);
 assert.equal(lib.noMcpStream().status,405);
});
function route(signedIn,accessible) {
 let reads=0;
 const mock={
 "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:"owner"}:null}})}})},
 "../route":{GET:async()=>{reads++;return accessible?Response.json(snapshot):Response.json({error:"not owner"},{status:404});}},
 };
 return {...compile("app/api/meetings/[id]/follow-through/mcp/route.ts",mock),reads:()=>reads};
}
test("authenticated MCP route rejects signed-out and cross-origin requests before loading meeting data",async()=>{
 const s=route(false,false);
 const context={params:Promise.resolve({id:"source"})};
 const request=new Request("http://localhost:3000/mcp",{method:"POST",body:"{}"});
 assert.equal((await s.POST(request,context)).status,401);assert.equal(s.reads(),0);
 const other=route(true,true);
 assert.equal((await other.POST(new Request(request,{headers:{origin:"https://elsewhere.example"}}),context)).status,403);
 assert.equal(other.reads(),0);
});
test("a meeting ownership failure returns a tool error and never a prepared source",async()=>{
 const s=route(true,false),context={params:Promise.resolve({id:"source"})};
 const client=new Client({name:"Ownership test",version:"1"});
 const transport=new StreamableHTTPClientTransport(new URL("http://localhost:3000/mcp"),{fetch:(url,options)=>s.POST(new Request(url,options),context)});
 try{
  await client.connect(transport);
  const result=await client.callTool({name:"prepare_follow_through",arguments:{}});
  assert.equal(result.isError,true);assert.equal(result.structuredContent,undefined);
  assert.equal(s.reads(),1);
 }finally{await client.close();}
});

