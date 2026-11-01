import { styleFor, type SlangEntry } from "./translation-style";
import { registerGuideFor, type Register } from "./register-guide";
import { readRegister } from "./register";

/**
 * What the translator is actually asked, for one line of live speech.
 *
 * Two things are added to the instruction. How the target language sounds when
 * people talk (which "you", which dialect, which particles) — always, because
 * it shapes every sentence that comes out. And the meaning of any slang that
 * appears in what was just said — only the terms that are actually there, so a
 * caption stays a short prompt rather than carrying a dictionary with it.
 */

/** Longest slang terms first, so "no wahala" is found before "wahala". */
function byLength(entries: SlangEntry[]): SlangEntry[] {
  return [...entries].sort((a, b) => b.term.length - a.term.length);
}

const LETTER = /[a-z0-9]/i;

/** Whole-word matching for alphabets; plain containment for scripts without spaces. */
function says(text: string, term: string): boolean {
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    const before = haystack[from - 1];
    const after = haystack[from + needle.length];
    const wordish = LETTER.test(needle[0]);
    if (!wordish || ((!before || !LETTER.test(before)) && (!after || !LETTER.test(after)))) return true;
    from = haystack.indexOf(needle, from + 1);
  }
  return false;
}

/** The slang in this line, with what it means — at most `limit` of them. */
export function slangIn(text: string, language: string | null, limit = 6): SlangEntry[] {
  const style = language ? styleFor(language) : null;
  if (!style || !text.trim()) return [];
  const found: SlangEntry[] = [];
  for (const entry of byLength(style.slang)) {
    if (found.length === limit) break;
    // Skip a term already covered by a longer one that matched.
    if (found.some((kept) => kept.term.toLowerCase().includes(entry.term.toLowerCase()))) continue;
    if (says(text, entry.term)) found.push(entry);
  }
  return found;
}

export function buildTranslationPrompt(options: {
  text: string;
  targetLanguage: string;
  /** What it was spoken in, when known — for reading the slang and register in it. */
  sourceLanguage?: string | null;
  /**
   * How this speaker is being taken over the call so far. The line itself wins
   * when it says something; this carries the footing through lines that don't.
   */
  register?: Register | null;
}): string {
  const { text, targetLanguage, sourceLanguage = null, register = null } = options;
  const target = styleFor(targetLanguage);
  const heard = slangIn(text, sourceLanguage);
  const reading = readRegister(text, sourceLanguage);
  const footing = reading.register ?? register;
  const registerGuide = registerGuideFor(targetLanguage);

  const lines = [
    `Translate this short piece of live meeting speech into ${targetLanguage}.`,
    "Keep the speaker's tone and register exactly: slang stays slang, casual stays casual, formal stays formal.",
    "Where the language forces a choice of formality — the form of \"you\", verb endings, honorifics, particles — pick the one that matches the speaker and keep it.",
    "Do not sanitise, soften or tidy it up, do not drop any meaning, and do not add anything that wasn't said.",
    "Write it properly: capital letters, commas and a full stop, in that language's own punctuation. Live speech arrives unpunctuated; the translation should still read as writing.",
    "Return only the translation — no notes, no quotes, no explanation.",
  ];

  if (target) lines.push(`How ${targetLanguage} sounds when people talk: ${target.register}`);
  if (footing && registerGuide) {
    // Which side of the fork — tu or vous, 반말 or 합니다체 — with the target
    // language's own way of taking it, and two lines showing what that is.
    const shown = registerGuide.examples
      .slice(0, 2)
      .map((example) => `"${example.en}" → "${example[footing]}"`)
      .join("; ");
    lines.push(
      `The speaker is being ${footing}${reading.markers.length ? ` (they said ${reading.markers.map((m) => `"${m}"`).join(", ")})` : ""}. ` +
        `${footing === "formal" ? "Formal" : "Informal"} ${targetLanguage}: ${registerGuide[footing]} For example: ${shown}.`
    );
  }
  if (heard.length) {
    lines.push(
      `What the speaker meant by: ${heard.map((entry) => `"${entry.term}" = ${entry.means}`).join("; ")}.`
    );
  }

  return `${lines.join("\n")}\n\nText: ${text}`;
}
