const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fontkit = require('fontkit');

function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports: module.exports, module, process, Buffer,
    require: name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name) });
  return module.exports;
}
const { pdfTextRuns } = load('lib/pdf/unicode-text.ts');
const { buildMeetingPdf } = load('lib/pdf/meetingPdf.ts');
const samples = [
  'English: Meeting summary', 'Arabic: ملخص الاجتماع', 'Cantonese: 會議摘要',
  'French: Résumé de réunion', 'German: Besprechungsübersicht', 'Hebrew: סיכום פגישה',
  'Hindi: बैठक का सारांश', 'Italian: Riepilogo della riunione', 'Japanese: 会議の要約',
  'Korean: 회의 요약', 'Malay: Ringkasan mesyuarat', 'Mandarin: 会议摘要',
  'Russian: Итоги встречи', 'Sinhala: රැස්වීමේ සාරාංශය', 'Spanish: Resumen de reunión',
  'Swahili: Muhtasari wa mkutano', 'Tagalog: Buod ng pagpupulong', 'Tamil: கூட்டத்தின் சுருக்கம்',
  'Thai: สรุปการประชุม', 'Turkish: Toplantı özeti', 'Yoruba: Àkótán ìpàdé',
];
const fonts = new Map();
for (const sample of samples) test(`PDF glyph coverage: ${sample.split(':')[0]}`, () => {
  const runs = pdfTextRuns(sample);
  assert.equal(runs.map(run => run.text).join(''), sample);
  for (const run of runs) {
    if (!fonts.has(run.font)) fonts.set(run.font, fontkit.openSync(`assets/pdf-fonts/${run.font}.ttf`));
    const font = fonts.get(run.font);
    for (const char of run.text) assert.ok(font.hasGlyphForCodePoint(char.codePointAt(0)), `${run.font} missing ${char}`);
  }
});

test('multilingual PDF generation completes with embedded fonts', async () => {
  const pdf = await buildMeetingPdf('MemoValet language export check', {
    meeting_summary: samples.join('\n'), key_decisions: ['Confirm the schedule'], action_items: [], follow_up_email: { subject: '', body: '' },
  });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.includes(Buffer.from('/FontFile2')));
  if (process.env.PDF_TEST_OUTPUT) fs.writeFileSync(process.env.PDF_TEST_OUTPUT, pdf);
});
