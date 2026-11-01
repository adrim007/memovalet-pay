// The home search bar's dropdown and its recent searches, run against fakes:
// no browser, no network. What matters most: history shows when the box is
// empty, typing puts the search itself first, and the list never repeats or
// grows without limit. Web mode adds websites, suggestions and saved links.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file, modules = {}, extra = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, require: (name) => modules[name] ?? require(name),
    URL, console: { error() {} }, ...extra,
  });
  return module.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const menu = () => compile('lib/searchMenu.ts');
const recent = (query, scope = 'MemoValet', at = 1) => ({ query, scope, at });

// ------------------------------------------------------------ mergeRecent

test('a new search goes to the top, and repeating one moves it rather than duplicating', () => {
  const { mergeRecent } = menu();
  let list = [];
  list = mergeRecent(list, recent('budget', 'MemoValet', 1));
  list = mergeRecent(list, recent('orion', 'MemoValet', 2));
  list = mergeRecent(list, recent('  Budget ', 'MemoValet', 3));
  assert.deepEqual(plain(list).map((item) => item.query), ['Budget', 'orion']);
});

test('the same words in Web and MemoValet are kept separately', () => {
  const { mergeRecent } = menu();
  const list = mergeRecent([recent('tiles', 'Web')], recent('tiles', 'MemoValet'));
  assert.deepEqual(plain(list).map((item) => item.scope), ['MemoValet', 'Web']);
});

test('an empty search is never remembered, and the list stops at 8', () => {
  const { mergeRecent } = menu();
  assert.equal(mergeRecent([], recent('   ')).length, 0);
  let list = [];
  for (let i = 0; i < 12; i++) list = mergeRecent(list, recent(`search ${i}`, 'MemoValet', i));
  assert.equal(list.length, 8);
  assert.equal(list[0].query, 'search 11');
});

// ---------------------------------------------------------- searchOptions

const recents = [recent('orion pricing'), recent('priya interview'), recent('orion contract'), recent('best tiles', 'Web')];
const matches = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, kind: 'Meeting', title: `Orion sync ${i}`, href: `/history/m${i}` }));
const links = [
  { id: 'l1', title: 'Bathroom tile samples', url: 'https://tiles.example.com/samples' },
  { id: 'l2', title: 'Orion brand guidelines', url: 'https://orion.example.com/brand' },
];

test('clicking into an empty box shows that mode’s recent searches only', () => {
  const { searchOptions } = menu();
  const options = plain(searchOptions({ query: '', scope: 'MemoValet', recents, matches }));
  assert.deepEqual(options.map((option) => [option.type, option.recent.query]), [
    ['recent', 'orion pricing'], ['recent', 'priya interview'], ['recent', 'orion contract'],
  ]);
});

test('typing puts the search first, then matching history, then matching items', () => {
  const { searchOptions } = menu();
  const options = plain(searchOptions({ query: 'orion', scope: 'MemoValet', recents, matches, suggestions: ['orion x'], links }));
  assert.equal(options[0].type, 'action');
  assert.equal(options[0].label, 'Ask MemoValet “orion”');
  assert.deepEqual(options.filter((o) => o.type === 'recent').map((o) => o.recent.query), ['orion pricing', 'orion contract']);
  assert.equal(options.filter((o) => o.type === 'match').length, 6, 'at most six items');
  assert.equal(options.filter((o) => o.type === 'suggestion' || o.type === 'link').length, 0, 'web results stay in Web mode');
});

test('history identical to what is typed is not listed twice', () => {
  const { searchOptions } = menu();
  const options = plain(searchOptions({ query: 'Orion Pricing', scope: 'MemoValet', recents, matches: [] }));
  assert.deepEqual(options.map((o) => o.type), ['action']);
});

test('web mode: Google first, then web history, then suggestions, then matching saved links, never meetings', () => {
  const { searchOptions } = menu();
  const options = plain(searchOptions({ query: 'tiles', scope: 'Web', recents, matches, suggestions: ['tiles melbourne', 'tiles near me'], links }));
  assert.deepEqual(options.map((o) => o.type), ['action', 'recent', 'suggestion', 'suggestion', 'link']);
  assert.equal(options[0].label, 'Search Google for “tiles”');
  assert.equal(options[1].recent.query, 'best tiles');
  assert.deepEqual(options.slice(2, 4).map((o) => o.query), ['tiles melbourne', 'tiles near me']);
  assert.equal(options[4].link.id, 'l1', 'matched by its address');
});

test('suggestions never repeat what you typed or your history, and stop at six', () => {
  const { searchOptions } = menu();
  const suggestions = ['Tiles', 'best tiles', 'tiles 1', 'tiles 2', 'Tiles 2', '  ', 'tiles 3', 'tiles 4', 'tiles 5', 'tiles 6', 'tiles 7'];
  const options = plain(searchOptions({ query: 'tiles', scope: 'Web', recents, matches: [], suggestions }));
  assert.deepEqual(options.filter((o) => o.type === 'suggestion').map((o) => o.query), ['tiles 1', 'tiles 2', 'tiles 3', 'tiles 4', 'tiles 5', 'tiles 6']);
});

test('a web address opens the site itself, with a Google search as the second choice', () => {
  const { searchOptions, websiteFromQuery } = menu();
  assert.equal(websiteFromQuery('abc.com.au'), 'https://abc.com.au/');
  assert.equal(websiteFromQuery('http://Example.org/path?x=1'), 'http://example.org/path?x=1');
  assert.equal(websiteFromQuery(' www.bunnings.com.au/tiles '), 'https://www.bunnings.com.au/tiles');
  const options = plain(searchOptions({ query: 'https://abc.com.au', scope: 'Web', recents: [], matches: [] }));
  assert.deepEqual(options.map((o) => [o.type, o.label]), [['site', 'Go to abc.com.au'], ['action', 'Search Google for “https://abc.com.au”']]);
  assert.equal(options[0].url, 'https://abc.com.au/');
});

test('ordinary words, file names and unsafe links are searched, never opened', () => {
  const { websiteFromQuery, searchOptions } = menu();
  for (const text of ['best tiles', 'node.js', 'report.pdf', 'javascript:alert(1)', 'hello.', '.com', 'data:text/html,hi', 'ftp://abc.com', 'a b.com', '']) {
    assert.equal(websiteFromQuery(text), null, text);
  }
  assert.equal(searchOptions({ query: 'abc.com.au', scope: 'MemoValet', recents: [], matches: [] })[0].type, 'action', 'MemoValet mode never opens websites');
});

test('Create mode has no dropdown', () => {
  const { searchOptions } = menu();
  assert.equal(searchOptions({ query: 'meeting', scope: 'Create', recents, matches }).length, 0);
});

test('matching words are highlighted wherever they appear, in any case', () => {
  const { highlightParts } = menu();
  assert.deepEqual(plain(highlightParts('Orion sync with orion', 'ORION')), [
    { text: 'Orion', match: true }, { text: ' sync with ', match: false }, { text: 'orion', match: true },
  ]);
  assert.deepEqual(plain(highlightParts('Budget', 'zzz')), [{ text: 'Budget', match: false }]);
  assert.deepEqual(plain(highlightParts('Budget', '')), [{ text: 'Budget', match: false }]);
});

// ------------------------------------------------------ recentSearches store

function store(initial) {
  const data = new Map(initial === undefined ? [] : [['mf-recent-searches', initial]]);
  const localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
  const lib = compile('lib/recentSearches.ts', { './searchMenu': menu() }, { localStorage });
  const saved = () => JSON.parse(data.get('mf-recent-searches') || '[]');
  return { ...lib, saved };
}

test('searches are remembered on this device and can be forgotten one at a time', () => {
  const s = store();
  s.rememberSearch('orion', 'MemoValet');
  s.rememberSearch('tiles', 'Web');
  s.rememberSearch('budget', 'MemoValet');
  assert.deepEqual(s.saved().map((item) => item.query), ['budget', 'tiles', 'orion']);
  s.forgetSearch('tiles', 'Web');
  assert.deepEqual(s.saved().map((item) => item.query), ['budget', 'orion']);
});

test('clearing history only clears the mode you are in', () => {
  const s = store();
  s.rememberSearch('orion', 'MemoValet');
  s.rememberSearch('tiles', 'Web');
  s.clearRecentSearches('MemoValet');
  assert.deepEqual(s.saved().map((item) => [item.query, item.scope]), [['tiles', 'Web']]);
});

test('broken or tampered storage reads as empty instead of crashing', () => {
  assert.equal(store('not json').getRecentSearchesSnapshot().length, 0);
  assert.equal(store('{"query":"x"}').getRecentSearchesSnapshot().length, 0);
  const mixed = store(JSON.stringify([{ query: 'ok', scope: 'Web', at: 1 }, { query: 5, scope: 'Web', at: 2 }, { query: 'bad', scope: 'Other', at: 3 }]));
  assert.deepEqual(plain(mixed.getRecentSearchesSnapshot()).map((item) => item.query), ['ok']);
});

test('the server render never sees anyone’s history', () => {
  const s = store(JSON.stringify([{ query: 'private', scope: 'Web', at: 1 }]));
  assert.equal(s.getRecentSearchesServerSnapshot().length, 0);
});

// ------------------------------------------------- web suggestions (Brave)

// Each reply answers one call, in order; the last one repeats.
function suggestLib(...replies) {
  const calls = [];
  const fakeFetch = async (url, init) => {
    const reply = replies[Math.min(calls.length, replies.length - 1)];
    calls.push({ url, headers: init.headers });
    if (reply instanceof Error) throw reply;
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  const lib = compile('lib/webSuggest.ts', {}, { fetch: fakeFetch, AbortSignal });
  return Object.assign({}, lib, { calls });
}
const sent = (call) => new URL(call.url).searchParams;
const tilesReply = { status: 200, body: { results: [{ query: 'tiles melbourne' }] } };

test('without a Brave key, nothing is sent anywhere', async () => {
  const s = suggestLib(tilesReply);
  assert.equal((await s.fetchWebSuggestions('tiles', {})).length, 0);
  assert.equal(s.calls.length, 0);
});

test('Brave is asked with the key in a header, never in the address, and only the words come back', async () => {
  const s = suggestLib({ status: 200, body: { type: 'suggest', results: [{ query: 'tiles melbourne', is_entity: false }, { query: 'Tiles Melbourne' }, { query: 42 }, { query: 'tile shop' }] } });
  const out = await s.fetchWebSuggestions(' tiles ', { apiKey: 'secret-key', country: 'AU', lang: 'en' });
  assert.deepEqual(plain(out), ['tiles melbourne', 'tile shop']);
  const url = new URL(s.calls[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.search.brave.com/res/v1/suggest/search');
  assert.equal(sent(s.calls[0]).get('q'), 'tiles');
  assert.equal(sent(s.calls[0]).get('country'), 'AU');
  assert.equal(sent(s.calls[0]).get('lang'), 'en');
  assert.ok(!s.calls[0].url.includes('secret-key'));
  assert.equal(s.calls[0].headers['X-Subscription-Token'], 'secret-key');
});

test('a Brave outage or slow reply means no suggestions, not a broken search bar', async () => {
  const busy = suggestLib({ status: 429, body: {} });
  assert.equal((await busy.fetchWebSuggestions('tiles', { apiKey: 'k', country: 'AU', lang: 'en' })).length, 0);
  assert.equal(busy.calls.length, 1, 'being busy is no reason to ask again');
  assert.equal((await suggestLib(new Error('timeout')).fetchWebSuggestions('tiles', { apiKey: 'k' })).length, 0);
});

test('if Brave refuses the country or language, it is asked once more without them', async () => {
  const s = suggestLib({ status: 422, body: { error: 'validation' } }, tilesReply);
  const out = await s.fetchWebSuggestions('tiles', { apiKey: 'k', country: 'ALL', lang: 'jp' });
  assert.deepEqual(plain(out), ['tiles melbourne']);
  assert.equal(s.calls.length, 2);
  assert.equal(sent(s.calls[1]).get('country'), null);
  assert.equal(sent(s.calls[1]).get('lang'), null);
  const bare = suggestLib({ status: 422, body: {} });
  assert.equal((await bare.fetchWebSuggestions('tiles', { apiKey: 'k' })).length, 0);
  assert.equal(bare.calls.length, 1, 'nothing to leave out, so no second try');
});

test('suggestions follow the visitor’s country, and worldwide ones cover everywhere else', () => {
  const { suggestionCountry } = suggestLib(tilesReply);
  assert.equal(suggestionCountry('au'), 'AU');
  assert.equal(suggestionCountry('GB'), 'GB');
  assert.equal(suggestionCountry('VN'), 'ALL');
  assert.equal(suggestionCountry(null), 'ALL');
});

test('suggestions come in the browser’s own language, spelled the way Brave expects', () => {
  const { suggestionLanguage } = suggestLib(tilesReply);
  const cases = {
    'en-AU,en;q=0.9': 'en',
    'en-GB,en;q=0.8': 'en-gb',
    'es-US,es;q=0.9,en;q=0.8': 'es',
    'fr-CA': 'fr',
    'ja-JP,ja;q=0.9': 'jp',
    'zh-TW,zh;q=0.9': 'zh-hant',
    'zh-Hant-HK': 'zh-hant',
    'zh-CN': 'zh-hans',
    'pt-BR': 'pt-br',
    'pt': 'pt-pt',
    'nn-NO': 'nb',
    'xx-YY, de;q=0.5': 'de',
    'en;q=0.2, it;q=0.9': 'it',
  };
  for (const [header, expected] of Object.entries(cases)) assert.equal(suggestionLanguage(header), expected, header);
  for (const header of [null, '', '*', 'xx', 'fr;q=0']) assert.equal(suggestionLanguage(header), null, String(header));
});

function suggestRoute({ user, key }) {
  const lib = suggestLib(tilesReply);
  const route = compile('app/api/search/suggest/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/webSuggest': lib,
  }, { process: { env: key ? { BRAVE_SEARCH_API_KEY: key } : {} } });
  return { GET: route.GET, calls: lib.calls };
}

test('signed-out visitors get no suggestions, and nothing is spent', async () => {
  const r = suggestRoute({ user: null, key: 'k' });
  const res = await r.GET(new Request('https://memovalet.com/api/search/suggest?q=tiles'));
  assert.equal(res.status, 401);
  assert.equal(r.calls.length, 0);
});

test('signed in with Brave set up: suggestions come back in the visitor’s country and language', async () => {
  const r = suggestRoute({ user: { id: 'u1' }, key: 'k' });
  const res = await r.GET(new Request('https://memovalet.com/api/search/suggest?q=tiles', {
    headers: { 'x-vercel-ip-country': 'AU', 'accept-language': 'en-AU,en;q=0.9' },
  }));
  assert.equal(res.status, 200);
  assert.deepEqual(plain(await res.json()), { suggestions: ['tiles melbourne'], enabled: true });
  assert.equal(sent(r.calls[0]).get('country'), 'AU');
  assert.equal(sent(r.calls[0]).get('lang'), 'en');
  assert.match(res.headers.get('cache-control'), /private/);
  assert.match(res.headers.get('vary'), /Accept-Language/);
});

test('a visitor from a country Brave doesn’t cover gets worldwide suggestions in their language', async () => {
  const r = suggestRoute({ user: { id: 'u1' }, key: 'k' });
  await r.GET(new Request('https://memovalet.com/api/search/suggest?q=tiles', {
    headers: { 'x-vercel-ip-country': 'VN', 'accept-language': 'vi-VN,vi;q=0.9' },
  }));
  assert.equal(sent(r.calls[0]).get('country'), 'ALL');
  assert.equal(sent(r.calls[0]).get('lang'), 'vi');
});

test('before a Brave key is added, the bar is told suggestions are off', async () => {
  const r = suggestRoute({ user: { id: 'u1' } });
  const res = await r.GET(new Request('https://memovalet.com/api/search/suggest?q=tiles'));
  assert.deepEqual(plain(await res.json()), { suggestions: [], enabled: false });
  assert.equal(r.calls.length, 0);
});
