// The home page, arranged the way each person wants it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/home-layout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded });
const { HOME_CARDS, DEFAULT_HOME_LAYOUT, homeLayout, moveCard, toggleCard, cardWidths } = loaded.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('nothing saved is the usual home page', () => {
  assert.deepEqual(plain(homeLayout(undefined)), plain(DEFAULT_HOME_LAYOUT));
  assert.deepEqual(plain(homeLayout('nonsense')), plain(DEFAULT_HOME_LAYOUT));
});

test('a saved order is kept, with junk and repeats dropped', () => {
  const layout = homeLayout({ order: ['glance', 'search', 'glance', 'made-up', 'up-next'], hidden: ['weather', 'bogus'] });
  assert.deepEqual(plain(layout.order.slice(0, 3)), ['glance', 'search', 'up-next']);
  assert.equal(layout.order.length, HOME_CARDS.length, 'every card still has a place');
  assert.deepEqual(plain(layout.hidden), ['weather']);
});

test('a card added to MemoValet after a layout was saved still appears, at the end', () => {
  // An old layout that knew nothing of "Recent files".
  const layout = homeLayout({ order: ['search', 'shortcuts', 'up-next', 'needs-you', 'glance'] });
  assert.equal(layout.order.at(-1), 'recent-files');
  assert.ok(!layout.hidden.includes('recent-files'));
});

test('a layout saved with the old "Send something" card still loads, without it', () => {
  // Its links moved into Quick actions. Someone who arranged their page
  // around it, or hid it, loses nothing else.
  const layout = homeLayout({ order: ['send', 'glance', 'search', 'shortcuts', 'needs-you', 'up-next', 'recent-files'], hidden: ['send', 'weather'] });
  assert.ok(!layout.order.includes('send'));
  assert.deepEqual(plain(layout.order.slice(0, 2)), ['glance', 'search'], 'the rest of their order is kept');
  assert.deepEqual(plain(layout.hidden), ['weather']);
  assert.equal(layout.order.length, HOME_CARDS.length);
});

test('quick actions on Home are verbs, with a meeting as one of them, not the lead', () => {
  const home = fs.readFileSync('components/HomeWorkspace.tsx', 'utf8');
  const actions = home.slice(home.indexOf('function QuickActions'), home.indexOf('// The dot repeats'));
  for (const label of ['Send a task', 'Write a note', 'Start a meeting', 'Share a file']) assert.match(actions, new RegExp(label));
  assert.match(actions, /path: "\/meeting"/, 'the meeting action goes to the meeting launchpad');
  // A personal assistant, not a meeting app: no action is styled above the others.
  assert.doesNotMatch(actions, /brand-gradient-bg/);
  assert.ok(actions.indexOf('Send a task') < actions.indexOf('Start a meeting'), 'and it does not come first');
  assert.match(home, /case "shortcuts":\s*return <QuickActions/, 'and the Quick actions card renders it');
  assert.ok(HOME_CARDS.some((card) => card.id === 'shortcuts' && card.label === 'Quick actions'));
});

test('moving a card up and down, and not off either end', () => {
  const up = moveCard(DEFAULT_HOME_LAYOUT, 'glance', -1);
  assert.ok(up.order.indexOf('glance') < DEFAULT_HOME_LAYOUT.order.indexOf('glance'));
  assert.equal(moveCard(DEFAULT_HOME_LAYOUT, 'search', -1), DEFAULT_HOME_LAYOUT);
  assert.equal(moveCard(DEFAULT_HOME_LAYOUT, DEFAULT_HOME_LAYOUT.order.at(-1), 1), DEFAULT_HOME_LAYOUT);
});

test('hiding and showing again', () => {
  const hidden = toggleCard(DEFAULT_HOME_LAYOUT, 'glance', false);
  assert.deepEqual(plain(hidden.hidden), ['glance']);
  assert.deepEqual(plain(toggleCard(hidden, 'glance', true).hidden), []);
});

test('the default page gives attention and active work equal room with compact full-width stats', () => {
  const widths = Object.fromEntries(cardWidths(DEFAULT_HOME_LAYOUT).map((card) => [card.id, card.span]));
  assert.deepEqual(widths, { search: 12, shortcuts: 12, 'needs-you': 6, 'up-next': 6, glance: 12, 'recent-files': 12 });
});

test('hiding a card never leaves a hole: every row still fills the page', () => {
  for (const id of DEFAULT_HOME_LAYOUT.order) {
    const cards = cardWidths(toggleCard(DEFAULT_HOME_LAYOUT, id, false));
    let used = 0;
    for (const card of cards) {
      if (used + card.span > 12) { assert.equal(used, 12, `a gap before ${card.id} with ${id} hidden`); used = 0; }
      used += card.span;
    }
    assert.equal(used, 12, `the last row falls short with ${id} hidden`);
  }
});

test('any order at all still fills every row', () => {
  let layout = DEFAULT_HOME_LAYOUT;
  for (let round = 0; round < 20; round++) {
    const id = layout.order[(round * 5) % layout.order.length];
    layout = moveCard(layout, id, round % 2 ? 1 : -1);
    let used = 0;
    for (const card of cardWidths(layout)) {
      if (used + card.span > 12) { assert.equal(used, 12); used = 0; }
      used += card.span;
    }
    assert.equal(used, 12);
  }
});
