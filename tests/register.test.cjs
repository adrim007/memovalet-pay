// Formal or casual. Most of these languages make you pick with every sentence
// — tu or vous, 반말 or 합니다체 — so MemoValet works out which side the speaker
// is on rather than asking, and stays on it for the whole call.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, required = {}) {
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: loaded.exports, module: loaded, require: (name) => required[name] });
  return loaded.exports;
}
const guide = load('lib/register-guide.ts');
const register = load('lib/register.ts', { './register-guide': guide });
const style = load('lib/translation-style.ts');
const prompt = load('lib/translation-prompt.ts', {
  './translation-style': style, './register-guide': guide, './register': register,
});
const speech = load('lib/speechRecognition.ts', {});
const { readRegister, nextFooting, NO_FOOTING } = register;
const { REGISTER_GUIDES, registerGuideFor } = guide;
const { buildTranslationPrompt } = prompt;

test('every language says how formal and informal are written, with worked examples', () => {
  for (const { label } of speech.SPEECH_LANGUAGE_OPTIONS) {
    const entry = registerGuideFor(label);
    assert.ok(entry, `${label} has no formality guidance`);
    assert.ok(entry.informal.length > 30 && entry.formal.length > 30, `${label}'s guidance is too thin`);
    assert.equal(entry.examples.length, 4, `${label} should show the same four lines`);
    for (const example of entry.examples) {
      assert.ok(example.informal.trim() && example.formal.trim(), `${label}: "${example.en}" is missing a side`);
      assert.notEqual(example.informal, example.formal, `${label}: "${example.en}" reads the same either way`);
    }
    assert.ok(entry.markers.formal.length >= 5 && entry.markers.informal.length >= 5, `${label} has too few giveaways`);
  }
  assert.equal(Object.keys(REGISTER_GUIDES).length, speech.SPEECH_LANGUAGE_OPTIONS.length);
});

test('the same four everyday lines are used in every language, so the pairs can be compared', () => {
  const frames = REGISTER_GUIDES.English.examples.map((example) => example.en);
  for (const [label, entry] of Object.entries(REGISTER_GUIDES)) {
    assert.deepEqual(entry.examples.map((example) => example.en), frames, `${label} uses different lines`);
  }
});

test('what someone says gives their footing away', () => {
  assert.equal(readRegister('Could you please send that through today?', 'English').register, 'formal');
  assert.equal(readRegister("Yeah nah mate, no worries", 'English').register, 'informal');
  assert.equal(readRegister('Pourriez-vous me l\'envoyer aujourd\'hui ?', 'French').register, 'formal');
  assert.equal(readRegister("Ouais, t'as raison", 'French').register, 'informal');
  assert.equal(readRegister('Könnten Sie mir das heute zusenden?', 'German').register, 'formal');
  assert.equal(readRegister('Kannst du das heute schicken?', 'German').register, 'informal');
  assert.equal(readRegister('오늘 중으로 보내주실 수 있으십니까?', 'Korean').register, 'formal');
  assert.equal(readRegister('오늘 보내줄 수 있어?', 'Korean').register, 'informal');
  assert.equal(readRegister('恐れ入ります、聞き取れませんでした。', 'Japanese').register, 'formal');
});

test('what gave it away is reported, so the translator has the evidence too', () => {
  const reading = readRegister('Could you please send that today, sir?', 'English');
  assert.equal(reading.register, 'formal');
  assert.ok(reading.markers.length > 0);
  assert.ok(reading.markers.every((marker) => 'could you please send that today, sir?'.includes(marker)));
});

test('a line that shows nothing either way says nothing', () => {
  assert.equal(readRegister('The figures are in the deck.', 'English').register, null);
  assert.equal(readRegister('', 'English').register, null);
  assert.equal(readRegister('Anything at all', 'Klingon').register, null);
});

test('a word inside another word is not a giveaway', () => {
  // "sie" inside "siebzehn", "tu" inside "tutorial".
  assert.equal(readRegister('Wir haben siebzehn Kunden.', 'German').register, null);
  assert.equal(readRegister('Le tutorial est prêt.', 'French').register, null);
});

test('the footing holds through a call, and one stray line does not change it', () => {
  let footing = NO_FOOTING;
  footing = nextFooting(footing, 'informal');
  assert.equal(footing.register, 'informal');
  // A single polite sentence inside a casual conversation is not a change of footing.
  footing = nextFooting(footing, 'formal');
  assert.equal(footing.register, 'informal');
  // Two in a row is.
  footing = nextFooting(footing, 'formal');
  assert.equal(footing.register, 'formal');
  // Lines that show nothing leave it where it was.
  footing = nextFooting(footing, null);
  assert.equal(footing.register, 'formal');
});

test('the translator is told which side of the fork, and shown it in the target language', () => {
  const asked = buildTranslationPrompt({
    text: 'Could you please send that through today?',
    targetLanguage: 'French',
    sourceLanguage: 'English',
  });
  assert.match(asked, /being formal/);
  assert.match(asked, /Pourriez-vous/, 'shows formal French, not informal');
  assert.ok(!asked.includes('Tu peux m\'envoyer'), 'does not also show the informal rendering');
});

test('a casual speaker gets the casual side', () => {
  const asked = buildTranslationPrompt({
    text: 'Yeah nah mate, can you send that today?',
    targetLanguage: 'French',
    sourceLanguage: 'English',
  });
  assert.match(asked, /being informal/);
  assert.match(asked, /Tu peux/);
});

test("the call's footing carries lines that show nothing on their own", () => {
  const plain = { text: 'The figures are in the deck.', targetLanguage: 'German', sourceLanguage: 'English' };
  assert.ok(!buildTranslationPrompt(plain).includes('being '), 'nothing known, nothing claimed');
  assert.match(buildTranslationPrompt({ ...plain, register: 'formal' }), /being formal/);
});

test('the prompt is still short enough for a live caption', () => {
  const asked = buildTranslationPrompt({
    text: "Yeah nah mate, I'm snowed under, let's circle back after the arvo",
    targetLanguage: 'Japanese',
    sourceLanguage: 'English',
    register: 'informal',
  });
  assert.ok(asked.length < 2600, `prompt is ${asked.length} characters`);
});

test('every language recognises its own example lines, and never backwards', () => {
  // The strongest check available without a native speaker: each language's
  // giveaways must correctly read the sentences that language itself offers as
  // formal and informal.
  for (const [label, entry] of Object.entries(REGISTER_GUIDES)) {
    const informal = entry.examples.map((example) => readRegister(example.informal, label).register);
    const formal = entry.examples.map((example) => readRegister(example.formal, label).register);
    assert.equal(informal.filter((read) => read === 'formal').length, 0, `${label} reads a casual line as formal`);
    assert.equal(formal.filter((read) => read === 'informal').length, 0, `${label} reads a formal line as casual`);
    assert.ok(informal.filter((read) => read === 'informal').length >= 3, `${label} recognises too few of its casual lines`);
    assert.ok(formal.filter((read) => read === 'formal').length >= 3, `${label} recognises too few of its formal lines`);
  }
});
