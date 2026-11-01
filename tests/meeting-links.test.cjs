// Zoom and Teams meetings used to be dropped on the floor: the calendar fetch
// kept only events with a Google Meet link. These run the real source against a
// fake Google Calendar, so what matters most is that a Zoom or Teams call is
// found wherever the invite happens to put the link — and that an event with no
// meeting link at all is still left out.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function resolveFile(base) {
  for (const candidate of [base + '.ts', base + '.tsx', base + '/index.ts']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('cannot resolve ' + base);
}

function load(file, world) {
  const cache = {};
  const loadOne = (f) => {
    if (cache[f]) return cache[f].exports;
    const js = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache[f] = module;
    const req = (name) => {
      if (world.modules[name]) return world.modules[name];
      if (name.startsWith('@/')) return loadOne(resolveFile(name.slice(2)));
      if (name.startsWith('.')) return loadOne(resolveFile(path.join(path.dirname(f), name)));
      return require(name);
    };
    vm.runInNewContext(js, {
      exports: module.exports, module, require: req, Buffer, URL, URLSearchParams,
      fetch: world.fetch, console: { error() {} },
    });
    return module.exports;
  };
  return loadOne(file);
}

const ZOOM = 'https://us02web.zoom.us/j/89123456789?pwd=Ab1cD2eF3';
const TEAMS = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzQ1@thread.v2/0?context=%7b%22Tid%22%3a%22aa%22%7d';
const MEET = 'https://meet.google.com/abc-defg-hij';

// ------------------------------------------------------------ link detection

test('recognises each provider from a real-world link', () => {
  const links = load('lib/meetingLinks.ts', { modules: {}, fetch: async () => {} });
  assert.equal(links.findMeetingLink(ZOOM).provider, 'zoom');
  assert.equal(links.findMeetingLink(TEAMS).provider, 'teams');
  assert.equal(links.findMeetingLink(MEET).provider, 'google-meet');
  assert.equal(links.findMeetingLink('no link in here'), null);
});

test('pulls the link out of surrounding invite text', () => {
  const links = load('lib/meetingLinks.ts', { modules: {}, fetch: async () => {} });
  const found = links.findMeetingLink('Join Zoom Meeting\n' + ZOOM + '\n\nMeeting ID: 891 2345 6789');
  assert.equal(found.url, ZOOM);
  assert.equal(found.provider, 'zoom');
});

test('a personal Zoom room and a Zoom Gov link still count', () => {
  const links = load('lib/meetingLinks.ts', { modules: {}, fetch: async () => {} });
  assert.equal(links.detectMeetingProvider('https://zoom.us/my/adrian'), 'zoom');
  assert.equal(links.detectMeetingProvider('https://agency.zoomgov.com/j/1600123456'), 'zoom');
});

test('an unrelated link is not mistaken for a meeting', () => {
  const links = load('lib/meetingLinks.ts', { modules: {}, fetch: async () => {} });
  assert.equal(links.detectMeetingProvider('https://zoom.us/pricing'), null);
  assert.equal(links.detectMeetingProvider('https://example.com/teams'), null);
});

// --------------------------------------------------------- calendar fetching

function calendarWorld(items) {
  return {
    fetch: async () => ({ ok: true, json: async () => ({ items }) }),
    modules: {
      './tokens': {
        getStoredGoogleRefreshToken: async () => 'refresh-token',
        exchangeForAccessToken: async () => 'access-token',
      },
    },
  };
}

test('finds Zoom and Teams meetings wherever the invite puts the link', async () => {
  const world = calendarWorld([
    { id: 'a', summary: 'Meet call', hangoutLink: MEET, start: { dateTime: '2026-09-14T10:00:00Z' } },
    { id: 'b', summary: 'Zoom in location', location: ZOOM, start: { dateTime: '2026-09-14T11:00:00Z' } },
    { id: 'c', summary: 'Teams in body', description: 'Agenda below.\n' + TEAMS, start: { dateTime: '2026-09-14T12:00:00Z' } },
    {
      id: 'd', summary: 'Zoom via add-on', start: { dateTime: '2026-09-14T13:00:00Z' },
      conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+61000' }, { entryPointType: 'video', uri: ZOOM }] },
    },
    { id: 'e', summary: 'Coffee, no link', location: 'Kitchen', start: { dateTime: '2026-09-14T14:00:00Z' } },
  ]);

  const { getUpcomingMeetingEvents } = load('lib/google/calendar.ts', world);
  const events = await getUpcomingMeetingEvents('user-1');

  assert.deepEqual(
    events.map((e) => [e.id, e.provider]),
    [['a', 'google-meet'], ['b', 'zoom'], ['c', 'teams'], ['d', 'zoom']],
    'every online meeting is kept, and the in-person one is not'
  );
  assert.equal(events[1].meetLink, ZOOM, 'the link itself is carried through, not just the provider');
});

test('no Google connection means no events, not a crash', async () => {
  const world = calendarWorld([]);
  world.modules['./tokens'].getStoredGoogleRefreshToken = async () => null;
  const { getUpcomingMeetingEvents } = load('lib/google/calendar.ts', world);
  // Cross-realm arrays aren't reference-equal, so assert on the contents.
  assert.equal((await getUpcomingMeetingEvents('user-1')).length, 0);
});
