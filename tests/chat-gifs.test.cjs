// The GIFs a meeting's chat offers ready to click, instead of a paste box.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const cache = {};
  const one = (f) => {
    if (cache[f]) return cache[f].exports;
    const js = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache[f] = module;
    const req = (name) => (name.startsWith('@/') ? one(name.slice(2) + '.ts') : require(name));
    vm.runInNewContext(js, { exports: module.exports, module, require: req, URL, TextDecoder });
    return module.exports;
  };
  return one(file);
}

const { GIF_GROUPS, ALL_GIFS, searchGifs, isBuiltInGif } = load('lib/chat-gifs.ts');
const { safeGifUrl, parseChatPacket } = load('lib/meeting-chat.ts');

test('every built-in GIF survives the check the other side runs on arrival', () => {
  // If one failed, the message would be dropped silently on everyone else's
  // screen — the sender would see it sent and nobody would receive it.
  for (const gif of ALL_GIFS) {
    assert.equal(safeGifUrl(gif.url), gif.url, `${gif.label} would be rejected: ${gif.url}`);
  }
});

test('a GIF sent from the picker arrives as a real chat message', () => {
  const gif = ALL_GIFS[0];
  const packet = new TextEncoder().encode(JSON.stringify({ id: 'abc-1', text: '', gifUrl: gif.url }));
  const message = parseChatPacket(packet, 'sender-1', 'Adrian');
  assert.ok(message, 'dropped on arrival');
  assert.equal(message.gifUrl, gif.url);
});

test('there is a proper set of them, grouped, with no repeats', () => {
  assert.ok(ALL_GIFS.length >= 20, `only ${ALL_GIFS.length}`);
  assert.ok(GIF_GROUPS.length >= 5);
  const keys = ALL_GIFS.map((gif) => gif.key);
  assert.equal(new Set(keys).size, keys.length, 'a GIF appears twice');
});

test('previews are the light version, and what is sent is the .gif', () => {
  for (const gif of ALL_GIFS) {
    assert.match(gif.preview, /^https:\/\/media\.tenor\.com\/[A-Za-z0-9_-]+AAAA1\/.+\.webp$/, gif.label);
    assert.match(gif.url, /^https:\/\/media\.tenor\.com\/[A-Za-z0-9_-]+AAAAM\/.+\.gif$/, gif.label);
    assert.ok(gif.label.trim().length > 0, 'every GIF needs a name a screen reader can say');
  }
});

test('typing what you mean finds one', () => {
  const found = (query) => searchGifs(query).flatMap((group) => group.gifs).map((gif) => gif.label);

  assert.ok(found('thanks').includes('Thank you'));
  assert.ok(found('clap').length >= 2);
  assert.ok(found('lag').includes('Frozen'), 'the one for when someone freezes on a call');
  assert.ok(found('hi').length >= 2);
  assert.equal(searchGifs('xyzzy').length, 0);
  assert.equal(searchGifs('').flatMap((group) => group.gifs).length, ALL_GIFS.length);
});

test('ours play on arrival; anything else still waits for a click', () => {
  assert.equal(isBuiltInGif(ALL_GIFS[3].url), true);
  assert.equal(isBuiltInGif('https://media.giphy.com/media/somethingelse/giphy.gif'), false);
  assert.equal(isBuiltInGif(undefined), false);
  // The preview is not what is sent, so it must not count as one of ours.
  assert.equal(isBuiltInGif(ALL_GIFS[3].preview), false);
});
