// The home bar's Create mode: what your words become, and where they're saved.
// Run against the pure rules, no browser. What matters most: plain words are a
// task, a keyword picks something else, and nothing is ever sent to anyone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, module, require });
  return module.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const { createIntent, createRequest, createHint } = compile('lib/createIntent.ts');
const intent = (text) => plain(createIntent(text));

test('plain words become a task on your Tasks page', () => {
  assert.deepEqual(intent('Call Sarah Friday'), { kind: 'task', text: 'Call Sarah Friday' });
  assert.deepEqual(plain(createRequest(createIntent('Call Sarah Friday'))), {
    url: '/api/commitments', body: { description: 'Call Sarah Friday', direction: 'i_owe' },
  });
});

test('starting with note, project or task picks what is made, and the keyword is dropped', () => {
  assert.deepEqual(intent('note: buy grout'), { kind: 'note', text: 'buy grout' });
  assert.deepEqual(intent('New project Orion rebrand'), { kind: 'project', text: 'Orion rebrand' });
  assert.deepEqual(intent('add a task – call Sarah'), { kind: 'task', text: 'call Sarah' });
  assert.deepEqual(intent('todo pay invoice'), { kind: 'task', text: 'pay invoice' });
  assert.deepEqual(intent('To-do: pay invoice'), { kind: 'task', text: 'pay invoice' });
  assert.deepEqual(plain(createRequest(createIntent('note buy grout'))), { url: '/api/notes', body: { body: 'buy grout' } });
  assert.deepEqual(plain(createRequest(createIntent('project Orion'))), { url: '/api/projects', body: { name: 'Orion' } });
});

test('"meeting" opens the meeting page, and files open Files, since neither is made from words', () => {
  assert.deepEqual(intent('meeting with Sarah'), { kind: 'meeting' });
  assert.deepEqual(intent('Start a meeting'), { kind: 'meeting' });
  assert.deepEqual(intent('document contract.pdf'), { kind: 'open', href: '/documents', label: 'Files' });
  assert.equal(createRequest(createIntent('meeting')), null);
});

test('a keyword on its own opens that page instead of saving something empty', () => {
  assert.deepEqual(intent('note'), { kind: 'open', href: '/notes', label: 'Notes' });
  assert.deepEqual(intent('new project'), { kind: 'open', href: '/projects', label: 'Projects' });
  assert.deepEqual(intent('task:'), { kind: 'open', href: '/tasks', label: 'Tasks' });
});

test('words that only contain a keyword are still a task', () => {
  assert.equal(intent('Book a meeting with Sarah').kind, 'task');
  assert.equal(intent('Notes from the call').kind, 'task');
  assert.equal(intent('projector repair').kind, 'task');
  assert.equal(intent('Filed tax return').kind, 'task');
});

test('nothing typed means nothing happens; spaces are tidied; long text is capped', () => {
  assert.equal(createIntent('   '), null);
  assert.deepEqual(intent('  call   Sarah  '), { kind: 'task', text: 'call Sarah' });
  assert.equal(intent('x'.repeat(900)).text.length, 500);
  assert.equal(intent('note ' + 'y'.repeat(6000)).text.length, 5000);
});

test('Create only saves to your own lists and never sends a task to anyone', () => {
  for (const text of ['Call Sarah', 'note hi', 'project Orion', 'task email Sarah', 'send Sarah the invoice']) {
    const request = createRequest(createIntent(text));
    assert.ok(!request.url.includes('task-assignments'), text);
  }
});

test('the hint says what will happen before you press Create', () => {
  assert.equal(createHint(null), 'Type a task, or start with “note”, “project” or “meeting”.');
  assert.equal(createHint(createIntent('Call Sarah')), 'Adds a task: “Call Sarah”');
  assert.equal(createHint(createIntent('note buy grout')), 'Saves a note: “buy grout”');
  assert.equal(createHint(createIntent('project Orion')), 'Makes a project: “Orion”');
  assert.equal(createHint(createIntent('meeting')), 'Opens the meeting page');
  assert.equal(createHint(createIntent('file')), 'Opens Files');
});

 test('leading dates and times preserve the requested item type and schedule', () => {
  for (const text of ['1pm meeting with Michelle tomorrow', 'tomorrow at 1pm schedule a meeting with Michelle', 'next Friday meeting with Michelle at 1pm']) assert.equal(intent(text).kind, 'meeting');
  for (const text of ['1pm finish a project Website tomorrow', 'tomorrow project Website at 1pm', '5 October 2027 project Website']) {
    const result=intent(text); assert.equal(result.kind,'project'); assert.match(result.text,/Website/);
    assert.equal(plain(createRequest(createIntent(text))).url,'/api/projects');
  }
  assert.equal(intent('1pm call the project manager tomorrow').kind,'task');
  assert.equal(intent('call Michelle about the meeting tomorrow').kind,'task');
  assert.equal(intent('1pm project Website tomorrow').text,'1pm Website tomorrow');
});
