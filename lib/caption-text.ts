/**
 * Captions as writing, not as a stream of words.
 *
 * Browser speech recognition hands back "at this time we are issuing a full
 * recall of all saber gh400 printers" — no capital, no full stop, and the next
 * sentence runs straight into it. A transcript of a meeting that reads like
 * that is hard to skim and worse to translate, since punctuation is half of
 * how a sentence's meaning is carried.
 *
 * Only shape is added here: the first letter and the closing mark. Not a word
 * is changed, because guessing at misheard words is how a transcript starts
 * saying things nobody said.
 */

/** Sentence-ending marks across the scripts MemoValet captions. */
const ENDINGS = /[.!?…。！？؟۔]["'”’)\]]*$/u;
const CJK = /[぀-ヿ㐀-鿿豈-﫿]/u;

export function tidyCaption(text: string): string {
  const said = text.replace(/\s+/g, " ").trim();
  if (!said) return "";
  const opened = said[0].toUpperCase() + said.slice(1);
  if (ENDINGS.test(opened)) return opened;
  // A fragment mid-sentence is left alone; a whole line gets its full stop.
  // Japanese and Chinese are written without spaces, so length decides there.
  const wordish = opened.split(" ").length >= 2 || opened.length >= 6;
  if (!wordish) return opened;
  return opened + (CJK.test(opened) ? "。" : ".");
}
