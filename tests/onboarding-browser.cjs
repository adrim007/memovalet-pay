// Run against a local build with ENABLE_PRODUCT_PREVIEW=1. No account is modified.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://localhost:3014';
(async () => {
 const browser = await chromium.launch({headless:true});
 const errors=[];
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const dialog=page.getByRole('dialog');
  const panel=page.locator('.memo-welcome-panel');
  const within=async()=>{
   await page.waitForFunction(()=>{const r=document.querySelector('.memo-welcome-panel')?.getBoundingClientRect();return r&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&(()=>{const t=document.querySelector('.memo-welcome-spotlight')?.getBoundingClientRect();return !t||r.right<=t.left||r.left>=t.right||r.bottom<=t.top||r.top>=t.bottom;})();},null,{timeout:3000});
   const b=await panel.boundingBox();const v=page.viewportSize();
   assert.ok(b && b.x>=0 && b.y>=0 && b.x+b.width<=v.width+1 && b.y+b.height<=v.height+1,JSON.stringify({b,v}));
  };
  await page.goto(base+'/preview?state=empty');
  await dialog.waitFor();
  await page.getByRole('heading',{name:'Welcome, Maya. Make yourself at home.'}).waitFor();
  await within();
  await page.screenshot({path:'/tmp/memovalet-welcome-desktop.png'});
  for(let i=0;i<18;i++) {
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('dialog')),true);
  }
  await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
  for(let step=2;step<=9;step++) {
   assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),String(step));
   await page.locator('.memo-welcome-spotlight').waitFor();await within();
   if(step===5){
    // Your own calendar: where Sync calendar lives.
    assert.match(await dialog.innerText(),/Library → Calendar → Sync calendar/);
   }
   if(step===4){
    assert.match(await dialog.innerText(),/Calendar tab/);
    await page.screenshot({path:'/tmp/memovalet-welcome-library.png'});
    await page.getByRole('button',{name:'Back',exact:true}).click();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'3');
    await page.getByRole('button',{name:'Next',exact:true}).click();
   }
   await page.getByRole('button',{name:'Next',exact:true}).click();
  }
  await page.getByRole('button',{name:'Explore my dashboard'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('memovalet:welcome:v1:preview-maya')),'done');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.equal(await page.getByRole('button',{name:'Show me around'}).evaluate(el=>el===document.activeElement),true);
  await page.reload();await page.waitForTimeout(700);assert.equal(await dialog.isVisible(),false);
  await page.getByRole('button',{name:'Show me around'}).click();
  await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.goto(base+'/preview?state=empty&tour=1');await dialog.waitFor();
  assert.equal(new URL(page.url()).searchParams.has('tour'),false);
  for(const viewport of [{width:1440,height:740},{width:1024,height:640},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
   await page.setViewportSize(viewport);
   await page.getByRole('button',{name:'Skip tour'}).click();
   await page.getByRole('button',{name:'Show me around'}).click();await within();
   await page.getByRole('button',{name:'Let’s begin',exact:true}).click();
   for(let step=2;step<=9;step++){
    await page.waitForTimeout(50);await within();
    if(viewport.width===1440&&step===2)await page.screenshot({path:'/tmp/memovalet-tour-search-fixed.png'});
    if(viewport.width===390&&step===4)await page.screenshot({path:'/tmp/memovalet-welcome-mobile.png'});
    if(viewport.width<768 && step>=3){
     const s=await page.locator('.memo-welcome-spotlight').boundingBox();
     assert.ok(s.x>=-10&&s.x+s.width<=viewport.width+10,JSON.stringify(s));
    }
    await page.getByRole('button',{name:'Next',exact:true}).click();
   }
   await within();
  }
  await page.getByRole('button',{name:'Sync your calendar',exact:true}).click();await page.waitForURL('**/preview/calendar**');
  // It lands with the sync window already open, and tidies the address.
  await page.getByRole('heading',{name:'Sync with your calendar'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.has('sync'),false);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.deepEqual(errors,[]);
  console.log('PASS: new-user welcome, 10 steps (with syncing your calendar), highlights, Back, focus trap, completion, dismissal, replay, mobile/landscape sizing and the Sync your calendar destination; no browser errors');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
