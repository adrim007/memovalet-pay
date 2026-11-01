const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const moduleUnderTest={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/onboarding.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports});
const {shouldOfferWelcome,onboardingStorageKey,tourPanelPosition}=moduleUnderTest.exports;
test('welcome starts for empty new accounts, not established or completed accounts',()=>{
 assert.equal(shouldOfferWelcome(undefined,false),true);
 assert.equal(shouldOfferWelcome(undefined,true),false);
 assert.equal(shouldOfferWelcome(true,false),false);
 assert.equal(shouldOfferWelcome(true,true),false);
 assert.equal(shouldOfferWelcome(false,true),true);
});
test('dismissal storage is scoped to each account',()=>{
 assert.notEqual(onboardingStorageKey('alice'),onboardingStorageKey('bob'));
 assert.match(onboardingStorageKey('alice'),/v1:alice$/);
});
test('tour cards stay within small, landscape and desktop viewports',()=>{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]){
  for(const target of [null,{left:24,top:150,width:190,height:48},{left:260,top:-100,width:1050,height:200},{left:20,top:1200,width:100,height:44}]){
   const panel={width:Math.min(440,viewport.width-32),height:Math.min(640,viewport.height-32)};
   const p=tourPanelPosition(viewport,panel,target);
   assert.ok(p.left>=16&&p.top>=16,JSON.stringify(p));
   assert.ok(p.left+panel.width<=viewport.width-16,JSON.stringify(p));
   assert.ok(p.top+(p.maxHeight ?? panel.height)<=viewport.height-16,JSON.stringify(p));
  }
 }
});
test('wide search controls remain uncovered even when the guide must scroll',()=>{
 for(const viewport of [{width:1440,height:740},{width:1024,height:640},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
  const target={left:16,top:16,width:viewport.width-32,height:180};
  const panel={width:Math.min(360,viewport.width-32),height:360};
  const p=tourPanelPosition(viewport,panel,target);
  const height=p.maxHeight??panel.height;
  assert.ok(p.top>=target.top+target.height+16 || p.top+height<=target.top-16);
  assert.ok(p.top+height<=viewport.height-16);
 }
});
test('desktop navigation steps sit alongside their highlighted destination',()=>{
 const p=tourPanelPosition({width:1440,height:1000},{width:440,height:500},{left:24,top:200,width:208,height:48});
 assert.equal(p.left,256);
 assert.equal(p.top,176);
});
