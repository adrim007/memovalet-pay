/**
 * Whether a call still takes speech to write down.
 *
 * While it runs, of course. And for a short while after it is ended: ending
 * marks the call over at once, while the last sentence anyone said is still on
 * its way to be transcribed — without this, the end of every meeting was cut
 * off the transcript.
 */
export const LAST_WORDS_GRACE_MS = 2 * 60 * 1000;

/**
 * A call left open because nobody pressed End stays "active" for good. No real
 * meeting runs this long, so its link can't be used to keep transcribing on
 * MemoValet's account for ever after.
 */
export const LONGEST_CALL_MS = 12 * 60 * 60 * 1000;

export function takesSpeech(
  session: { status: string; endedAt?: string | null; createdAt?: string | null; scheduledStart?: string | null },
  now: number
): boolean {
  if (session.status === "active") {
    // From when it was set up, or when it was booked for if that is later.
    const starts = [session.createdAt, session.scheduledStart]
      .map((value) => (value ? Date.parse(value) : NaN))
      .filter(Number.isFinite);
    if (!starts.length) return true;
    return now - Math.max(...starts) <= LONGEST_CALL_MS;
  }
  if (session.status !== "ended" || !session.endedAt) return false;
  const ended = Date.parse(session.endedAt);
  return Number.isFinite(ended) && now - ended >= 0 && now - ended <= LAST_WORDS_GRACE_MS;
}
