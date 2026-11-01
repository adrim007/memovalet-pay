/**
 * Has this password already been stolen from somewhere else?
 *
 * Hundreds of millions of real passwords are in circulation from other
 * companies' break-ins. A password on those lists is tried first in every
 * automated attack, however long or clever it looks — "Tr0ub4dor&3" is on
 * them. The strength meter in lib/password-strength can't know that; only a
 * list can.
 *
 * Supabase can check this list for you, but only on its paid plan. This does
 * the same check against the same free source (HaveIBeenPwned's Pwned
 * Passwords), from the person's own browser.
 *
 * The password is never sent anywhere. It is hashed on the device, and only
 * the first five characters of that hash leave it — about a millionth of the
 * list comes back, and the matching is done here. The service cannot tell
 * which password was being checked, or even whether one matched.
 */

/** Characters of the hash that are sent. The rest never leaves the device. */
export const PREFIX_LENGTH = 5;

/** Long enough for a slow connection, short enough not to stall signing up. */
export const LOOKUP_TIMEOUT_MS = 3000;

export const PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/";

/** SHA-1 of the password, uppercase hex — the form the list is published in. */
export async function passwordHash(password: string, subtle: SubtleCrypto): Promise<string> {
  const digest = await subtle.digest("SHA-1", new TextEncoder().encode(password));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** The part that is sent, and the part that stays here. */
export function splitHash(hash: string): { prefix: string; suffix: string } {
  return { prefix: hash.slice(0, PREFIX_LENGTH), suffix: hash.slice(PREFIX_LENGTH) };
}

/**
 * How many times this password appears in the list, from the answer for its
 * prefix. The answer is lines of "SUFFIX:COUNT"; anything else is ignored
 * rather than trusted.
 */
export function countInRange(body: string, suffix: string): number {
  for (const line of body.split("\n")) {
    const [found, times] = line.trim().split(":");
    if (found && found.toUpperCase() === suffix.toUpperCase()) {
      const count = Number.parseInt(times ?? "", 10);
      return Number.isFinite(count) && count > 0 ? count : 0;
    }
  }
  return 0;
}

/** What the person is told. Never the number — it reads as a score to beat. */
export const BREACHED_HINT =
  "This password has appeared in a known data breach, so it's already on the lists attackers try first. Please choose a different one.";

export interface BreachCheck {
  /** Found on the list: don't let this one through. */
  breached: boolean;
  /**
   * The check couldn't be made — offline, blocked, or too slow. Sign-up is
   * allowed through in that case: locking people out of their own account
   * because a third party is down would be the worse failure.
   */
  unchecked: boolean;
}

const OK: BreachCheck = { breached: false, unchecked: false };
const UNKNOWN: BreachCheck = { breached: false, unchecked: true };

/**
 * The whole check. `deps` is injected so this can be tested without a network
 * and without a browser.
 */
export async function checkPasswordBreached(
  password: string,
  deps: {
    fetch: typeof globalThis.fetch;
    subtle: SubtleCrypto | undefined;
    timeoutMs?: number;
  }
): Promise<BreachCheck> {
  if (!password || !deps.subtle || typeof deps.fetch !== "function") return UNKNOWN;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), deps.timeoutMs ?? LOOKUP_TIMEOUT_MS);
  try {
    const { prefix, suffix } = splitHash(await passwordHash(password, deps.subtle));
    const response = await deps.fetch(`${PWNED_RANGE_URL}${prefix}`, {
      // Padding makes every answer the same size, so the size of the reply
      // can't hint at which prefix was asked for.
      headers: { "Add-Padding": "true" },
      signal: timeout.signal,
      cache: "no-store",
    });
    if (!response.ok) return UNKNOWN;
    return countInRange(await response.text(), suffix) > 0 ? { breached: true, unchecked: false } : OK;
  } catch {
    return UNKNOWN;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The same check, from a browser.
 *
 * fetch is bound to the window on purpose. A browser's fetch refuses to run
 * detached from it ("Illegal invocation"), and because this check treats any
 * failure as "couldn't check" — so nobody is ever locked out by it — passing
 * it unbound made every password look fine while appearing to work.
 */
export function checkPasswordBreachedHere(password: string): Promise<BreachCheck> {
  return checkPasswordBreached(password, {
    fetch: globalThis.fetch?.bind(globalThis),
    subtle: globalThis.crypto?.subtle,
  });
}
