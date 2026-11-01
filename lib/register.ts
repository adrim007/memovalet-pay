import { registerGuideFor, type Register } from "./register-guide";

/**
 * Working out whether someone is speaking formally or casually, from what they
 * just said — so nobody has to set it, and the translation picks the same side
 * of the fork they did (see register-guide for why every one of these languages
 * has a fork).
 *
 * The giveaways are the pronouns, endings and particles in register-guide's
 * markers. A line usually carries one or two, so this is a count, not a
 * judgement: whichever side shows up more wins, and a line with nothing either
 * way says nothing rather than guessing.
 */

const LETTER = /[a-z0-9À-ɏ]/i;

/** Whole-word for alphabets, plain containment for scripts written without spaces. */
function says(text: string, marker: string): boolean {
  const haystack = text.toLowerCase();
  const needle = marker.toLowerCase().trim();
  if (!needle) return false;
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    const before = haystack[from - 1];
    const after = haystack[from + needle.length];
    const wordish = LETTER.test(needle[0]) && LETTER.test(needle[needle.length - 1]);
    if (!wordish || ((!before || !LETTER.test(before)) && (!after || !LETTER.test(after)))) return true;
    from = haystack.indexOf(needle, from + 1);
  }
  return false;
}

export interface RegisterReading {
  register: Register | null;
  /** What gave it away, for the translator and for anyone checking this. */
  markers: string[];
}

export function readRegister(text: string, language: string | null): RegisterReading {
  const guide = language ? registerGuideFor(language) : null;
  if (!guide || !text.trim()) return { register: null, markers: [] };
  const formal = guide.markers.formal.filter((marker) => says(text, marker));
  const informal = guide.markers.informal.filter((marker) => says(text, marker));
  // Weighted by how much of a giveaway each one is: "I'm afraid" settles a
  // sentence that also contains "didn't", where counting them would not.
  const weigh = (markers: string[]) => markers.reduce((total, marker) => total + marker.trim().length, 0);
  const formalWeight = weigh(formal);
  const informalWeight = weigh(informal);
  if (formalWeight > informalWeight) return { register: "formal", markers: formal.slice(0, 3) };
  if (informalWeight > formalWeight) return { register: "informal", markers: informal.slice(0, 3) };
  return { register: null, markers: [] };
}

/**
 * How a speaker is being taken, over a whole call rather than one sentence.
 *
 * People don't switch between tu and vous halfway through a meeting, and a
 * translation that does reads as a stranger walking in. So the register sticks
 * once it is known, and only changes when two lines in a row say otherwise —
 * one stray polite sentence inside a casual conversation is not a change of
 * footing.
 */
export interface RegisterFooting {
  register: Register | null;
  /** A reading that disagrees with the current footing, waiting to be confirmed. */
  pending: Register | null;
}

export const NO_FOOTING: RegisterFooting = { register: null, pending: null };

export function nextFooting(footing: RegisterFooting, reading: Register | null): RegisterFooting {
  if (!reading) return footing;
  if (!footing.register) return { register: reading, pending: null };
  if (reading === footing.register) return { register: footing.register, pending: null };
  // Disagrees: the first one waits, the second one changes the footing.
  if (footing.pending === reading) return { register: reading, pending: null };
  return { register: footing.register, pending: reading };
}
