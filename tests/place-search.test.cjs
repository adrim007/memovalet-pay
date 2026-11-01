// Finding a town for the weather: what comes back from the place search.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/place-search.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, URL });
const { parsePlaces, placeSearchUrl, reversePlaceUrl } = loaded.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('towns come back with enough to tell two of the same name apart', () => {
  const places = plain(parsePlaces({ results: [
    { place_id: 'a', city: 'Richmond', state: 'Victoria', country: 'Australia', country_code: 'au', lat: -37.82, lon: 145.0, timezone: { name: 'Australia/Melbourne' } },
    { place_id: 'b', city: 'Richmond', state: 'Virginia', country: 'United States', country_code: 'us', lat: 37.54, lon: -77.43, timezone: { name: 'America/New_York' } },
    { place_id: 'c', city: 'Richmond', state: 'Victoria', country: 'Australia', country_code: 'au', lat: -37.82, lon: 145.0 },
    { place_id: 'd', name: 'Nowhere' },
    { place_id: 'e', lat: 1, lon: 2 },
  ] }));
  assert.equal(places.length, 2, 'repeats and places with no position or name are left out');
  assert.equal(places[0].detail, 'Victoria, Australia');
  assert.equal(places[1].country, 'US');
  assert.equal(places[1].timeZone, 'America/New_York');
});

test('rubbish in, nothing out', () => {
  for (const data of [null, {}, { results: 'x' }]) assert.equal(parsePlaces(data).length, 0);
});

test('the search asks for towns and cities, near you first, anywhere in the world', () => {
  const url = new URL(placeSearchUrl('  Colombo ', { apiKey: 'k', near: { latitude: -37.81, longitude: 144.96 }, lang: 'en' }));
  assert.equal(url.searchParams.get('text'), 'Colombo');
  assert.equal(url.searchParams.get('type'), 'city');
  assert.equal(url.searchParams.get('bias'), 'proximity:144.96,-37.81');
  assert.equal(url.searchParams.get('filter'), null, 'not limited to your own country: you may be travelling');
  const reverse = new URL(reversePlaceUrl(-37.81, 144.96, { apiKey: 'k' }));
  assert.equal(reverse.searchParams.get('lat'), '-37.81');
  assert.equal(reverse.searchParams.get('type'), 'city');
});
