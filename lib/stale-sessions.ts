/**
 * Calls that nobody closed.
 *
 * A live session is marked over when the host presses End. People rarely do —
 * they shut the tab, the laptop sleeps, the call just stops — so 26 of the
 * first 30 sessions sat marked "live" for ever. That leaves old links half
 * alive, makes the meeting list lie about what is happening now, and keeps a
 * call's pass usable for as long as the rule in live-transcription allows.
 *
 * LiveKit knows the truth: it holds a room only while somebody is in it. So a
 * session is finished when LiveKit has no room for it and it is old enough
 * that it cannot simply be a room a moment from opening.
 */

export interface OpenSession {
  id: string;
  /** When it was set up. */
  createdAt: string;
  /** When it was booked for, if it was scheduled ahead. */
  scheduledStart?: string | null;
}

/** A room that has just been made, with nobody in it yet, is not abandoned. */
export const SETTLING_MS = 15 * 60 * 1000;

/** Nobody is in a meeting this long after it was set up. */
export const LONGEST_CALL_MS = 12 * 60 * 60 * 1000;

export function finishedSessions(state: {
  open: OpenSession[];
  /** Room names LiveKit currently holds — a room exists only while occupied. */
  liveRooms: Set<string> | string[];
  now: number;
}): string[] {
  const live = state.liveRooms instanceof Set ? state.liveRooms : new Set(state.liveRooms);
  return state.open
    .filter((session) => {
      if (live.has(session.id)) return false;
      const times = [session.createdAt, session.scheduledStart]
        .map((value) => (value ? Date.parse(value) : NaN))
        .filter(Number.isFinite);
      // Nothing to date it by: only close it once it is clearly not today's.
      if (!times.length) return false;
      const started = Math.max(...times);
      return state.now - started >= SETTLING_MS;
    })
    .map((session) => session.id);
}

/**
 * When LiveKit itself can't be reached, only calls too old to be real are
 * closed — a service hiccup must never end a meeting that is happening.
 */
export function longAbandonedSessions(state: { open: OpenSession[]; now: number }): string[] {
  return state.open
    .filter((session) => {
      const started = Date.parse(session.scheduledStart || session.createdAt);
      return Number.isFinite(started) && state.now - started >= LONGEST_CALL_MS;
    })
    .map((session) => session.id);
}
