// The home page weather: where the visitor is, what MET Norway says, and how
// it's summed up. Run against fakes and a forecast shaped like MET Norway's,
// no network. What matters most: no location or no forecast means no chip
// (never an error), days follow the visitor's own time zone, and MET Norway is
// asked the way its terms require.
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
    URL, setTimeout, clearTimeout, console: { error() {} }, ...extra,
  });
  return module.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const lib = (fetchImpl = async () => { throw new Error('no network in tests'); }) =>
  compile('lib/weather.ts', {}, { fetch: fetchImpl, Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-15T09:10:00Z'])); } } });

const headersFrom = (values) => (name) => values[name] ?? null;
const vercel = {
  'x-vercel-ip-latitude': '-37.8136',
  'x-vercel-ip-longitude': '144.9631',
  'x-vercel-ip-city': 'Melbourne',
  'x-vercel-ip-country': 'AU',
  'x-vercel-ip-timezone': 'Australia/Melbourne',
};

// Shaped like MET Norway's compact forecast: hourly at first, then six-hourly,
// with the last entry carrying only a temperature. Melbourne is UTC+10 here.
const entry = (time, temperature, symbol, periods = ['next_1_hours', 'next_6_hours']) => {
  const data = { instant: { details: { air_temperature: temperature } } };
  if (symbol) for (const period of periods) data[period] = { summary: { symbol_code: symbol }, details: {} };
  return { time, data };
};
const sixHourly = ['next_6_hours'];
const melbourne = {
  type: 'Feature',
  properties: {
    meta: { units: { air_temperature: 'celsius' } },
    timeseries: [
      entry('2026-09-15T09:00:00Z', 12.4, 'partlycloudy_night'), // Tue 7pm
      entry('2026-09-15T10:00:00Z', 11.0, 'partlycloudy_night'), // Tue 8pm
      entry('2026-09-15T13:00:00Z', 8.6, 'clearsky_night'), // Tue 11pm
      entry('2026-09-15T14:00:00Z', 8.1, 'clearsky_night'), // Wed midnight
      entry('2026-09-15T20:00:00Z', 6.2, 'clearsky_day'), // Wed 6am
      entry('2026-09-16T02:00:00Z', 17.5, 'fair_day'), // Wed noon
      entry('2026-09-16T05:00:00Z', 19.4, 'fair_day'), // Wed 3pm
      entry('2026-09-16T12:00:00Z', 11.9, 'cloudy'), // Wed 10pm
      entry('2026-09-16T18:00:00Z', 9.0, 'rain', sixHourly), // Thu 4am
      entry('2026-09-17T00:00:00Z', 13.2, 'lightrain', sixHourly), // Thu 10am
      entry('2026-09-17T06:00:00Z', 14.8, 'rainshowers_day', sixHourly), // Thu 4pm
      entry('2026-09-17T12:00:00Z', 10.1, null), // Thu 10pm
    ],
  },
};
const inMelbourne = (extra = {}) => ({ city: 'Melbourne', unit: 'C', timeZone: 'Australia/Melbourne', now: new Date('2026-09-15T09:10:00Z'), ...extra });

// ---------------------------------------------------------------- location

test('the visitor’s rough location comes from Vercel, rounded to about a kilometre', () => {
  const { weatherLocation } = lib();
  assert.deepEqual(plain(weatherLocation(headersFrom(vercel))), {
    latitude: -37.81, longitude: 144.96, city: 'Melbourne', country: 'AU', timeZone: 'Australia/Melbourne',
  });
  assert.equal(weatherLocation(headersFrom({ ...vercel, 'x-vercel-ip-city': 'S%C3%A3o%20Paulo' })).city, 'São Paulo');
});

test('no usable location means no weather, and odd city or time zone values are dropped', () => {
  const { weatherLocation } = lib();
  assert.equal(weatherLocation(headersFrom({})), null, 'local development has no Vercel headers');
  assert.equal(weatherLocation(headersFrom({ ...vercel, 'x-vercel-ip-latitude': 'abc' })), null);
  assert.equal(weatherLocation(headersFrom({ ...vercel, 'x-vercel-ip-longitude': '190' })), null);
  const odd = weatherLocation(headersFrom({ ...vercel, 'x-vercel-ip-city': '%E0%A4%A', 'x-vercel-ip-timezone': 'Mars/Base' }));
  assert.equal(odd.city, null);
  assert.equal(odd.timeZone, null);
});

test('°F for the US and the few places that use it, °C everywhere else', () => {
  const { temperatureUnit } = lib();
  assert.equal(temperatureUnit('US'), 'F');
  assert.equal(temperatureUnit('au'), 'C');
  assert.equal(temperatureUnit(null), 'C');
});

// -------------------------------------------------------------- conditions

test('MET Norway’s symbol codes read as plain words, day or night', () => {
  const { conditionFor } = lib();
  const cases = {
    clearsky_day: ['clear', 'Sunny', false],
    clearsky_night: ['clear', 'Clear', true],
    fair_day: ['fair', 'Mostly sunny', false],
    partlycloudy_night: ['partly', 'Partly cloudy', true],
    cloudy: ['cloudy', 'Cloudy', false],
    fog: ['fog', 'Fog', false],
    lightrainshowers_night: ['rain', 'Light showers', true],
    rainshowers_day: ['rain', 'Showers', false],
    heavyrain: ['rain', 'Heavy rain', false],
    sleet: ['sleet', 'Sleet', false],
    lightsnow: ['snow', 'Light snow', false],
    heavysnowshowers_polartwilight: ['snow', 'Heavy snow showers', false],
    lightssleetshowersandthunder_day: ['thunder', 'Thunderstorms', false],
  };
  for (const [code, [kind, label, night]] of Object.entries(cases)) {
    assert.deepEqual(plain(conditionFor(code)), { kind, label, night }, code);
  }
  for (const code of [undefined, null, '', 'sandstorm_day']) assert.equal(conditionFor(code), null, String(code));
});

// ---------------------------------------------------------------- forecast

test('the named forecast preserves tenths of a degree in the visitor’s own time zone', () => {
  const { summariseForecast } = lib();
  const weather = plain(summariseForecast(melbourne, inMelbourne()));
  assert.equal(weather.city, 'Melbourne');
  assert.equal(weather.temperature, 12.4);
  assert.deepEqual(weather.condition, { kind: 'partly', label: 'Partly cloudy', night: true });
  assert.deepEqual(weather.days.map((d) => [d.label, d.date, d.low, d.high, d.condition.label]), [
    ['Tonight', '2026-09-15', 8.6, 12.4, 'Partly cloudy'],
    ['Wed', '2026-09-16', 6.2, 19.4, 'Mostly sunny'],
    ['Thu', '2026-09-17', 9, 14.8, 'Light rain'],
  ]);
});

test('°F visitors get the same forecast in Fahrenheit', () => {
  const { summariseForecast } = lib();
  const weather = plain(summariseForecast(melbourne, inMelbourne({ unit: 'F' })));
  assert.equal(weather.temperature, 54.3);
  assert.deepEqual([weather.days[1].low, weather.days[1].high], [43.2, 66.9]);
});

test('a forecast cached earlier starts from the current hour, not from when it was fetched', () => {
  const { summariseForecast } = lib();
  const weather = plain(summariseForecast(melbourne, inMelbourne({ now: new Date('2026-09-15T13:30:00Z') })));
  assert.equal(weather.temperature, 8.6);
  assert.deepEqual([weather.days[0].label, weather.days[0].low, weather.days[0].high], ['Tonight', 8.6, 8.6]);
});

test('before 6pm the rest of the day is “Today”; after, it is “Tonight”', () => {
  const { summariseForecast } = lib();
  assert.equal(summariseForecast({ properties: { timeseries: [entry('2026-09-15T01:00:00Z', 10, 'cloudy')] } }, inMelbourne({ now: new Date('2026-09-15T01:00:00Z') })).days[0].label, 'Today', '11am');
  assert.equal(summariseForecast({ properties: { timeseries: [entry('2026-09-15T07:00:00Z', 10, 'cloudy')] } }, inMelbourne({ now: new Date('2026-09-15T07:59:00Z') })).days[0].label, 'Today', '5:59pm');
  assert.equal(summariseForecast(melbourne, inMelbourne({ now: new Date('2026-09-15T08:00:00Z') })).days[0].label, 'Tonight', '6pm');
});

test('at most five days are shown, and a broken forecast shows nothing', () => {
  const { summariseForecast } = lib();
  const start = Date.parse('2026-09-15T00:00:00Z');
  const timeseries = Array.from({ length: 40 }, (_, i) => entry(new Date(start + i * 6 * 3600e3).toISOString(), 10 + (i % 4), 'cloudy', sixHourly));
  assert.equal(summariseForecast({ properties: { timeseries } }, { city: 'Melbourne', unit: 'C', timeZone: 'UTC', now: new Date(start) }).days.length, 5);
  assert.equal(summariseForecast(null, { city: null, unit: 'C', timeZone: 'UTC' }), null);
  assert.equal(summariseForecast({ properties: { timeseries: [{ time: 'soon', data: {} }] } }, { city: null, unit: 'C', timeZone: null }), null);
});

test('a temperature is never shown without the forecast location name', () => {
  const { summariseForecast } = lib();
  assert.equal(summariseForecast(melbourne, inMelbourne({ city: null })), null);
  assert.equal(summariseForecast(melbourne, inMelbourne({ city: '   ' })), null);
});

test('MET Norway is asked the way its terms require: named app, rounded place, not re-asked for half an hour', async () => {
  const calls = [];
  const { fetchForecast } = lib(async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => melbourne };
  });
  const data = await fetchForecast({ latitude: -37.81, longitude: 144.96 });
  assert.equal(plain(data).properties.timeseries.length, 12);
  const sent = new URL(calls[0].url);
  assert.equal(sent.origin + sent.pathname, 'https://api.met.no/weatherapi/locationforecast/2.0/compact');
  assert.deepEqual([sent.searchParams.get('lat'), sent.searchParams.get('lon')], ['-37.81', '144.96']);
  assert.match(calls[0].init.headers['User-Agent'], /MemoValet.*memovalet\.com/);
  assert.equal(calls[0].init.next.revalidate, 1800);
  assert.equal(calls[0].init.signal, undefined, 'a plain fetch, which Next.js caches');
});

test('if MET Norway is down or slow, there is simply no weather', async () => {
  assert.equal(await lib(async () => ({ ok: false, status: 503, json: async () => ({}) })).fetchForecast({ latitude: 1, longitude: 2 }), null);
  assert.equal(await lib(async () => { throw new Error('timeout'); }).fetchForecast({ latitude: 1, longitude: 2 }), null);
  assert.equal(await lib(() => new Promise(() => {})).fetchForecast({ latitude: 1, longitude: 2 }, { timeoutMs: 20 }), null, 'a reply that never comes gives up');
});

// ------------------------------------------------------------------- route

function weatherRoute({ user, reply }) {
  const calls = [];
  const weatherLib = lib(async (url) => {
    calls.push(url);
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  });
  const route = compile('app/api/weather/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/weather': weatherLib,
  });
  return { GET: route.GET, POST: route.POST, calls };
}
const weatherRequest = (headers = {}) => new Request('https://memovalet.com/api/weather', { headers });

test('signed-out visitors get no weather, and MET Norway is not asked', async () => {
  const r = weatherRoute({ user: null, reply: { status: 200, body: melbourne } });
  const res = await r.GET(weatherRequest(vercel));
  assert.equal(res.status, 401);
  assert.equal(r.calls.length, 0);
});

test('signed in: the chip gets the forecast for where the connection is, in that country’s units', async () => {
  const r = weatherRoute({ user: { id: 'u1' }, reply: { status: 200, body: melbourne } });
  const res = await r.GET(weatherRequest({ ...vercel, 'x-vercel-ip-country': 'US' }));
  const { weather } = plain(await res.json());
  assert.equal(weather.city, 'Melbourne');
  assert.equal(weather.unit, 'F');
  assert.equal(typeof weather.temperature, 'number');
  assert.equal(new URL(r.calls[0]).searchParams.get('lat'), '-37.81');
  assert.match(res.headers.get('cache-control'), /private/);
});

test('no location (local development) or no forecast means no chip, never an error', async () => {
  const noPlace = weatherRoute({ user: { id: 'u1' }, reply: { status: 200, body: melbourne } });
  assert.deepEqual(plain(await (await noPlace.GET(weatherRequest())).json()), { weather: null, source: 'connection' });
  assert.equal(noPlace.calls.length, 0);
  const down = weatherRoute({ user: { id: 'u1' }, reply: { status: 503, body: {} } });
  const res = await down.GET(weatherRequest(vercel));
  assert.equal(res.status, 200);
  assert.equal(plain(await res.json()).weather, null);
});

// The connection's location is a guess, often the wrong suburb or, behind a
// VPN or a work network, the wrong city. People can say where they are.
const colombo = { name: 'Colombo', latitude: 6.927079, longitude: 79.861244, country: 'lk', timeZone: 'Asia/Colombo' };

test('a chosen place wins over the connection, rounded to about a kilometre', async () => {
  const r = weatherRoute({ user: { id: 'u1', user_metadata: { weather_place: colombo, weather_location_mode: 'chosen' } }, reply: { status: 200, body: melbourne } });
  const res = await r.GET(weatherRequest(vercel));
  const body = plain(await res.json());
  assert.equal(body.source, 'chosen');
  assert.equal(body.weather.city, 'Colombo');
  assert.equal(r.calls.length, 1);
  const asked = new URL(r.calls[0]);
  assert.equal(asked.searchParams.get('lat'), '6.93');
  assert.equal(asked.searchParams.get('lon'), '79.86');
});

test('without a chosen place it says the location is only from the connection', async () => {
  const r = weatherRoute({ user: { id: 'u1', user_metadata: {} }, reply: { status: 200, body: melbourne } });
  const body = plain(await (await r.GET(weatherRequest(vercel))).json());
  assert.equal(body.source, 'connection');
  assert.equal(body.weather.city, 'Melbourne');
});

test('a saved place that makes no sense is ignored rather than trusted', () => {
  const { savedWeatherLocation, weatherPlace } = lib();
  for (const bad of [null, 'Colombo', { latitude: 200, longitude: 0 }, { latitude: '6.9', longitude: '79.8' }, { name: 'x' }]) {
    assert.equal(savedWeatherLocation({ weather_place: bad }), null, JSON.stringify(bad));
  }
  const place = plain(weatherPlace({ ...colombo, name: '  Colombo   Fort ', timeZone: 'Not/AZone' }));
  assert.deepEqual(place, { name: 'Colombo Fort', latitude: 6.93, longitude: 79.86, country: 'LK', timeZone: null });
});

test('old saved GPS snapshots no longer pin an automatic visitor to Melbourne', async () => {
  const r = weatherRoute({ user: { id: 'u1', user_metadata: { weather_place: colombo } }, reply: { status: 200, body: melbourne } });
  const body = await (await r.GET(weatherRequest({ ...vercel, 'x-vercel-ip-city': 'Auckland', 'x-vercel-ip-latitude': '-36.85', 'x-vercel-ip-longitude': '174.76', 'x-vercel-ip-country': 'NZ', 'x-vercel-ip-timezone': 'Pacific/Auckland' }))).json();
  assert.equal(body.weather.city, 'Auckland');
  assert.equal(body.source, 'connection');
  assert.equal(body.weather.unit, 'C');
});

test('device weather names Auckland, Sydney, or Mumbai independently of Melbourne connection headers', async () => {
  const r = weatherRoute({ user: { id: 'u1' }, reply: { status: 200, body: melbourne } });
  for (const place of [
    { name: 'Auckland', latitude: -36.8485, longitude: 174.7633, country: 'NZ', timeZone: 'Pacific/Auckland' },
    { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, country: 'AU', timeZone: 'Australia/Sydney' },
    { name: 'Mumbai', latitude: 19.076, longitude: 72.8777, country: 'IN', timeZone: 'Asia/Kolkata' },
  ]) {
    const res = await r.POST(new Request('https://memovalet.com/api/weather', { method: 'POST', headers: vercel, body: JSON.stringify(place) }));
    const body = await res.json();
    assert.equal(body.source, 'device');
    assert.equal(body.weather.city, place.name);
    assert.equal(body.weather.unit, 'C');
    assert.equal(new URL(r.calls.at(-1)).searchParams.get('lat'), String(Math.round(place.latitude * 100) / 100));
    assert.match(res.headers.get('cache-control'), /no-store/);
  }
});

test('device weather requires sign in and valid coordinates', async () => {
  const request = (place) => new Request('https://memovalet.com/api/weather', { method: 'POST', body: JSON.stringify(place) });
  const signedOut = weatherRoute({ user: null, reply: { status: 200, body: melbourne } });
  assert.equal((await signedOut.POST(request({ latitude: 1, longitude: 2 }))).status, 401);
  assert.equal(signedOut.calls.length, 0);
  const r = weatherRoute({ user: { id: 'u1' }, reply: { status: 200, body: melbourne } });
  for (const bad of [{ latitude: 91, longitude: 0 }, { latitude: '1', longitude: '2' }, {}]) {
    assert.equal((await r.POST(request(bad))).status, 400);
  }
  assert.equal(r.calls.length, 0);
});

test('expired weather and a forecast starting tomorrow never show as current', () => {
  const { summariseForecast } = lib();
  assert.equal(summariseForecast(melbourne, inMelbourne({ now: new Date('2026-09-20T00:00:00Z') })), null);
  assert.equal(summariseForecast(melbourne, inMelbourne({ now: new Date('2026-09-14T00:00:00Z') })), null);
});

test('weather gives up even when response headers arrive but the body hangs', async () => {
  const { fetchForecast } = lib(async () => ({ ok: true, json: () => new Promise(() => {}) }));
  assert.equal(await fetchForecast({ latitude: 1, longitude: 2 }, { timeoutMs: 20 }), null);
});

function client({ permission = 'granted', positions = [], reverseFails = false } = {}) {
  const requests = [];
  let locationReads = 0;
  const clientLib = compile('lib/weather-client.ts', {
    './weather': lib(), './place-search': compile('lib/place-search.ts'),
  }, {
    AbortSignal,
    navigator: {
      permissions: { query: async () => ({ state: permission }) },
      geolocation: { getCurrentPosition(resolve, reject) {
        locationReads++;
        if (permission === 'denied') reject({ code: 1 });
        else resolve({ coords: positions.shift() });
      } },
    },
    fetch: async (url) => {
      requests.push(url);
      if (url === '/api/address/config') return { ok: true, json: async () => ({ key: 'test' }) };
      if (reverseFails) throw new Error('offline');
      const latitude = Number(new URL(url).searchParams.get('lat'));
      return { ok: true, json: async () => ({ results: [{ city: latitude < -35 ? 'Auckland' : 'Sydney', lat: latitude, lon: 174, country_code: latitude < -35 ? 'nz' : 'au', timezone: { name: latitude < -35 ? 'Pacific/Auckland' : 'Australia/Sydney' } }] }) };
    },
  });
  return { ...clientLib, requests, reads: () => locationReads };
}

test('automatic refresh reads the device again and names Auckland then Sydney with rounded coordinates', async () => {
  const c = client({ positions: [{ latitude: -36.8485123, longitude: 174.7633123 }, { latitude: -33.8688123, longitude: 151.2093123 }] });
  const auckland = await c.currentWeatherPlace();
  const sydney = await c.currentWeatherPlace();
  assert.equal(auckland.name, 'Auckland');
  assert.equal(sydney.name, 'Sydney');
  assert.equal(sydney.longitude, 151.21);
  assert.equal(c.reads(), 2);
  assert.ok(c.requests.filter(u => u.includes('/reverse')).every(u => !u.includes('123')));
});

test('passive weather refresh never prompts for location or bypasses denial', async () => {
  for (const permission of ['prompt', 'denied']) {
    const c = client({ permission });
    assert.equal(await c.currentWeatherPlace(), null);
    assert.equal(c.reads(), 0);
    assert.equal(c.requests.length, 0);
  }
});

test('explicit location button asks permission; failed city lookup returns no unnamed device forecast', async () => {
  const c = client({ permission: 'prompt', reverseFails: true, positions: [{ latitude: -36.8485, longitude: 174.7633 }] });
  const place = await c.currentWeatherPlace(true);
  assert.equal(place, null);
  assert.equal(c.reads(), 1);
});
