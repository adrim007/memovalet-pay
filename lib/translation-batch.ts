import { styleFor } from "./translation-style";
import { registerGuideFor, type Register } from "./register-guide";
import { readRegister } from "./register";
import { slangIn } from "./translation-prompt";

/**
 * The meeting so far, put into another language in one go.
 *
 * Translation can be switched on at any point in a call. Before, switching it
 * on translated only the last fifteen lines, one request each, so anything said
 * earlier stayed in the original language — and a long meeting done line by
 * line would be hundreds of requests at once, enough to hit the AI service's
 * rate limit and hold up the live lines behind them. Now everything said so
 * far goes in batches, newest first because that is what is on screen, so an
 * hour-long call is a few dozen requests; lines said from then on are still
 * translated the moment they arrive, on their own.
 */

/** Lines in one request. */
export const BATCH_LINES = 15;
/** Characters of speech in one request, so a batch always finishes quickly. */
export const BATCH_CHARS = 5000;

/** What the server accepts, whatever a page sends. */
export const MAX_BATCH_LINES = 20;
export const MAX_BATCH_CHARS = 12000;
export const MAX_LINE_CHARS = 3000;

export interface BatchLine {
  text: string;
  /** What it was spoken in, when known. */
  sourceLanguage?: string | null;
  /** How this speaker has been taken so far in the call. */
  register?: Register | null;
}

/**
 * Everything said so far, in batches small enough for one request each:
 * newest batch first, and within a batch in the order it was said, so the
 * translator reads each line with the ones around it.
 */
export function backfillBatches<T extends { text: string }>(
  lines: T[],
  size = BATCH_LINES,
  chars = BATCH_CHARS
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let length = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (current.length && (current.length === size || length + line.text.length > chars)) {
      batches.push(current.reverse());
      current = [];
      length = 0;
    }
    current.push(line);
    length += line.text.length;
  }
  if (current.length) batches.push(current.reverse());
  return batches;
}

/** A batch as sent by a page, checked. Null when it isn't one we'll take. */
export function readBatchLines(input: unknown, languages: string[]): BatchLine[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_BATCH_LINES) return null;
  const known = new Set(languages);
  const lines: BatchLine[] = [];
  let total = 0;
  for (const item of input) {
    const value = (item ?? {}) as { text?: unknown; sourceLanguage?: unknown; register?: unknown };
    const text = typeof value.text === "string" ? value.text.trim() : "";
    if (!text || text.length > MAX_LINE_CHARS) return null;
    total += text.length;
    const source = typeof value.sourceLanguage === "string" ? value.sourceLanguage.trim() : "";
    lines.push({
      text,
      sourceLanguage: known.has(source) ? source : null,
      register: value.register === "formal" || value.register === "informal" ? value.register : null,
    });
  }
  return total <= MAX_BATCH_CHARS ? lines : null;
}

/** What the translator is asked for a batch: the same rules as a single line. */
export function buildBatchTranslationPrompt(options: { lines: BatchLine[]; targetLanguage: string }): string {
  const { lines, targetLanguage } = options;
  const target = styleFor(targetLanguage);
  const registerGuide = registerGuideFor(targetLanguage);
  const slang = new Map<string, string>();

  const numbered = lines.map((line, index) => {
    for (const entry of slangIn(line.text, line.sourceLanguage ?? null)) {
      if (slang.size < 12 && !slang.has(entry.term)) slang.set(entry.term, entry.means);
    }
    // The line itself wins when it says something; the call so far otherwise.
    const footing = readRegister(line.text, line.sourceLanguage ?? null).register ?? line.register ?? null;
    return {
      n: index + 1,
      ...(line.sourceLanguage ? { language: line.sourceLanguage } : {}),
      ...(footing ? { register: footing } : {}),
      text: line.text,
    };
  });

  const rules = [
    `Translate each of these lines of live meeting speech into ${targetLanguage}. They are consecutive lines from the same call, in the order they were said.`,
    "Translate every line on its own — never merge, split, skip or reorder lines — but read the lines around it to understand what it means.",
    "Keep each speaker's tone and register exactly: slang stays slang, casual stays casual, formal stays formal.",
    "Where the language forces a choice of formality — the form of \"you\", verb endings, honorifics, particles — pick the one that matches the speaker. A line marked with a register is that register; keep it.",
    "Do not sanitise, soften or tidy it up, do not drop any meaning, and do not add anything that wasn't said.",
    "Write it properly: capital letters, commas and a full stop, in that language's own punctuation. Live speech arrives unpunctuated; the translation should still read as writing.",
    'Return only JSON: an array with one object per line, like [{"n": 1, "t": "the translation"}], using each line\'s own n.',
  ];
  if (target) rules.push(`How ${targetLanguage} sounds when people talk: ${target.register}`);
  if (registerGuide && numbered.some((line) => "register" in line)) {
    rules.push(`Formal ${targetLanguage}: ${registerGuide.formal} Informal ${targetLanguage}: ${registerGuide.informal}`);
  }
  if (slang.size) {
    rules.push(`What the speakers meant by: ${[...slang].map(([term, means]) => `"${term}" = ${means}`).join("; ")}.`);
  }

  return `${rules.join("\n")}\n\nLines:\n${JSON.stringify(numbered)}`;
}

/**
 * The translations back, one per line in the order sent — null for any line
 * the answer left out, so a short answer never puts a translation against the
 * wrong line.
 */
export function parseBatchTranslations(raw: string, count: number): Array<string | null> {
  const found: Array<string | null> = Array.from({ length: count }, () => null);
  let value: unknown;
  try {
    value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return found;
  }
  const items: unknown[] = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { translations?: unknown }).translations)
      ? (value as { translations: unknown[] }).translations
      : [];

  // A plain list of strings is only trusted when it has exactly one per line.
  if (items.length === count && items.every((item) => typeof item === "string")) {
    return items.map((item) => ((item as string).trim() ? (item as string).trim() : null));
  }
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const { n, t } = item as { n?: unknown; t?: unknown };
    const index = Number(n) - 1;
    if (Number.isInteger(index) && index >= 0 && index < count && typeof t === "string" && t.trim() && found[index] === null) {
      found[index] = t.trim();
    }
  }
  return found;
}
