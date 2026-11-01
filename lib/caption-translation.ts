/**
 * Whether a line of live speech has to be translated for the person reading it.
 *
 * Who said it makes no difference. Your own words used to be skipped, on the
 * reasoning that you know what you just said — but the panel is set to a
 * language, and someone reading it (or showing it to the person across the
 * table) expects to see that language, not half a conversation in English.
 * Alone in a call it looked like translation was broken altogether.
 */
export function needsTranslation(state: {
  enabled: boolean;
  /** The language it was spoken in, as the caption labels it. */
  spokenLanguage: string;
  /** The language the panel is set to. */
  readingLanguage: string;
}): boolean {
  if (!state.enabled) return false;
  const spoken = state.spokenLanguage.trim().toLowerCase();
  const reading = state.readingLanguage.trim().toLowerCase();
  if (!spoken || !reading) return false;
  return spoken !== reading;
}

/**
 * Whether a half-finished sentence is worth translating again yet.
 *
 * While someone talks, their words arrive a few at a time. Translating every
 * update would be a request a second per speaker and would make the panel
 * twitch; translating only when they stop means nothing appears for as long as
 * they keep going. So: often enough to feel live, but only when enough has
 * actually been said since last time.
 */
export function interimTranslationDue(state: {
  text: string;
  /** What was last sent for translation. */
  lastSentText: string;
  lastSentAt: number;
  now: number;
  minGapMs?: number;
  minNewCharacters?: number;
}): boolean {
  const { text, lastSentText, lastSentAt, now, minGapMs = 1500, minNewCharacters = 12 } = state;
  const said = text.trim();
  if (!said) return false;
  if (said === lastSentText.trim()) return false;
  if (now - lastSentAt < minGapMs) return false;
  if (!lastSentText) return true;
  // Reworded rather than extended — the words themselves changed, so the old
  // translation is now wrong and a fresh one is worth it.
  if (!said.startsWith(lastSentText.trim())) return true;
  return said.length - lastSentText.trim().length >= minNewCharacters;
}
