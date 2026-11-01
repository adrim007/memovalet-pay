/**
 * Which cameras a browser actually takes in, once a call gets big.
 *
 * Every person in a call publishes video, and by default every other browser
 * subscribes to all of it. Six people is nothing. Fifty is fifty video streams
 * arriving at once, decoded in parallel, on a laptop that also has the call
 * page, the captions and whatever else open — the fans spin up, frames drop,
 * and eventually tiles go black. The call falls over on the receiving side long
 * before the server minds.
 *
 * So above a dozen people, a browser takes in only the cameras it is actually
 * showing — the tiles on screen and whoever is speaking. Everyone else is still
 * *heard*: audio is small, and a meeting where you cannot hear someone is
 * broken in a way a meeting where you cannot see them is not. Their tile is one
 * tap away, and swapping them in subscribes them.
 *
 * Below that size nothing changes: small calls keep taking everything, which is
 * what has always worked.
 */

/** Cameras one browser keeps up with comfortably. Matches the tiles on screen. */
export const VIDEO_LIMIT = 9;

/** Above this many people, start choosing. */
export const LARGE_CALL = 12;

export function isLargeCall(peopleInCall: number, largeCall = LARGE_CALL): boolean {
  return peopleInCall > largeCall;
}

/**
 * Whose camera this browser should be subscribed to, or null when the call is
 * small enough to simply take everything.
 *
 * Order matters: whoever is speaking is never dropped, then the tiles in the
 * order the room shows them.
 */
export function camerasToTakeIn(state: {
  /** Everyone else in the call, in the order the room lists them. */
  others: string[];
  /** Whoever is speaking, if anyone. */
  activeSpeaker?: string | null;
  /** People in the call including yourself, which is what "big" is measured on. */
  peopleInCall: number;
  limit?: number;
  largeCall?: number;
}): Set<string> | null {
  if (!isLargeCall(state.peopleInCall, state.largeCall)) return null;
  const limit = state.limit ?? VIDEO_LIMIT;
  const wanted = new Set<string>();
  if (state.activeSpeaker && state.others.includes(state.activeSpeaker)) {
    wanted.add(state.activeSpeaker);
  }
  for (const identity of state.others) {
    if (wanted.size >= limit) break;
    wanted.add(identity);
  }
  return wanted;
}
