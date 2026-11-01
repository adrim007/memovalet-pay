// Address suggestions for location boxes (sending a job, a task's location),
// run against fakes: no network. The browser asks Geoapify itself, using a key
// and rough location handed to signed-in users. What matters most: nothing is
// asked without a key or a few letters, results stay in the typist's country,
// the key never lands in a log or reaches anyone signed out, and a slow or
// abandoned lookup just means plain typing.
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
    URL, AbortSignal, setTimeout, clearTimeout, console: { error() {}, warn() {} }, ...extra,
  });
  return module.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

// Each reply answers one call, in order; the last one repeats.
function addressLib(...replies) {
  const calls = [];
  const logged = [];
  const fakeFetch = async (url, init) => {
    const reply = replies[Math.min(calls.length, replies.length - 1)];
    calls.push({ url, init });
    if (reply instanceof Error) throw reply;
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  const lib = compile('lib/addressSuggest.ts', {}, {
    fetch: fakeFetch,
    console: { error: (...args) => logged.push(args.map(String).join(' ')), warn: (...args) => logged.push(args.map(String).join(' ')) },
  });
  return Object.assign({}, lib, { calls, logged });
}
const sent = (call) => new URL(call.url).searchParams;
const row = (formatted, line1, line2, id) => ({ formatted, address_line1: line1, address_line2: line2, place_id: id, lat: -37.77, lon: 144.96 });
const geoapify = (...rows) => ({ status: 200, body: { results: rows } });
const brunswick = geoapify(row('190 Sydney Road, Brunswick VIC 3056, Australia', '190 Sydney Road', 'Brunswick VIC 3056, Australia', 'p1'));

// ------------------------------------------------------------------ lookups

test('without a Geoapify key, or with fewer than 3 letters, nothing is sent', async () => {
  const s = addressLib(brunswick);
  assert.equal((await s.fetchAddressSuggestions('190 Sydney', {})).length, 0);
  assert.equal((await s.fetchAddressSuggestions('19', { apiKey: 'k' })).length, 0);
  assert.equal(s.calls.length, 0);
});

test('Geoapify is asked for five addresses in the typist’s own country, nearest first, in their language', async () => {
  const s = addressLib(brunswick);
  const out = await s.fetchAddressSuggestions(' 190 sydney road, ', {
    apiKey: 'secret-key', near: { latitude: -37.77, longitude: 144.96 }, country: 'AU', lang: 'en',
  });
  assert.deepEqual(plain(out), [
    { id: 'p1', label: '190 Sydney Road, Brunswick VIC 3056, Australia', main: '190 Sydney Road', secondary: 'Brunswick VIC 3056, Australia' },
  ]);
  const url = new URL(s.calls[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.geoapify.com/v1/geocode/autocomplete');
  assert.equal(sent(s.calls[0]).get('text'), '190 sydney road,');
  assert.equal(sent(s.calls[0]).get('format'), 'json');
  assert.equal(sent(s.calls[0]).get('limit'), '5');
  assert.equal(sent(s.calls[0]).get('filter'), 'countrycode:au', 'not Canada and the US first');
  assert.equal(sent(s.calls[0]).get('bias'), 'proximity:144.96,-37.77', 'longitude first, as Geoapify expects');
  assert.equal(sent(s.calls[0]).get('lang'), 'en');
  assert.equal(sent(s.calls[0]).get('apiKey'), 'secret-key');
});

test('with no location known, suggestions are still asked for, just not narrowed', async () => {
  const s = addressLib(brunswick);
  await s.fetchAddressSuggestions('190 Sydney', { apiKey: 'k', near: null, country: null, lang: null });
  assert.equal(sent(s.calls[0]).get('bias'), null);
  assert.equal(sent(s.calls[0]).get('filter'), null);
  assert.equal(sent(s.calls[0]).get('lang'), null);
  const odd = addressLib(brunswick);
  await odd.fetchAddressSuggestions('190 Sydney', { apiKey: 'k', country: 'a u;x' });
  assert.equal(sent(odd.calls[0]).get('filter'), null, 'a malformed country is ignored');
});

test('a first try that times out is made once more', async () => {
  const s = addressLib(new Error('TimeoutError'), brunswick);
  const out = await s.fetchAddressSuggestions('190 Sydney', { apiKey: 'k' });
  assert.equal(plain(out)[0].main, '190 Sydney Road');
  assert.equal(s.calls.length, 2);
});

test('if Geoapify still can’t answer, that is a failure, not “no addresses”, and the key never reaches the logs', async () => {
  const slow = addressLib(new Error('https://api.geoapify.com/?apiKey=secret-key timed out'));
  assert.equal(await slow.fetchAddressSuggestions('190 Sydney', { apiKey: 'secret-key' }), null);
  assert.equal(slow.calls.length, 2, 'two tries, no more');
  const down = addressLib({ status: 500, body: {} });
  assert.equal(await down.fetchAddressSuggestions('190 Sydney', { apiKey: 'secret-key' }), null);
  assert.equal(down.calls.length, 1, 'an error answer is not asked again');
  const nothing = addressLib(geoapify());
  assert.deepEqual(plain(await nothing.fetchAddressSuggestions('zzzz qqqq', { apiKey: 'k' })), [], 'no match at all is an empty list');
  for (const line of [...slow.logged, ...down.logged]) assert.ok(!line.includes('secret-key'), line);
});

test('once typing has moved on, the lookup stops: no second try and nothing logged', async () => {
  const already = new AbortController();
  already.abort();
  const idle = addressLib(brunswick);
  assert.equal(await idle.fetchAddressSuggestions('190 Sydney', { apiKey: 'k', signal: already.signal }), null);
  assert.equal(idle.calls.length, 0, 'moved on before asking: not asked at all');

  const midway = new AbortController();
  const busy = addressLib(new Error('AbortError'));
  const pending = busy.fetchAddressSuggestions('190 Sydney', { apiKey: 'k', signal: midway.signal });
  midway.abort();
  assert.equal(await pending, null);
  assert.equal(busy.calls.length, 1, 'no second try');
  assert.equal(busy.logged.length, 0);
});

// ------------------------------------------------------------------ results

test('results become a main line and the rest, without repeats, at most five', () => {
  const { parseAddressSuggestions } = addressLib(brunswick);
  const out = plain(parseAddressSuggestions({
    results: [
      row('190 Sydney Road, Brunswick VIC 3056, Australia', '190 Sydney Road', 'Brunswick VIC 3056, Australia', 'a'),
      row('190 SYDNEY ROAD, BRUNSWICK VIC 3056, AUSTRALIA', '190 Sydney Road', 'Brunswick', 'dupe'),
      { formatted: 42 },
      row('Brunswick VIC 3056, Australia', 'Brunswick VIC 3056, Australia', 'Brunswick VIC 3056, Australia', 'b'),
      row('Barkly Square', '', '', ''),
      ...['c', 'd', 'e', 'f'].map((id) => row(`${id} Road, Coburg VIC, Australia`, `${id} Road`, 'Coburg VIC, Australia', id)),
    ],
  }));
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((s) => s.id), ['a', 'b', 'Barkly Square', 'c', 'd']);
  assert.equal(out[1].secondary, '', 'no second line that just repeats the first');
  assert.deepEqual([out[2].main, out[2].secondary], ['Barkly Square', '']);
  assert.equal(parseAddressSuggestions(null).length, 0);
  assert.equal(parseAddressSuggestions({ results: 'nope' }).length, 0);
});

test('the browser’s language becomes a two-letter code, or nothing', () => {
  const { addressLanguage } = addressLib(brunswick);
  assert.equal(addressLanguage('en-AU,en;q=0.9'), 'en');
  assert.equal(addressLanguage('fr'), 'fr');
  assert.equal(addressLanguage('*'), null);
  assert.equal(addressLanguage(null), null);
});

// ------------------------------------------------------------- config route

function configRoute({ user, key }) {
  const lib = compile('lib/addressSuggest.ts', {}, { fetch: async () => { throw new Error('no network in tests'); } });
  const weather = compile('lib/weather.ts', {}, { fetch: async () => { throw new Error('no network in tests'); } });
  const route = compile('app/api/address/config/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/addressSuggest': lib,
    '@/lib/weather': weather,
  }, { process: { env: key ? { GEOAPIFY_API_KEY: key } : {} } });
  return route.GET;
}
const fromBrunswick = {
  'x-vercel-ip-latitude': '-37.7667',
  'x-vercel-ip-longitude': '144.9621',
  'x-vercel-ip-country': 'AU',
  'accept-language': 'en-AU,en;q=0.9',
};
const configRequest = (headers = {}) => new Request('https://memovalet.com/api/address/config', { headers });

test('signed-out visitors never get the key', async () => {
  const res = await configRoute({ user: null, key: 'secret-key' })(configRequest(fromBrunswick));
  assert.equal(res.status, 401);
  assert.ok(!(await res.text()).includes('secret-key'));
});

test('before a Geoapify key is added, the box is told suggestions are off', async () => {
  const res = await configRoute({ user: { id: 'u1' } })(configRequest(fromBrunswick));
  assert.deepEqual(plain(await res.json()), { enabled: false });
});

test('signed in: the box gets the key and roughly where they are, for this browser only', async () => {
  const res = await configRoute({ user: { id: 'u1' }, key: 'secret-key' })(configRequest(fromBrunswick));
  assert.deepEqual(plain(await res.json()), {
    enabled: true, key: 'secret-key', near: { latitude: -37.77, longitude: 144.96 }, country: 'AU', lang: 'en',
  });
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.match(res.headers.get('cache-control'), /private/);
});

test('with no location known, the key still comes back, just without a place to narrow to', async () => {
  const res = await configRoute({ user: { id: 'u1' }, key: 'k' })(configRequest());
  assert.deepEqual(plain(await res.json()), { enabled: true, key: 'k', near: null, country: null, lang: null });
});
