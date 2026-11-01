const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const {Client}=require("@modelcontextprotocol/sdk/client/index.js");
const {InMemoryTransport}=require("@modelcontextprotocol/sdk/inMemory.js");
// One shared secret, so approvals made here verify inside the compiled server too.
process.env.MEMOVALET_APPROVAL_SECRET="test-secret-for-memovalet-pay";
delete process.env.PAYPAL_SANDBOX_BUYER_EMAIL;
const cache={};
function compile(file) {
 if (cache[file]) return cache[file];
 const module={exports:{}};cache[file]=module.exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,Date,Intl,URL,Request,Response,Headers,Buffer,console,process,JSON,Math,
 require:name=>name.startsWith("@/")?compile(name.slice(2)+".ts"):require(name)});
 return cache[file]=module.exports;
}
const sandbox=compile("lib/paypal/sandbox.ts");
const client=compile("lib/paypal/client.ts");
const approval=compile("lib/paypal/approval.ts");
const flow=compile("lib/paypal/invoice-flow.ts");
const mcp=compile("lib/paypal/mcp-server.ts");
const creds={PAYPAL_CLIENT_ID:"id",PAYPAL_CLIENT_SECRET:"secret"};

test("sandbox only: live mode or a live address refuses to start, and missing keys say what to add",()=>{
 assert.throws(()=>sandbox.paypalConfig({...creds,PAYPAL_ENV:"live"}),/sandbox only/);
 assert.throws(()=>sandbox.paypalConfig({...creds,PAYPAL_API_BASE:"https://api-m.paypal.com"}),/sandbox only/);
 assert.throws(()=>sandbox.paypalConfig({}),/PAYPAL_CLIENT_ID/);
 assert.equal(sandbox.paypalConfig(creds).apiBase,"https://api-m.sandbox.paypal.com");
});

function fakeFetch(handler) {
 const calls=[];
 const fetcher=async(url,init={})=>{calls.push({url,init});const [status,body]=handler(url,init);
  return {ok:status<300,status,json:async()=>body,text:async()=>JSON.stringify(body)};};
 return {calls,fetcher};
}
const config=sandbox.paypalConfig(creds);

test("token: a wrong secret gives a clear error, not a crash",async()=>{
 const {fetcher}=fakeFetch(()=>[401,{error:"invalid_client"}]);
 await assert.rejects(client.createPayPalClient({config,fetcher}).token(),/refused the app's ID or secret/);
});

test("client: creates a draft and sends it through the sandbox Invoicing v2 API",async()=>{
 const {calls,fetcher}=fakeFetch((url)=>url.endsWith("/oauth2/token")?[200,{access_token:"tok",expires_in:300}]
  :url.endsWith("/send")?[202,{}]
  :url.endsWith("/invoices")?[201,{id:"INV2-TEST",status:"DRAFT",amount:{currency_code:"AUD",value:"500.00"}}]
  :[200,{id:"INV2-TEST",status:"UNPAID",amount:{currency_code:"AUD",value:"500.00"},primary_recipients:[{billing_info:{email_address:"sam@harbourbakery.example"}}],detail:{payment_term:{due_date:"2026-11-03"}}}]);
 const paypal=client.createPayPalClient({config,fetcher});
 const draft=await paypal.createDraft(flow.proposeInvoice({}).draft);
 const sent=await paypal.send(draft.id);
 assert.equal(sent.status,"UNPAID");
 assert.ok(calls.every(c=>c.url.startsWith("https://api-m.sandbox.paypal.com/")));
 const create=calls.find(c=>c.url.endsWith("/v2/invoicing/invoices"));
 const body=JSON.parse(create.init.body);
 assert.equal(create.init.headers.Authorization,"Bearer tok");
 assert.equal(body.items[0].unit_amount.value,"500.00");
 assert.equal(body.primary_recipients[0].billing_info.email_address,"sam@harbourbakery.example");
});

test("propose: returns payer, items, total, currency and a due date 7 days out, from the sample meeting",()=>{
 const proposal=flow.proposeInvoice({},new Date(2026,9,27));
 assert.equal(proposal.draft.payerEmail,"sam@harbourbakery.example");
 assert.equal(proposal.draft.currency,"AUD");
 assert.equal(proposal.total,"500.00");
 assert.equal(proposal.draft.dueDate,"2026-11-03");
 assert.equal(proposal.sample,true);
 assert.match(proposal.source.quote,/deposit invoice/);
});

test("approval gate: refuses no approval, changed details, a forged or old approval",()=>{
 const p=flow.proposeInvoice({});
 const token=approval.approve(p.proposalId,p.draft);
 assert.equal(approval.checkApproval(token,p.proposalId,p.draft).ok,true);
 assert.equal(approval.checkApproval(undefined,p.proposalId,p.draft).ok,false);
 const changed=(patch)=>approval.checkApproval(token,p.proposalId,{...p.draft,...patch});
 assert.match(changed({payerEmail:"someone@else.example"}).reason,/payer email/);
 assert.match(changed({currency:"USD"}).reason,/currency/);
 assert.match(changed({items:[{...p.draft.items[0],unitAmount:"900.00"}]}).reason,/amount or items/);
 assert.match(approval.checkApproval(token,"other",p.draft).reason,/different invoice/);
 assert.match(approval.checkApproval(token.slice(0,-2)+"xx",p.proposalId,p.draft).reason,/not valid/);
 const old=approval.approve(p.proposalId,p.draft,Date.now()-16*60_000);
 assert.match(approval.checkApproval(old,p.proposalId,p.draft).reason,/15 minutes/);
});

async function connect(fake) {
 const server=mcp.buildPayServer(()=>fake);
 const [a,b]=InMemoryTransport.createLinkedPair();
 const c=new Client({name:"test",version:"1"});
 await Promise.all([server.connect(a),c.connect(b)]);
 return c;
}
function fakePayPal(status="UNPAID",due="2026-11-03") {
 const made=[];
 return {made,
  createDraft:async d=>{made.push(d);return {id:"INV2-TEST",status:"DRAFT"};},
  send:async id=>({id,status:"UNPAID",amount:{currency_code:"AUD",value:"500.00"}}),
  status:async id=>({id,status,dueDate:due,amount:{currency_code:"AUD",value:"500.00"},payerEmail:"sam@harbourbakery.example",href:"https://www.sandbox.paypal.com/invoice/p/#INV2-TEST"})};
}

test("MCP: the four tools are listed; send_invoice creates nothing without the person's approval",async()=>{
 const fake=fakePayPal();const c=await connect(fake);
 const names=(await c.listTools()).tools.map(t=>t.name).sort();
 assert.deepEqual(names,["draft_payment_reminder","invoice_status","propose_invoice","send_invoice"]);
 const proposed=(await c.callTool({name:"propose_invoice",arguments:{}})).structuredContent;
 assert.equal(fake.made.length,0,"proposing creates nothing in PayPal");
 const refused=await c.callTool({name:"send_invoice",arguments:{proposalId:proposed.proposalId}});
 assert.equal(refused.isError,true);assert.equal(fake.made.length,0);
 const forged=await c.callTool({name:"send_invoice",arguments:{proposalId:proposed.proposalId,approvalToken:"abc.def"}});
 assert.equal(forged.isError,true);assert.equal(fake.made.length,0);
});

test("MCP: with the person's approval the invoice is created and sent, and status is read back",async()=>{
 const fake=fakePayPal("PAID");const c=await connect(fake);
 const p=flow.proposeInvoice({});
 const sent=await c.callTool({name:"send_invoice",arguments:{proposalId:p.proposalId,approvalToken:approval.approve(p.proposalId,p.draft)}});
 assert.equal(sent.isError,undefined);
 assert.equal(sent.structuredContent.invoice.id,"INV2-TEST");
 assert.equal(fake.made.length,1);assert.equal(fake.made[0].payerEmail,p.draft.payerEmail);
 const status=await c.callTool({name:"invoice_status",arguments:{invoiceId:"INV2-TEST"}});
 assert.equal(status.structuredContent.invoice.status,"PAID");
});

test("reminder: drafts for an unpaid invoice past its due date and never sends",async()=>{
 const late=flow.draftPaymentReminder({id:"x",status:"UNPAID",dueDate:"2026-10-01",amount:{currency_code:"AUD",value:"500.00"},payerEmail:"sam@harbourbakery.example"},"Sam Patel",new Date(2026,9,27));
 assert.equal(late.status,"draft");assert.equal(late.sent,false);assert.match(late.body,/Hi Sam/);
 assert.equal(flow.draftPaymentReminder({id:"x",status:"PAID",dueDate:"2026-10-01"},"Sam",new Date(2026,9,27)).status,"not_needed");
 assert.equal(flow.draftPaymentReminder({id:"x",status:"UNPAID",dueDate:"2026-12-01"},"Sam",new Date(2026,9,27)).status,"not_needed");
 const c=await connect(fakePayPal("UNPAID","2020-01-01"));
 const r=await c.callTool({name:"draft_payment_reminder",arguments:{invoiceId:"INV2-TEST"}});
 assert.equal(r.structuredContent.reminder.sent,false);
});
