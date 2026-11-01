// Searching Tenor from the meeting chat: family-friendly only, asked from
// MemoValet's side, and nothing offered that the chat itself would refuse to send.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(file, required = {}) {
  const loaded = { exports: {} };
  vm.runInNewContext(transpile(file), { exports: loaded.exports, module: loaded, require: (n) => required[n], URL });
  return loaded.exports;
}
const tenor = load('lib/tenor.ts');
const { tenorSearchUrl, parseTenorResults, CONTENT_FILTER, MAX_RESULTS } = tenor;
const { safeGifUrl } = load('lib/meeting-chat.ts', {});

const result = (id, gif, tiny, description) => ({
  id, content_description: description,
  media_formats: { gif: { url: gif }, tinygif: { url: tiny } },
});
const real = (n) => `https://media.tenor.com/abc${n}AAAAM/funny-${n}.gif`;

test('every search is asked at Tenor\'s strictest, family-friendly level', () => {
  const url = new URL(tenorSearchUrl('cat', { key: 'k' }));
  assert.equal(url.searchParams.get('contentfilter'), 'high');
  assert.equal(CONTENT_FILTER, 'high', 'high is G-rated by Tenor\'s own definition');
});

test('the filter is set in code, and a search cannot talk it down', () => {
  // Whatever someone types, including something that looks like a parameter.
  const url = new URL(tenorSearchUrl('cat&contentfilter=off', { key: 'k' }));
  assert.equal(url.searchParams.get('contentfilter'), 'high');
  assert.equal(url.searchParams.getAll('contentfilter').length, 1);
  assert.equal(url.searchParams.get('q'), 'cat&contentfilter=off');
});

test('the search carries the key, an identifier, and a sane result count', () => {
  const url = new URL(tenorSearchUrl('thanks', { key: 'secret-key', limit: 500 }));
  assert.equal(url.origin + url.pathname, 'https://tenor.googleapis.com/v2/search');
  assert.equal(url.searchParams.get('key'), 'secret-key');
  assert.equal(url.searchParams.get('client_key'), 'memovalet');
  assert.equal(Number(url.searchParams.get('limit')), MAX_RESULTS, 'capped, whatever is asked for');
  assert.equal(url.searchParams.get('media_filter'), 'gif,tinygif');
});

test('a long search is trimmed rather than sent whole', () => {
  const url = new URL(tenorSearchUrl('x'.repeat(400), { key: 'k' }));
  assert.ok(url.searchParams.get('q').length <= 50);
});

test('results come back with a preview, a label and the GIF to send', () => {
  const [gif] = parseTenorResults({ results: [result('7', real(1), 'https://media.tenor.com/abc1AAAAM/tiny.gif', 'cat waving')] });
  assert.equal(gif.key, '7');
  assert.equal(gif.label, 'cat waving');
  assert.equal(gif.url, real(1));
  assert.match(gif.preview, /tiny\.gif$/);
});

test('anything the chat would refuse to send is never offered', () => {
  const parsed = parseTenorResults({ results: [
    result('a', 'http://media.tenor.com/x/insecure.gif', null, 'not https'),
    result('b', 'https://evil.example/x/elsewhere.gif', null, 'not Tenor'),
    result('c', 'https://media.tenor.com/x/video.mp4', null, 'not a gif'),
    result('d', 'https://user:pw@media.tenor.com/x/creds.gif', null, 'credentials in the url'),
    result('e', real(2), null, 'fine'),
  ]});
  assert.equal(parsed.length, 1, 'only the sound one');
  assert.equal(parsed[0].url, real(2));
  // And what is offered is exactly what the chat accepts when sending.
  assert.equal(safeGifUrl(parsed[0].url), real(2));
});

test('a preview that fails the same check falls back to the GIF itself', () => {
  const [gif] = parseTenorResults({ results: [result('f', real(3), 'https://evil.example/tiny.gif', 'x')] });
  assert.equal(gif.preview, real(3));
});

test('rubbish from the service produces nothing rather than an error', () => {
  for (const data of [null, {}, { results: 'x' }, { results: [null, 42, {}] }]) {
    assert.deepEqual([...parseTenorResults(data)], []);
  }
});

test('duplicates and overlong labels are handled', () => {
  const parsed = parseTenorResults({ results: [
    result('g', real(4), null, 'a'.repeat(300)),
    result('h', real(4), null, 'the same gif again'),
  ]});
  assert.equal(parsed.length, 1);
  assert.ok(parsed[0].label.length <= 80);
});

test('no more than a screenful comes back', () => {
  const many = Array.from({ length: 80 }, (_, i) => result(String(i), real(i + 10), null, 'x'));
  assert.equal(parseTenorResults({ results: many }).length, MAX_RESULTS);
});

// The route around it.
function routeFixture({ key = 'tenor-key', claims = null, user = { id: 'u1' }, reply = { ok: true, body: { results: [] } } } = {}) {
  const calls = [];
  const modules = {
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: init?.headers }) } },
    'livekit-server-sdk': { TokenVerifier: class { async verify(token) { if (token !== 'good') throw new Error('bad'); return claims; } } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/tenor': tenor,
  };
  const loaded = { exports: {} };
  vm.runInNewContext(transpile('app/api/gifs/search/route.ts'), {
    exports: loaded.exports, module: loaded, require: (n) => modules[n], Response, URL, console: { error() {} },
    AbortSignal, Number, process: { env: { ...(key ? { TENOR_API_KEY: key } : {}), LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' } },
    fetch: async (url) => { calls.push(url); return { ok: reply.ok, status: reply.ok ? 200 : 503, json: async () => reply.body }; },
  });
  const get = (query = 'cat', { token, session } = {}) =>
    loaded.exports.GET(new Request(
      `https://memovalet.com/api/gifs/search?q=${encodeURIComponent(query)}${session ? `&session=${session}` : ''}`,
      { headers: token ? { authorization: `Bearer ${token}` } : {} }
    ));
  return { get, calls };
}

test('with no key set up, the picker is told so and keeps its own GIFs', async () => {
  const f = routeFixture({ key: null });
  const body = await (await f.get()).json();
  assert.equal(body.enabled, false);
  assert.deepEqual([...body.results], []);
  assert.equal(f.calls.length, 0, 'nothing is asked of Tenor');
});

test('someone in the call can search, and the key never leaves the server', async () => {
  const room = 'room-1';
  const f = routeFixture({ claims: { video: { room, roomJoin: true } }, reply: { ok: true, body: { results: [
    { id: '1', content_description: 'clap', media_formats: { gif: { url: real(9) }, tinygif: { url: real(9) } } },
  ] } } });
  const response = await f.get('clap', { token: 'good', session: room });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.results.length, 1);
  assert.match(f.calls[0], /contentfilter=high/);
  assert.ok(!JSON.stringify(body).includes('tenor-key'), 'the key is not in the answer');
});

test('a stranger with no pass and no account gets nothing', async () => {
  const f = routeFixture({ user: null });
  assert.equal((await f.get('clap')).status, 401);
  assert.equal(f.calls.length, 0);
});

test('a pass for another call does not open this one', async () => {
  const f = routeFixture({ claims: { video: { room: 'another', roomJoin: true } }, user: null });
  assert.equal((await f.get('clap', { token: 'good', session: 'room-1' })).status, 401);
});

test('a search too short to mean anything is not sent anywhere', async () => {
  const f = routeFixture();
  const body = await (await f.get('a')).json();
  assert.deepEqual([...body.results], []);
  assert.equal(f.calls.length, 0);
});

test('Tenor having a bad day leaves the picker with its own GIFs, not an error', async () => {
  const f = routeFixture({ reply: { ok: false, body: {} } });
  const response = await f.get('clap');
  assert.equal(response.status, 200);
  assert.deepEqual([...(await response.json()).results], []);
});
