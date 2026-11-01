import path from "node:path";
import type PDFKit from "pdfkit";

const scripts: [RegExp, string][] = [
  [/\p{Script=Arabic}/u, "NotoSansArabic"],
  [/\p{Script=Hebrew}/u, "NotoSansHebrew"],
  [/\p{Script=Devanagari}/u, "NotoSansDevanagari"],
  [/\p{Script=Sinhala}/u, "NotoSansSinhala"],
  [/\p{Script=Tamil}/u, "NotoSansTamil"],
  [/\p{Script=Thai}/u, "NotoSansThai"],
  [/\p{Script=Hangul}/u, "NotoSansKR"],
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/u, "NotoSansJP"],
  [/\p{Script=Han}/u, "NotoSansSC"],
];

export function pdfTextRuns(text: string) {
  const runs: { font: string; text: string }[] = [];
  const cjkFont = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) ? "NotoSansJP" : "NotoSansSC";
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
    let font = scripts.find(([pattern]) => pattern.test(segment))?.[1] || "NotoSans";
    if (font === "NotoSansSC") font = cjkFont;
    const previous = runs[runs.length - 1];
    // Keep punctuation/spacing with its script so shaping sees complete phrases.
    if (previous && /^[\p{P}\p{Z}\p{N}\p{M}]+$/u.test(segment)) font = previous.font;
    if (previous?.font === font) previous.text += segment;
    else runs.push({ font, text: segment });
  }
  return runs;
}

export function writeUnicodeText(doc: InstanceType<typeof PDFKit>, text: string, size: number) {
  for (const paragraph of text.split(/\r?\n/)) {
    const runs = pdfTextRuns(paragraph);
    if (!runs.length) { doc.moveDown(0.5); continue; }
    const rtl = /^[\s\p{P}\p{N}]*[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(paragraph);
    runs.forEach((run, index) => {
      // Explicit features bypass PDFKit's per-word layout cache, allowing
      // fontkit to shape/reorder the entire RTL phrase, including spaces.
      doc.font(path.join(process.cwd(), "assets", "pdf-fonts", `${run.font}.ttf`))
        .fontSize(size).text(run.text, { features: [], continued: index < runs.length - 1, align: rtl ? "right" : "left" });
    });
  }
}
