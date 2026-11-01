const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/schedule-text.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require,Date,Intl});
const parse = (text, zone='Australia/Melbourne', now='2026-09-25T15:00:00Z') => mod.exports.parseSchedule(text,zone,new Date(now));
test('tomorrow follows the user local day and preserves the specified time',()=>{
 assert.equal(parse('Call Sam tomorrow at 1pm').date,'2026-09-27');
 assert.equal(parse('Call Sam tomorrow at 1pm').at,'2026-09-27T03:00:00.000Z');
 assert.equal(parse('Call Sam tomorrow at 1pm','America/Los_Angeles').date,'2026-09-26');
});
test('date only deadlines stay all day across month and year boundaries',()=>{
 assert.equal(parse('Finish project tomorrow','Pacific/Auckland','2026-12-31T01:00:00Z').date,'2027-01-01');
 assert.equal(parse('Finish project 5 October 2027').at,null);
 assert.equal(parse('Finish project 29 February 2028').date,'2028-02-29');
 assert.equal(parse('Call Sam'),null);
});
test('weekdays and 24 hour times are supported',()=>{
 assert.equal(parse('meeting next Friday at 14:30').date,'2026-10-02');
 assert.equal(parse('meeting next Friday at 14:30').at,'2026-10-02T04:30:00.000Z');
 assert.equal(parse('tomorrow at noon').at,'2026-09-27T02:00:00.000Z');
});
test('daylight saving uses the target date offset and rejects skipped or repeated times',()=>{
 assert.equal(parse('5 October 2026 at 1pm').at,'2026-10-05T02:00:00.000Z');
 assert.throws(()=>parse('4 October 2026 at 2:30am'),/clocks change/);
 assert.throws(()=>parse('4 April 2027 at 2:30am'),/clocks change/);
});
test('ambiguous and invalid inputs require clarification',()=>{
 for (const text of ['03/04','tomorrow at 1','31 February 2027','tomorrow and next Friday']) assert.throws(()=>parse(text),text);
 assert.throws(()=>parse('tomorrow','Nowhere'),/timezone/);
});

test('date and time separated by task wording are combined in either order',()=>{
 for(const text of ['1pm call michelle tomorrow','tomorrow call Michelle at 1pm','call at 1pm Michelle tomorrow']) {
  assert.equal(parse(text).date,'2026-09-27');
  assert.equal(parse(text).at,'2026-09-27T03:00:00.000Z');
 }
 assert.equal(parse('14:30 finish project on 5 October 2026').at,'2026-10-05T03:30:00.000Z');
 for(const text of ['tomorrow call Sam Friday','1pm call Sam 2pm','tomorrow at 1pm and Friday']) assert.throws(()=>parse(text));
});
