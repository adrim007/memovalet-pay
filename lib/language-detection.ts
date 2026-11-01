/**
 * When to work out the language someone is speaking, and when to act on it.
 *
 * Detection is not a setting anyone turns on: it happens by itself. The
 * browser's own speech recognition has to be told a language and hears nothing
 * else, so one short sample of real speech is sent to MemoValet's transcription
 * at the start of a call, and captions carry on in whatever was actually
 * spoken. Picking a language by hand stops all of this — from then on it is
 * their choice, not our guess.
 */

/** Below this, a sample is a word or two: not enough to tell languages apart. */
export const MIN_SAMPLE_MS = 1500;

export function shouldDetectLanguage(state: {
  /** Someone chose their language by hand. */
  pinned: boolean;
  alreadyDetected: boolean;
  /** How much of the sample was voice rather than pause. */
  voicedMs: number;
  /** The call's pass, without which nothing can be sent. */
  hasToken: boolean;
  minVoicedMs?: number;
}): boolean {
  if (state.pinned || state.alreadyDetected || !state.hasToken) return false;
  return state.voicedMs >= (state.minVoicedMs ?? MIN_SAMPLE_MS);
}

/**
 * The language to switch captions to, or null to leave them alone: unknown
 * languages, a language already in use, and anyone who set theirs by hand.
 */
export function languageToSwitchTo(state: {
  detected: string | null;
  current: string;
  pinned: boolean;
}): string | null {
  if (state.pinned || !state.detected || state.detected === state.current) return null;
  return state.detected;
}
