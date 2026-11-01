const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, Intl, Date,
    require: name => name in mocks ? mocks[name] : load('lib/' + name.replace(/^\.\//, '') + '.ts', mocks),
  });
  return module.exports;
}
const { localDayStamp, timeZoneFromStamp, homeTimeZone } = load('lib/local-day.ts');
test('device day stamps follow local midnight and daylight saving', () => {
  const now = new Date('2026-10-06T21:00:00Z');
  assert.equal(localDayStamp('Australia/Melbourne', now), 'Australia/Melbourne|2026-10-07');
  assert.equal(localDayStamp('Pacific/Auckland', now), 'Pacific/Auckland|2026-10-07');
  assert.equal(localDayStamp('America/Los_Angeles', now), 'America/Los_Angeles|2026-10-06');
  assert.notEqual(localDayStamp('Australia/Melbourne', new Date('2026-10-07T12:59:59Z')), localDayStamp('Australia/Melbourne', new Date('2026-10-07T13:00:00Z')));
  assert.equal(localDayStamp('Australia/Melbourne', new Date('2026-10-03T16:30:00Z')), 'Australia/Melbourne|2026-10-04');
});
test('timezone cookies reject malformed and invalid zones', () => {
  assert.equal(timeZoneFromStamp(encodeURIComponent('Australia/Melbourne|2026-10-07')), 'Australia/Melbourne');
  for (const value of [undefined, '', '%', 'Mars/Olympus|2026-10-07', 'UTC|not-a-date', 'UTC|2026-10-07|extra']) assert.equal(timeZoneFromStamp(value),null);
});
test('Home always has a zone: device cookie, then the connection, then UTC', () => {
  const stamp = encodeURIComponent('Pacific/Auckland|2026-10-07');
  assert.equal(homeTimeZone(stamp, 'Australia/Melbourne'), 'Pacific/Auckland');
  assert.equal(homeTimeZone(undefined, 'Australia/Melbourne'), 'Australia/Melbourne');
  assert.equal(homeTimeZone('%', 'Australia/Melbourne'), 'Australia/Melbourne');
  assert.equal(homeTimeZone(undefined, 'Mars/Olympus'), 'UTC');
  assert.equal(homeTimeZone(undefined, null), 'UTC');
});
test('dashboard priorities query and classify deadlines on the viewer local day', async () => {
  const queried = [];
  const database = {
    listDueActionItems: async date => { queried.push(date); return [{id:'today',task:'Call Michelle',status:'todo',due_date:'2026-10-07'},{id:'yesterday',task:'Proposal',status:'todo',due_date:'2026-10-06'},{id:'tomorrow',task:'Future',status:'todo',due_date:'2026-10-08'}]; },
    listDueCommitments: async date => { queried.push(date); return []; },
    listDueMyTaskAssignments: async (user,date) => { assert.equal(user,'owner'); queried.push(date); return []; },
    listDueReminders: async () => [],
  };
  const { getAttentionItems } = load('lib/attention.ts', {'./database':database});
  const result = await getAttentionItems('owner',5,'Australia/Melbourne',new Date('2026-10-06T21:00:00Z'));
  assert.deepEqual(queried,['2026-10-07','2026-10-07','2026-10-07']);
  assert.equal(result.find(item=>item.title==='Call Michelle').type,'task_due_today');
  assert.equal(result.find(item=>item.title==='Proposal').type,'task_overdue');
  assert.equal(result.some(item=>item.title==='Future'),false);
});
