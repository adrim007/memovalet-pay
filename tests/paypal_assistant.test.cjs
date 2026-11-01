// Proves the MemoValet Pay assistant can't send an invoice without the person's Approve tap, can't see
// or forge the approval, and can't send twice with one tap. The real MCP route and the real assistant
// run here; only the AI model (a script of Gemini replies) and PayPal's sandbox are replaced.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");

process.env.MEMOVALET_APPROVAL_SECRET="test_secret_for_memovalet_pay";
process.env.PAYPAL_CLIENT_ID="sandbox_id";process.env.PAYPAL_CLIENT_SECRET="sandbox_secret";
delete process.env.PAYPAL_ENV;delete process.env.PAYPAL_API_BASE;delete process.env.PAYPAL_SANDBOX_BUYER_EMAIL;
process.env.GEMINI_BUSY_WAIT_MS="1";
const cache={};
function compile(file){
 if(cache[file])return cache[file];
 const module={exports:{}};cache[file]=module.exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
  {module,exports:module.exports,Date,Intl,URL,Request,Response,Headers,Buffer,console,AbortSignal,AbortController,process,crypto:globalThis.crypto,
   fetch:(...args)=>globalThis.fetch(...args),setTimeout,clearTimeout,JSON,Math,
   require:name=>name.startsWith("@/")?compile(name.slice(2)+".ts"):require(name)});
 return cache[file]=module.exports;
}
const route=compile("app/api/paypal/mcp/route.ts");
const assistant=compile("lib/paypal/assistant.ts");
const approval=compile("lib/paypal/approval.ts");
const flow=compile("lib/paypal/invoice-flow.ts");
const ORIGIN="http://localhost:3000";
// Values made inside the sandbox are copied out before comparing, since deepEqual checks prototypes.
const plain=value=>JSON.parse(JSON.stringify(value));

// Serves the real MCP route in process, fakes the PayPal sandbox, and answers model requests from a script.
function harness(script){
 const created=[],modelRequests=[];
 const fetch=async(input,init={})=>{
  const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);
  if(url.hostname==="generativelanguage.googleapis.com"){
   modelRequests.push(JSON.parse(init.body));
   const parts=script.shift();
   assert.ok(parts,"the model was asked for more turns than the test scripted");
   if(parts.busy)return Response.json({error:{message:"This model is busy"}},{status:parts.busy});
   return Response.json({candidates:[{content:{role:"model",parts}}]});
  }
  if(url.hostname==="api-m.sandbox.paypal.com"){
   if(url.pathname==="/v1/oauth2/token")return Response.json({access_token:"tok",expires_in:300});
   if(url.pathname==="/v2/invoicing/invoices"&&init.method==="POST"){created.push(JSON.parse(init.body));return Response.json({id:"INV2-TEST",status:"DRAFT"},{status:201});}
   if(url.pathname.endsWith("/send"))return Response.json({},{status:202});
   return Response.json({id:"INV2-TEST",status:"UNPAID",amount:{currency_code:"AUD",value:"500.00"},primary_recipients:[{billing_info:{email_address:"sam@harbourbakery.example"}}],detail:{payment_term:{due_date:"2026-11-03"}}});
  }
  if(url.pathname==="/api/paypal/mcp")return route[(init.method??"GET").toUpperCase()](new Request(url,init));
  throw new Error("Unexpected request to "+url);
 };
 return {fetch,created,modelRequests};
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
const call=(name,args={})=>[{functionCall:{name,args}}];
const say=text=>[{text}];
const answersSentBack=request=>request.contents.at(-1).parts.map(part=>part.functionResponse).filter(Boolean);
const ask=(text,extra={})=>assistant.runPayAssistantTurn({origin:ORIGIN,text,...extra});
const proposalId=flow.proposeInvoice({}).proposalId;

test("the model never sees the approval field, and only the tapped approval reaches the server",()=>{
 const tools=assistant.toolsForModel([{name:"send_invoice",inputSchema:{type:"object",properties:{proposalId:{type:"string"},approvalToken:{type:"string"}},required:["proposalId"]}},{name:"invoice_status",inputSchema:{type:"object",properties:{invoiceId:{type:"string"}}}}]);
 assert.deepEqual(Object.keys(tools[0].inputSchema.properties),["proposalId"]);
 assert.deepEqual(Object.keys(tools[1].inputSchema.properties),["invoiceId"]);
 assert.equal(assistant.argsForServer("send_invoice",{proposalId,approvalToken:"made.up"}).approvalToken,undefined);
 assert.equal(assistant.argsForServer("send_invoice",{proposalId,approvalToken:"made.up"},"real.tap").approvalToken,"real.tap");
 assert.equal(assistant.argsForServer("invoice_status",{invoiceId:"x"},"real.tap").approvalToken,undefined);
});

test("asked to bill the deposit, the assistant proposes it, and a send it tries before approval creates nothing",()=>withHarness(
 [call("propose_invoice"),call("send_invoice",{proposalId,approvalToken:"made.up"}),say("The A$500 invoice for Sam is ready for you to approve.")],
 async h=>{
  const turn=await ask("Bill Harbour Bakery for the deposit we agreed");
  assert.deepEqual(plain(turn.cards.map(card=>card.tool)),["propose_invoice"]);
  assert.equal(turn.cards[0].data.total,"500.00");
  assert.equal(h.created.length,0,"nothing was created in PayPal");
  assert.match(answersSentBack(h.modelRequests.at(-1))[0].response.error,/has not approved/);
  const sendTool=h.modelRequests[0].tools[0].functionDeclarations.find(tool=>tool.name==="send_invoice");
  assert.deepEqual(Object.keys(sendTool.parameters.properties),["proposalId"]);
 }));

test("after the Approve tap the assistant sends exactly once, and a second send is refused",()=>withHarness(
 [call("send_invoice",{proposalId}),call("send_invoice",{proposalId}),say("Sent. Sam's invoice is in the PayPal sandbox.")],
 async h=>{
  const p=flow.proposeInvoice({});
  const turn=await ask("I've approved the invoice on the card. Please send it.",{approvalToken:approval.approve(p.proposalId,p.draft)});
  assert.equal(h.created.length,1,"one invoice created");
  assert.equal(h.created[0].primary_recipients[0].billing_info.email_address,p.draft.payerEmail);
  assert.equal(h.created[0].items[0].unit_amount.value,"500.00");
  assert.deepEqual(plain(turn.cards.map(card=>card.tool)),["send_invoice"]);
  assert.equal(turn.cards[0].data.invoice.status,"UNPAID");
  assert.match(answersSentBack(h.modelRequests.at(-1))[0].response.error,/already used/);
  assert.doesNotMatch(turn.reply,/[-–—]/);
 }));

test("when Gemini is busy for a moment the assistant tries again, and the tool runs once",()=>withHarness(
 [{busy:503},call("propose_invoice"),{busy:429},say("The A$500 invoice for Sam is ready for you to approve.")],
 async h=>{
  const turn=await ask("Bill Harbour Bakery for the deposit we agreed");
  assert.deepEqual(plain(turn.cards.map(card=>card.tool)),["propose_invoice"]);
  assert.match(turn.reply,/ready for you/);
  assert.equal(h.modelRequests.length,4);
 }));

test("when Gemini stays busy the assistant stops after three tries and says so",()=>withHarness(
 [{busy:503},{busy:503},{busy:503}],
 async h=>{
  await assert.rejects(ask("Bill Harbour Bakery for the deposit we agreed"),error=>error.status===503);
  assert.equal(h.modelRequests.length,3);
  assert.equal(h.created.length,0);
 }));
