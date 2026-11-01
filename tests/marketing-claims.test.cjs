// What the public pages promise has to be true on the live site. These are
// easy to drift in a copy edit — and more than one tool edits this site — so
// the claims that were wrong once are pinned here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const read = (file) => fs.readFileSync(file, 'utf8');
// What a visitor can actually see: the source without its comments, which
// are free to talk about what the page must not say.
const shown = (file) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const marketingFiles = fs.readdirSync('components/marketing').filter((f) => f.endsWith('.tsx')).map((f) => `components/marketing/${f}`);

// MemoValet is a personal assistant for work and life, not a meeting app.
// Adrian has had to say so many times; this is where it stops being repeated.
test('the home page leads with a personal assistant, not with meetings', () => {
  const hero = shown('components/marketing/OverviewScene.tsx');
  const h1 = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.doesNotMatch(h1, /meeting|call/i, 'the headline is about everything, not meetings');
  assert.match(hero, /personal assistant/i);
  const layout = shown('app/layout.tsx');
  const title = layout.match(/const title = "([^"]+)"/)[1];
  assert.match(title, /personal assistant/i, 'search results say what it is');
  assert.doesNotMatch(title, /meeting/i);
  assert.match(read('app/opengraph-image.alt.txt'), /personal assistant/i, 'so does the link preview');
});

test('meetings come after the assistant story, grouped together', () => {
  const landing = shown('components/marketing/MarketingLanding.tsx');
  const order = [...landing.matchAll(/<([A-Z][A-Za-z]+) \/>/g)].map((m) => m[1]);
  // MeetingHero is only the old name of the hero's wrapper; the hero itself
  // is checked above.
  const meetingSections = order.filter((name) => name !== 'MeetingHero' && /Meeting|Translation|HowItWorks|MarketingShowcase/.test(name));
  // Adrian keeps the languages, the call and the brief; they sit together,
  // after what people are missing, the dashboard and who it is for.
  assert.equal(order[order.indexOf('MeetingHero') + 1], 'ProblemSolution', 'what people are missing comes straight after the hero');
  const firstMeeting = order.indexOf(meetingSections[0]);
  for (const assistant of ['ProblemSolution', 'DashboardShowcase', 'WhoItsFor']) {
    assert.ok(order.indexOf(assistant) > -1 && order.indexOf(assistant) < firstMeeting, `${assistant} comes before the meeting sections`);
  }
  const positions = meetingSections.map((name) => order.indexOf(name));
  assert.ok(positions.every((at, i) => i === 0 || at === positions[i - 1] + 1), 'the meeting sections sit together');
  const solved = shown('components/marketing/ProblemSolution.tsx');
  const rows = (solved.match(/missing: "/g) || []).length;
  const meetingRows = (solved.match(/missing: "[^"]*meeting/gi) || []).length;
  assert.ok(rows >= 5 && meetingRows <= 1, `${meetingRows} of ${rows} problems are about meetings`);
});

test('the home page has one main landmark, not two', () => {
  const landing = shown('components/marketing/MarketingLanding.tsx');
  assert.equal((landing.match(/<main[\s>]/g) || []).length, 1);
});

test('the languages advertised are the languages a call offers', () => {
  const showcase = read('components/marketing/TranslationShowcase.tsx');
  assert.match(showcase, /SPEECH_LANGUAGE_OPTIONS\.map/, 'read from the real list, never typed out by hand');
  assert.match(showcase, /SPEECH_LANGUAGE_OPTIONS\.length/, 'and counted from it');
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read('lib/speechRecognition.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: loaded.exports, module: loaded, require: () => ({}) });
  const count = loaded.exports.SPEECH_LANGUAGE_OPTIONS.length;
  // Wherever "21 languages" is written out, 21 has to be right.
  for (const file of [...marketingFiles, 'app/layout.tsx']) {
    for (const [, n] of shown(file).matchAll(/\b(\d+) languages\b/g)) {
      assert.equal(Number(n), count, `${file} says ${n} languages; calls offer ${count}`);
    }
  }
});

test('nothing claims content is never used to train AI', () => {
  // Transcription and translation run on a provider tier whose terms allow it
  // to use content to improve its products. Until that changes, this is false.
  for (const file of [...marketingFiles, 'app/privacy/page.tsx', 'app/layout.tsx'].filter((f) => fs.existsSync(f))) {
    assert.doesNotMatch(shown(file), /never (be )?used to train|not used (for|to) train|never train/i, file);
  }
});

test('the home page only shows tools that connect today', () => {
  // Slack, Notion and Trello are "Soon" on /integrations until they are registered.
  const home = ['components/marketing/OverviewScene.tsx', 'components/marketing/ProblemSolution.tsx', 'components/marketing/DashboardShowcase.tsx', 'components/marketing/WhoItsFor.tsx', 'components/marketing/TranslationShowcase.tsx', 'components/marketing/PrivateByDesign.tsx'];
  for (const file of home) assert.doesNotMatch(read(file), /SlackIcon|NotionIcon|TrelloIcon/, file);
});

test('pricing only offers a trial when payments can actually take one', () => {
  const plans = read('components/marketing/PricingPlans.tsx');
  const page = read('app/pricing/page.tsx');
  assert.match(page, /const paidOpen = billingReady\(\)/);
  assert.match(page, /<PricingPlans paidOpen=\{paidOpen\} \/>/);
  // The trial button and its checkout link only when paidOpen.
  assert.match(plans, /paid && paidOpen \? checkout : "\/login\?mode=signup"/);
  assert.match(plans, /paidOpen \? "Start 14 day free trial" : "Start on Free for now"/);
  // What search engines show is true either way.
  const meta = page.slice(page.indexOf('export const metadata'), page.indexOf('const comparison'));
  assert.doesNotMatch(meta, /14 day/, 'metadata cannot switch with billing, so it must not promise a trial');
  assert.doesNotMatch(read('app/login/page.tsx'), /paid plan with a 14 day trial whenever/, 'sign-up does not promise it either');
});

test('a task can only be completed with what the server accepts', () => {
  const form = read('components/AssignedTaskClient.tsx');
  const route = read('app/api/task-assignments/[id]/complete/route.ts');
  const accept = form.match(/accept="([^"]+)"/)[1].split(',');
  const allowed = [...route.matchAll(/"(image\/[a-z]+)":/g)].map((m) => m[1]);
  assert.ok(allowed.length > 0);
  for (const type of accept) {
    assert.ok(!type.endsWith('/*'), `a wildcard (${type}) lets people pick files the server refuses`);
    assert.ok(allowed.includes(type), `${type} is offered but refused on "Mark as done"`);
  }
  for (const file of ['components/marketing/MarketingShowcase.tsx', 'lib/solutions.ts', 'components/marketing/ProblemSolution.tsx']) {
    assert.doesNotMatch(read(file), /videos or files|photos, videos/i, file);
  }
});

test('the films on the home page are really there, and say what they are', () => {
  const films = read('lib/films.ts');
  const files = [...films.matchAll(/"(\/media\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(files.length >= 7, 'the ad in both shapes with posters and captions, and the walkthrough with its poster');
  for (const file of files) assert.ok(fs.existsSync(`public${file}`), `${file} is referenced but missing`);
  // Adrian asked for the hero without "Watch the film"; one call to action.
  assert.doesNotMatch(read('components/marketing/OverviewScene.tsx'), /DemoVideoButton|Watch the film/, 'the hero has no film button');
  // The dashboard screenshot is the walkthrough's cover, and plays it in place.
  assert.match(read('components/marketing/DashboardShowcase.tsx'), /<DashboardFilm/, 'the dashboard section shows the walkthrough');
  const dashboardFilm = read('components/marketing/DashboardFilm.tsx');
  assert.match(dashboardFilm, /WALKTHROUGH_FILM/);
  // It plays by itself, out loud when the browser allows it and otherwise
  // silently until the visitor's first click, tap or key press. It stays still
  // for anyone who asked for less motion.
  assert.match(dashboardFilm, /video\.muted = false;\s*video\.play\(\)\.then/, 'it tries with sound first');
  assert.match(dashboardFilm, /addEventListener\("pointerdown"/);
  assert.doesNotMatch(dashboardFilm, /Tap for sound/, 'no button to press for sound');
  assert.match(dashboardFilm, /prefers-reduced-motion/);
  // The ad has a voiceover: its captions carry the words, and nothing says it's silent.
  assert.match(read('public/media/energy-ad/captions.vtt'), /Meet MemoValet/);
  assert.doesNotMatch(films, /no narration/);
});
