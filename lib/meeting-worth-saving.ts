/**
 * Whether a finished call should leave a meeting behind.
 *
 * It used to need a transcript or a recording, and nothing else counted. That
 * sounds reasonable until you see what it did in practice: captions were never
 * running on the call page, recording is off by default, and so twelve real
 * calls in a row ended with nothing saved at all. No meeting means no summary,
 * no PDF, nothing to email and nothing to send anyone — every one of those
 * features looked broken when the truth was that the meeting never existed.
 *
 * A call that ran for a while is a fact worth keeping even if nobody's words
 * were captured: who was there, when, and how long. An empty room opened and
 * closed in a few seconds is not.
 */

/** Below this, a call is a misclick rather than a meeting. */
export const MIN_REAL_CALL_SECONDS = 60;

/** How long a call has been open, in seconds. Null start means not joined yet. */
export function secondsSince(startedAtMs: number | null | undefined, now = Date.now()): number {
  if (!startedAtMs) return 0;
  return Math.max(0, Math.floor((now - startedAtMs) / 1000));
}

export function isWorthSaving(call: {
  /** Anything said, written in shared notes, or recorded. */
  hasContent: boolean;
  /** How long the call had been open when it ended. */
  elapsedSeconds: number;
}): boolean {
  if (call.hasContent) return true;
  return call.elapsedSeconds >= MIN_REAL_CALL_SECONDS;
}

/**
 * What to tell someone whose call left nothing behind, instead of the old
 * "You are disconnected from the call", which let them think it had been saved.
 */
export function nothingSavedReason(call: { elapsedSeconds: number }): string {
  if (call.elapsedSeconds < MIN_REAL_CALL_SECONDS) {
    return "That call was too short to keep, so nothing was saved.";
  }
  return "Nothing was saved: the call had no captions, notes or recording to keep.";
}
