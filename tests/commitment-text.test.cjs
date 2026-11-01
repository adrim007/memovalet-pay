// A task you make for yourself (Create on Home) is saved as something you owe
// with no one attached. It used to read "Someone" on Work and "You promised
// someone: …" in Needs you. It is named by what it is instead.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/commitment-text.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded });
const { commitmentHeading, commitmentAttentionTitle } = loaded.exports;

const mine = { person_name: null, direction: 'i_owe', description: 'Send the proposal tomorrow at 10am' };

test('a task you made for yourself has no "Someone" over it, and no "you promised someone"', () => {
  assert.equal(commitmentHeading(mine), null);
  assert.equal(commitmentHeading({ ...mine, person_name: '   ' }), null);
  assert.equal(commitmentAttentionTitle(mine), 'Send the proposal tomorrow at 10am');
});

test('promises that name a person keep the person', () => {
  const james = { person_name: 'James', direction: 'i_owe', description: 'Send updated pricing' };
  assert.equal(commitmentHeading(james), 'James');
  assert.equal(commitmentAttentionTitle(james), 'You promised James: Send updated pricing');
});

test('something owed to you still says who owes it, or Someone', () => {
  const sarah = { person_name: 'Sarah', direction: 'they_owe', description: 'Signed contract' };
  assert.equal(commitmentAttentionTitle(sarah), 'Sarah owes you: Signed contract');
  const unknown = { person_name: null, direction: 'they_owe', description: 'Signed contract' };
  assert.equal(commitmentHeading(unknown), 'Someone');
  assert.equal(commitmentAttentionTitle(unknown), 'Someone owes you: Signed contract');
});

test('the Work list and Needs you both use these words', () => {
  assert.match(fs.readFileSync('components/CommitmentsList.tsx', 'utf8'), /commitmentHeading\(c\)/);
  assert.doesNotMatch(fs.readFileSync('components/CommitmentsList.tsx', 'utf8'), /\|\| "Someone"/);
  assert.match(fs.readFileSync('lib/attention.ts', 'utf8'), /commitmentAttentionTitle\(commitment\)/);
});
