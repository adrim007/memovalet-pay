/**
 * Who belongs in the big tile.
 *
 * LiveKit reports who is making noise, loudest first, and it changes constantly:
 * a cough, a "mhm", someone knocking a desk. Following that directly would make
 * the main tile flip every second, so this holds the current speaker for a beat
 * before handing over, keeps the last speaker on screen once the room goes
 * quiet, and never switches to you — in a call you want to see the other person,
 * not yourself.
 */

export type ActiveSpeaker = {
  /** Whose tile is currently big, or null before anyone has spoken. */
  id: string | null;
  /** When they took it, so a newcomer has to wait their turn. */
  since: number;
};

export const SPEAKER_HOLD_MS = 1500;

export const NO_SPEAKER: ActiveSpeaker = { id: null, since: 0 };

export function nextActiveSpeaker(
  current: ActiveSpeaker,
  /** Identities currently making noise, loudest first. */
  speaking: string[],
  options: { selfId?: string; now: number; holdMs?: number }
): ActiveSpeaker {
  const { selfId, now, holdMs = SPEAKER_HOLD_MS } = options;

  const candidate = speaking.find((id) => id && id !== selfId);
  // Quiet room, or only you talking: whoever was last on screen stays there.
  if (!candidate) return current;
  if (candidate === current.id) return current;

  // The first person to speak takes the tile immediately; after that, the
  // current speaker keeps it until they have held it for a moment.
  if (current.id && now - current.since < holdMs) return current;

  return { id: candidate, since: now };
}
