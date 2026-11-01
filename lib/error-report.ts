/**
 * What gets kept when something breaks in front of somebody.
 *
 * Deliberately little: the message, the page it happened on, which build, and
 * a rough browser. No full URLs (they carry ids and search terms), no user
 * agent strings, no stack traces from the browser — a stack from a minified
 * bundle says nothing useful anyway, and it is the one place personal data
 * tends to leak into a log.
 */

export const MAX_MESSAGE = 300;
export const MAX_PLACE = 120;

export interface ReportedError {
  source: "client" | "server";
  message: string;
  place: string | null;
  release: string | null;
  browser: string | null;
}

/** Noise that says nothing and would drown the digest. */
const IGNORED = [
  "resizeobserver loop",            // a browser quirk, harmless and constant
  "script error",                   // a cross-origin script, with no detail to act on
  "load failed",                    // a tab closing mid-request
  "networkerror when attempting",   // the same, in Firefox's words
  "the operation was aborted",      // our own cancelled requests
  "abort",
];

export function worthKeeping(message: string): boolean {
  const said = message.trim().toLowerCase();
  if (said.length < 3) return false;
  return !IGNORED.some((noise) => said.includes(noise));
}

/** A page path, with anything identifying trimmed off. */
export function placeOf(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const path = new URL(url, "https://memovalet.com").pathname;
    // Ids in a path say who or what, which is not ours to keep.
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
      .slice(0, MAX_PLACE);
  } catch {
    return null;
  }
}

/** "Safari", "Chrome", "Firefox" — enough for "only on one browser". */
export function browserOf(userAgent: unknown): string | null {
  if (typeof userAgent !== "string") return null;
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return null;
}

export function reportedError(input: unknown, context: { userAgent?: unknown; source?: "client" | "server" } = {}): ReportedError | null {
  const value = (input ?? {}) as { message?: unknown; place?: unknown; url?: unknown; release?: unknown };
  const message = typeof value.message === "string" ? value.message.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE) : "";
  if (!message || !worthKeeping(message)) return null;
  return {
    source: context.source ?? "client",
    message,
    place: placeOf(value.place ?? value.url),
    release: typeof value.release === "string" ? value.release.slice(0, 60) : null,
    browser: browserOf(context.userAgent),
  };
}

/** Errors grouped for the digest: the same fault fifty times is one line. */
export function groupedForDigest(
  errors: Array<{ message: string; place: string | null; browser: string | null; created_at: string }>
): Array<{ message: string; place: string | null; browsers: string[]; count: number; last: string }> {
  const groups = new Map<string, { message: string; place: string | null; browsers: Set<string>; count: number; last: string }>();
  for (const error of errors) {
    const key = `${error.message}|${error.place ?? ""}`;
    const group = groups.get(key) ?? { message: error.message, place: error.place, browsers: new Set<string>(), count: 0, last: error.created_at };
    group.count += 1;
    if (error.browser) group.browsers.add(error.browser);
    if (error.created_at > group.last) group.last = error.created_at;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, browsers: [...group.browsers].sort() }))
    .sort((a, b) => b.count - a.count);
}
