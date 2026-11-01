const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/LiveTranslationPanel.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, { module: mod, exports: mod.exports, require: id => {
  if (id === '@phosphor-icons/react') return new Proxy({}, { get: () => () => null });
  if (id === '@/lib/speechRecognition') return { SPEECH_LANGUAGE_OPTIONS: [{ code: 'en-US', label: 'English' }, { code: 'ar-SA', label: 'Arabic' }] };
  if (id === '@/lib/caption-groups') {
    const loaded = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/caption-groups.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { module: loaded, exports: loaded.exports });
    return loaded.exports;
  }
  return require(id);
} });
const render = props => renderToStaticMarkup(React.createElement(mod.exports.default, {
  captions: [{ id: '1', speakerName: 'Person', original: 'Original speech', translated: 'Translated speech', time: '12:00', langLabel: 'English' }],
  language: 'en-US', enabled: true, mode: 'translation', onClose() {}, onLanguageChange() {}, onModeChange() {}, ...props,
}));
test('translation popup has an accessible close control and language settings', () => {
  const html = render({});
  assert.match(html, /role="dialog" aria-label="Live translation"/);
  assert.match(html, /aria-label="Close live translation"/);
  assert.match(html, /aria-label="Translation language"/);
  assert.match(html, /Translated speech/);
});
test('turning translation off never presents stale translations', () => {
  const html = render({ enabled: false });
  assert.match(html, /Original speech/);
  assert.doesNotMatch(html, /Translated speech/);
});
test('original mode shows only original speech and text is escaped', () => {
  assert.doesNotMatch(render({ mode: 'original' }), /Translated speech/);
  assert.match(render({ captions: [{ id: 'x', speakerName: '<script>', original: '<img>', translated: '<iframe>' }] }), /&lt;iframe&gt;/);
});

test("a run of lines from one person says their name once", () => {
  const html = render({
    captions: [
      { id: '1', speakerId: 'a', speakerName: 'Maya Sharma', original: 'First line', translated: 'First line', time: '12:00', langLabel: 'English' },
      { id: '2', speakerId: 'a', speakerName: 'Maya Sharma', original: 'Second line', translated: 'Second line', time: '12:01', langLabel: 'English' },
      { id: '3', speakerId: 'b', speakerName: 'Jordan Lee', original: 'Their turn', translated: 'Their turn', time: '12:02', langLabel: 'English' },
    ],
  });
  // Once for Maya's run, once when the speaker changes — not once per line.
  assert.equal(html.split('Maya Sharma').length - 1, 2, 'name shown once, then only for screen readers');
  assert.match(html, /Jordan Lee/);
  assert.match(html, /Second line/, 'every line is still there');
});

test('there is no separate "Translation on" switch to forget', () => {
  const html = render({ language: 'ar-SA' });
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.doesNotMatch(html, />Translation on</);
  assert.match(html, /Translating into Arabic/, 'it says what it is doing');
});

test('when everyone already speaks the language being read, it says to pick another', () => {
  const html = render({ language: 'en-US' });
  assert.match(html, /already in English/);
  assert.match(html, /Choose the language you want to read in/);
  assert.doesNotMatch(render({ language: 'en-US', mode: 'original' }), /already in English/, 'not when reading the original');
});

test('the whole meeting is there to scroll back through', () => {
  const captions = Array.from({ length: 180 }, (_, i) => ({
    id: String(i), speakerId: 'a', speakerName: 'Maya Sharma', original: `Line ${i}.`, translated: `Ligne ${i}.`, time: '12:00', langLabel: 'English',
  }));
  const html = render({ captions, language: 'ar-SA' });
  assert.match(html, /Show 30 earlier lines/);
  assert.match(html, /Ligne 179\./, 'the latest is on screen');
  assert.doesNotMatch(html, /Ligne 0\./, 'the start waits until asked');
});

// The part that matters is the wiring, not the words: pressing Translate, or
// the Translation tab, has to reach the call page and switch translation on.
test('the Translate button and the Translation tab switch translation on', () => {
  const room = fs.readFileSync('components/LiveMeetingRoom.tsx', 'utf8');
  const call = fs.readFileSync('components/LiveSessionClient.tsx', 'utf8');
  const button = room.slice(room.indexOf('label="Translate"'), room.indexOf('<Translate size={21} />'));
  assert.match(button, /onTranslate\?\.\(\)/, 'the toolbar button');
  assert.match(room, /if \(mode === "translation"\) onTranslate\?\.\(\)/, 'the tab in the panel');
  assert.match(call, /onTranslate=\{turnTranslationOn\}/, 'the call page does the switching');
  const on = call.slice(call.indexOf('const turnTranslationOn = () => {'), call.indexOf('const chooseReadingLanguage'));
  assert.match(on, /translationEnabledRef\.current = true/);
  assert.match(on, /translateMeetingSoFar\(\)/, 'and everything said so far is translated');
  assert.doesNotMatch(call, /translationEnabledRef\.current = false/, 'nothing switches it back off mid-meeting');
});
