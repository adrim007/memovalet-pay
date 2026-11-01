// Working out which language someone is speaking, and which one they read in,
// instead of making them find it in a list before the call is any use.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/speechRecognition.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, window: undefined });
const { AUTO_LANGUAGE, SPEECH_LANGUAGE_OPTIONS, browserCaptionLanguage, languageLabelFor } = loaded.exports;

test('the device decides the starting language, not English by default', () => {
  assert.equal(browserCaptionLanguage(['ar-EG', 'ar']), 'ar-SA');
  assert.equal(browserCaptionLanguage(['si-LK']), 'si-LK');
  assert.equal(browserCaptionLanguage(['en-AU', 'en']), 'en-US');
  assert.equal(browserCaptionLanguage(['fr-CA']), 'fr-FR');
});

test('Chinese depends on where: Hong Kong and Macau speak Cantonese', () => {
  assert.equal(browserCaptionLanguage(['zh-HK']), 'zh-HK');
  assert.equal(browserCaptionLanguage(['zh-MO']), 'zh-HK');
  assert.equal(browserCaptionLanguage(['zh-CN']), 'zh-CN');
  assert.equal(browserCaptionLanguage(['zh']), 'zh-CN');
});

test('older tags and second choices still land somewhere sensible', () => {
  assert.equal(browserCaptionLanguage(['iw-IL']), 'he-IL', 'the old code for Hebrew');
  assert.equal(browserCaptionLanguage(['tl-PH']), 'fil-PH', 'Tagalog written the old way');
  assert.equal(browserCaptionLanguage(['is-IS', 'da-DK', 'de-DE']), 'de-DE', 'the first one we caption');
});

test('a language MemoValet does not caption leaves the choice alone', () => {
  assert.equal(browserCaptionLanguage(['is-IS']), null);
  assert.equal(browserCaptionLanguage([]), null);
  assert.equal(browserCaptionLanguage(undefined), null);
  assert.equal(browserCaptionLanguage([42]), null);
});

test('what the transcription says it heard becomes one of our language names', () => {
  assert.equal(languageLabelFor('Arabic'), 'Arabic');
  assert.equal(languageLabelFor('  arabic '), 'Arabic');
  assert.equal(languageLabelFor('Modern Standard Arabic'), 'Arabic');
  assert.equal(languageLabelFor('English (Australia)'), 'English');
  assert.equal(languageLabelFor('Icelandic'), null, 'not one we caption');
  assert.equal(languageLabelFor(''), null);
  assert.equal(languageLabelFor(null), null);
});

test('detection is not something to pick: it is what happens by default', () => {
  // The pickers list languages only. "auto" is how the call page asks the
  // server to work it out, and never appears on screen.
  assert.equal(AUTO_LANGUAGE, 'auto');
  assert.ok(!SPEECH_LANGUAGE_OPTIONS.some((option) => option.code === AUTO_LANGUAGE));
  assert.ok(!SPEECH_LANGUAGE_OPTIONS.some((option) => /detect/i.test(option.label)));
});
