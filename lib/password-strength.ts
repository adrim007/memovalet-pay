/**
 * How strong a new password is, said plainly while someone types it.
 *
 * Length first, as password guidance has settled on: a long ordinary phrase
 * beats a short scramble of symbols. The things that actually get accounts
 * broken into — a password from the well-known lists, the person's own email
 * or name, one character over and over, or a run straight off the keyboard —
 * are refused outright rather than merely marked weak, because those are
 * guessed in seconds however many rules they technically satisfy.
 */

export const MIN_PASSWORD = 8;

export type PasswordLevel = "short" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  level: PasswordLevel;
  /** 0–4, for how much of the bar to fill. */
  score: number;
  /** "Weak", "Strong" — what the person sees. */
  label: string;
  /** One thing that would help, or what makes it good. */
  hint: string;
  /** Too easily guessed to accept at all. */
  unsafe: boolean;
}

// The passwords tried first in every break-in attempt, and the ones people
// reach for on a site called MemoValet.
const WELL_KNOWN = new Set([
  "password", "passw0rd", "p@ssword", "p@ssw0rd", "letmein", "welcome", "admin", "administrator",
  "iloveyou", "princess", "sunshine", "monkey", "dragon", "football", "baseball", "superman",
  "qwerty", "qwertyui", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm", "azerty",
  "abc", "abcd", "abcde", "abcdef", "abcdefg", "abcdefgh",
  "1234", "12345", "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000",
  "trustno1", "whatever", "freedom", "starwars", "master", "shadow", "ninja", "hello", "charlie",
  "memovalet", "meetingflow", "meeting", "secret", "changeme", "temporary", "test",
]);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

/** The plain words behind "P@ssw0rd!", "letmein1" or "Password2024". */
function bareWords(password: string): string[] {
  const lower = password.toLowerCase();
  const swapped = lower.replace(/[03145$7@]/g, (character) =>
    ({ "0": "o", "3": "e", "1": "i", "4": "a", "5": "s", $: "s", "7": "t", "@": "a" })[character] ?? character
  );
  // Both readings: digits as the letters they stand in for, and digits simply
  // dropped — "letmein1" is "letmein" with a 1 stuck on the end.
  return [swapped.replace(/[^a-z]/g, ""), lower.replace(/[^a-z]/g, "")];
}

/** "Melbourne7": one word with a little punctuation, which is guessed from a word list. */
function isOneWordWithTrimmings(password: string): boolean {
  return /^[A-Za-z]+[\d!@#$%^&*.\-_]{0,3}$/.test(password) && password.replace(/[^A-Za-z]/g, "").length <= 12;
}

function isRunOfOneCharacter(password: string): boolean {
  return new Set(password.toLowerCase()).size <= 2 && password.length < 16;
}

function isKeyboardRun(password: string): boolean {
  const value = password.toLowerCase();
  if (value.length < 4) return false;
  const backwards = [...value].reverse().join("");
  return KEYBOARD_ROWS.some((row) => row.includes(value) || row.includes(backwards));
}

/** "maya" from maya@example.com, and any word of their name. */
function ownWords(context: { email?: string; name?: string } = {}): string[] {
  const words: string[] = [];
  const local = context.email?.split("@")[0] ?? "";
  words.push(...local.split(/[^a-z0-9]+/i), ...(context.name ?? "").split(/\s+/));
  return words.map((word) => word.toLowerCase()).filter((word) => word.length >= 4);
}

export function passwordStrength(
  password: string,
  context: { email?: string; name?: string } = {}
): PasswordStrength {
  if (!password) {
    return { level: "short", score: 0, label: "", hint: `At least ${MIN_PASSWORD} characters.`, unsafe: true };
  }
  if (password.length < MIN_PASSWORD) {
    return {
      level: "short",
      score: 0,
      label: "Too short",
      hint: `${MIN_PASSWORD - password.length} more character${MIN_PASSWORD - password.length === 1 ? "" : "s"} to go.`,
      unsafe: true,
    };
  }

  const value = password.toLowerCase();
  const bare = bareWords(password);
  const mine = ownWords(context).find((word) => value.includes(word));
  if (mine) {
    return { level: "weak", score: 0, label: "Weak", hint: `Anyone who knows your ${context.email?.toLowerCase().includes(mine) ? "email" : "name"} would try this. Use something unrelated to you.`, unsafe: true };
  }
  if (WELL_KNOWN.has(value) || bare.some((word) => WELL_KNOWN.has(word))) {
    return { level: "weak", score: 0, label: "Weak", hint: "This is one of the first passwords anyone would guess. Try something else.", unsafe: true };
  }
  if (isRunOfOneCharacter(password)) {
    return { level: "weak", score: 0, label: "Weak", hint: "Too few different characters. Mix it up.", unsafe: true };
  }
  if (isKeyboardRun(password)) {
    return { level: "weak", score: 0, label: "Weak", hint: "That's a straight run of keys. Try something less predictable.", unsafe: true };
  }

  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((pattern) => pattern.test(password)).length;
  let score = 1;
  if (password.length >= 10) score = 2;
  if (password.length >= 14) score = 3;
  if (password.length >= 18) score = 4;
  // A mix helps a short password most; a long one hardly needs it.
  if (kinds >= 3 && password.length >= 10) score += 1;
  if (kinds === 1 && password.length < 16) score -= 1;
  // One word with a number on the end is the most common password there is,
  // and word lists try exactly that; it is never better than fair.
  const oneWord = isOneWordWithTrimmings(password);
  if (oneWord) score = Math.min(score, 2);
  score = Math.max(0, Math.min(4, score));

  const level: PasswordLevel = score <= 1 ? "weak" : score === 2 ? "fair" : score === 3 ? "good" : "strong";
  const hint =
    level === "strong"
      ? "Keep it somewhere safe, like your password manager."
      : oneWord
        ? "One word with a number on the end is easy to guess. Two or three unrelated words are far stronger."
        : password.length < 14
        ? "A longer password is stronger. Try a few unrelated words instead of a short combination."
        : kinds < 3
          ? "Add a capital, a number or a symbol."
          : "Nearly there. A few more characters would do it.";

  return {
    level,
    score,
    label: level === "weak" ? "Weak" : level === "fair" ? "Fair" : level === "good" ? "Good" : "Strong",
    hint,
    unsafe: false,
  };
}
