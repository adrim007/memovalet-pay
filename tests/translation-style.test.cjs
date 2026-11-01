// Slang stays slang. Each of the 21 languages carries its own guidance on how
// people actually talk, and the slang in a line is explained to the translator
// — only the slang that is actually there.
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
const style = load('lib/translation-style.ts');
const registerGuide = load('lib/register-guide.ts');
const register = load('lib/register.ts', { './register-guide': registerGuide });
const prompt = load('lib/translation-prompt.ts', {
  './translation-style': style, './register-guide': registerGuide, './register': register,
});
const speech = load('lib/speechRecognition.ts', {});
const { LANGUAGE_STYLES, styleFor } = style;
const { buildTranslationPrompt, slangIn } = prompt;

test('every language MemoValet captions has its own guidance and slang', () => {
  for (const { label } of speech.SPEECH_LANGUAGE_OPTIONS) {
    const entry = styleFor(label);
    assert.ok(entry, `${label} has no guidance`);
    assert.ok(entry.register.length > 80, `${label}'s guidance is too thin to steer anything`);
    assert.ok(entry.slang.length >= 13, `${label} has only ${entry.slang.length} expressions`);
    for (const { term, means } of entry.slang) {
      assert.ok(term.trim(), `${label} has a blank term`);
      assert.ok(means.trim().length > 3, `${label}: "${term}" has no meaning written down`);
    }
  }
  assert.equal(Object.keys(LANGUAGE_STYLES).length, speech.SPEECH_LANGUAGE_OPTIONS.length);
});

test('the guidance covers what actually goes wrong: formality, dialect and particles', () => {
  // A wrong "you" or a textbook dialect is what makes a translated meeting
  // sound like a stranger talking.
  assert.match(styleFor('French').register, /tu\b.*vous|vous\b.*tu/s);
  assert.match(styleFor('Korean').register, /반말|해요체/);
  assert.match(styleFor('Arabic').register, /dialect|Modern Standard/i);
  assert.match(styleFor('Japanese').register, /ちょっと|politeness/i);
  assert.match(styleFor('Sinhala').register, /spoken|literary/i);
});

test('slang in the line is explained, and nothing else is', () => {
  const found = slangIn("Yeah nah, I'm snowed under — let's park that till arvo", 'English');
  const terms = found.map((entry) => entry.term);
  assert.ok(terms.includes('arvo'), 'arvo was said');
  assert.ok(terms.includes('snowed under'));
  assert.ok(terms.includes('park that'));
  assert.ok(!terms.includes('ballpark'), 'nothing that was not said');
  assert.equal(slangIn('The quarterly figures are attached.', 'English').length, 0);
});

test('a word inside another word is not slang', () => {
  // "sus" is slang; "sustainable" is not, and "mate" is not "automated".
  assert.equal(slangIn('This is a sustainable, automated process', 'English').length, 0);
  assert.equal(slangIn('That looks sus, mate', 'English').length, 2);
});

test('scripts without spaces between words are matched too', () => {
  assert.ok(slangIn('搞定了，我们加班吧', 'Mandarin').some((entry) => entry.term === '搞定'));
  assert.ok(slangIn('يلا نبدأ، تمام؟', 'Arabic').some((entry) => entry.term === 'يلا'));
  assert.ok(slangIn('මචං පට්ට වැඩක්', 'Sinhala').some((entry) => entry.term === 'මචං'));
});

test('the longer expression wins over the shorter one inside it', () => {
  const found = slangIn('No wahala, we go do am', 'Yoruba').map((entry) => entry.term);
  assert.ok(found.includes('no wahala'));
  assert.ok(!found.includes('wahala'), 'not explained twice');
});

test('the prompt carries the target language\'s own way of talking', () => {
  const asked = buildTranslationPrompt({ text: 'Can you send that today?', targetLanguage: 'German' });
  assert.match(asked, /into German/);
  assert.match(asked, /du and Sie/);
  assert.match(asked, /Text: Can you send that today\?$/);
});

test('an unknown language still gets a sound instruction rather than nothing', () => {
  const asked = buildTranslationPrompt({ text: 'hello', targetLanguage: 'Klingon' });
  assert.match(asked, /into Klingon/);
  assert.match(asked, /tone and register/);
});

test('the prompt stays short: a caption is not worth a dictionary', () => {
  const chatty = 'Yeah nah mate, heaps of blockers, let me circle back after the arvo, no worries, cheers';
  const asked = buildTranslationPrompt({ text: chatty, targetLanguage: 'Arabic', sourceLanguage: 'English' });
  assert.ok(asked.length < 2200, `prompt is ${asked.length} characters`);
  assert.ok((asked.match(/" = /g) || []).length <= 6, 'at most a handful of terms explained');
});
