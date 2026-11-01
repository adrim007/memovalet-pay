const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},env={}){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date,URL,console,process:{env},require:n=>n in mocks?mocks[n]:n==='server-only'?{}:n.startsWith('@/')?load(n.slice(2)+'.ts',mocks,env):require(n)});return mod.exports;}
const env={BILLING_ENABLED:'true',BILLING_ENTITLEMENTS_VERIFIED:'true',BILLING_REQUIRED_FROM:'2026-10-01T00:00:00Z',STRIPE_SECRET_KEY:'unit-test-placeholder',STRIPE_BILLING_WEBHOOK_SECRET:'unit-test-placeholder',STRIPE_PRICE_MEMBER_MONTH:'price_member_month',STRIPE_PRICE_MEMBER_YEAR:'price_member_year',STRIPE_PRICE_BUSINESS_MONTH:'price_business_month',STRIPE_PRICE_BUSINESS_YEAR:'price_business_year'};
test('only validated plans and server configured amounts can be selected',()=>{const p=load('lib/billing-plans.ts');assert.equal(p.billingSelection('admin','month'),null);assert.equal(p.billingSelection('member','weekly'),null);assert.equal(p.billingAmount('member','month'),1900);assert.equal(p.billingAmount('business','year'),39000)});
test('trial and subscription access expires even if a webhook is delayed',()=>{const p=load('lib/billing-plans.ts');for(const status of ['none','past_due','canceled','unpaid','paused','incomplete'])assert.equal(p.hasBillingAccess({status,access_until:'2090-01-01'}),false);assert.equal(p.hasBillingAccess({status:'trialing',access_until:'2020-01-01'}),false);assert.equal(p.hasBillingAccess({status:'active',access_until:'2090-01-01'}),true)});

function setup(opts={}){
 const record={user_id:'u1',customer_id:'cus_1',subscription_id:null,status:'none',trial_used:false,...opts.record};let sessionArgs,sessionCount=0;
 const db={rpc:async()=>({data:opts.lock!==false,error:null}),from:()=>{let patch=null;return {select(){return this},eq(){return this},update(value){patch=value;return this},maybeSingle:async()=>({data:{...record},error:null}),then(resolve){if(patch)Object.assign(record,patch);return Promise.resolve({error:null}).then(resolve)}}}};
 const stripe={customers:{create:async()=>({id:'cus_1'})},subscriptions:{list:()=>opts.subscriptions||[]},prices:{retrieve:async()=>({id:'price_member_month',active:true,currency:'usd',unit_amount:opts.amount||1900,recurring:{interval:'month',interval_count:1,usage_type:'licensed'}})},checkout:{sessions:{list:()=>opts.sessions||[],expire:async()=>{},create:async args=>{sessionCount++;sessionArgs=args;return {url:'https://checkout.stripe.com/test'}}}}};
 const billing=load('lib/billing.ts',{'@/lib/supabase/service':{createServiceClient:()=>db},'@/lib/stripe':{getStripe:()=>stripe}},{...env,...opts.env});
 return {billing,record,args:()=>sessionArgs,count:()=>sessionCount};
}
test('new trial requires card collection, lasts 14 days and uses authenticated owner',async()=>{const s=setup();await s.billing.startCheckout({id:'u1'},'member','month');assert.equal(s.args().subscription_data.trial_period_days,14);assert.equal(s.args().payment_method_collection,'always');assert.equal(s.args().mode,'subscription');assert.equal(s.args().client_reference_id,'u1');assert.equal(s.args().customer,'cus_1');assert.equal(s.args().line_items[0].quantity,1)});
test('a returning account cannot receive another free trial',async()=>{const s=setup({record:{trial_used:true}});await s.billing.startCheckout({id:'u1'},'member','month');assert.equal(s.args().subscription_data.trial_period_days,undefined)});
test('an unfinished checkout is reused rather than duplicated',async()=>{const s=setup({sessions:[{mode:'subscription',metadata:{memovalet_user_id:'u1',plan:'member',interval:'month'},url:'https://checkout.stripe.com/existing'}]});assert.equal(await s.billing.startCheckout({id:'u1'},'member','month'),'https://checkout.stripe.com/existing');assert.equal(s.count(),0)});
test('price mismatch and concurrent request block checkout',async()=>{await assert.rejects(setup({amount:1}).billing.startCheckout({id:'u1'},'member','month'),/temporarily unavailable/);await assert.rejects(setup({lock:false}).billing.startCheckout({id:'u1'},'member','month'),/already being processed/)});
test('existing subscription prevents a second subscription and records prior trial',async()=>{const s=setup({subscriptions:[{id:'sub_1',created:1,status:'active',trial_start:1,trial_end:null,metadata:{memovalet_user_id:'u1',plan:'member'},items:{data:[{current_period_end:4000000000}]}}]});await assert.rejects(s.billing.startCheckout({id:'u1'},'member','month'),/already have a subscription/);assert.equal(s.record.trial_used,true);assert.equal(s.count(),0)});
test('webhook rejects invalid signatures and does not trust connected account events',async()=>{
 let writes=0;const mocks={'next/server':{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}},'@/lib/stripe':{getStripe:()=>({webhooks:{constructEvent:()=>{throw Error('bad')}}})},'@/lib/supabase/service':{createServiceClient:()=>{writes++;throw Error('no writes')}}};
 const r=load('app/api/billing/webhook/route.ts',mocks,env);assert.equal((await r.POST(new Request('https://example.com',{method:'POST',body:'invalid'}))).status,400);assert.equal(writes,0);
});

test('checkout rejects unsigned requests, foreign origins and unapproved plans',async()=>{
 let user=null, calls=0;
 const mocks={'next/server':{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})}})},'@/lib/billing':{startCheckout:async owner=>{calls++;assert.equal(owner.id,'owner');return 'https://checkout.stripe.com/test'}}};
 const route=load('app/api/billing/checkout/route.ts',mocks,env).POST;
 const request=(origin='https://memovalet.com',plan='member')=>new Request('https://memovalet.com/api/billing/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({plan,interval:'month',userId:'someone-else',amount:1})});
 assert.equal((await route(request())).status,401);user={id:'owner'};
 assert.equal((await route(request('https://attacker.example'))).status,403);
 assert.equal((await route(request('https://memovalet.com','free'))).status,400);
 assert.equal((await route(request())).status,200);assert.equal(calls,1);
});
test('portal always uses the signed in customer, ignoring supplied customer IDs',async()=>{
 let selected;
 const mocks={'next/server':{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})}})},'@/lib/billing':{billingAccount:async id=>{assert.equal(id,'owner');return {customer_id:'cus_owner'}},billingOrigin:()=> 'https://memovalet.com'},'@/lib/stripe':{getStripe:()=>({billingPortal:{sessions:{create:async args=>{selected=args.customer;return {url:'https://billing.stripe.com/test'}}}}})}};
 const route=load('app/api/billing/portal/route.ts',mocks,env).POST;
 assert.equal((await route(new Request('https://memovalet.com/api/billing/portal',{method:'POST',headers:{origin:'https://memovalet.com'},body:JSON.stringify({customerId:'cus_someone_else'})}))).status,200);
 assert.equal(selected,'cus_owner');
});

test('Stripe credentials cannot open checkout before paid feature verification',async()=>{const s=setup({env:{BILLING_ENTITLEMENTS_VERIFIED:undefined}});assert.equal(s.billing.billingReady(),false);await assert.rejects(s.billing.startCheckout({id:'u1'},'member','month'),/not available/);assert.equal(s.count(),0)});

test('Business checkout charges the selected seat quantity and never trusts fractional seats',async()=>{
 const s=setup({amount:3900});await s.billing.startCheckout({id:'u1'},'business','month',4);
 assert.equal(s.args().line_items[0].quantity,4);assert.equal(s.args().metadata.seats,'4');
 for(const n of [0,-1,1.5,51,NaN]) await assert.rejects(s.billing.startCheckout({id:'u1'},'business','month',n),/seats/);
 await assert.rejects(s.billing.startCheckout({id:'u1'},'member','month',2),/seats/);
});
test('subscription permissions follow verified Stripe prices instead of editable plan metadata',async()=>{
 const base={id:'sub',created:1,status:'active',trial_start:null,trial_end:null,metadata:{memovalet_user_id:'u1',plan:'business'},items:{data:[{current_period_end:4000000000,quantity:1,price:{id:'price_member_month',currency:'usd',unit_amount:1900,recurring:{interval:'month'}}}]}};
 const s=setup({subscriptions:[base]});await assert.rejects(s.billing.startCheckout({id:'u1'},'member','month'),/already have/);assert.equal(s.record.plan,'member');assert.equal(s.record.seats,1);
 base.items.data[0].price.id='price_unapproved';const invalid=setup({subscriptions:[base]});await assert.rejects(invalid.billing.startCheckout({id:'u1'},'member','month'),/already have/);assert.equal(invalid.record.plan,null);
});
