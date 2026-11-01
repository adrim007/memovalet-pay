/**
 * The call's pass — the LiveKit token that lets someone into a room — is also
 * what captions and translation show with every line. It lasts four hours, so
 * without a fresh one a long meeting would lose captions and translation
 * part-way through while the video carried on.
 */

/** Renew once the pass has less than this left. */
export const RENEW_WITHIN_MS = 45 * 60 * 1000;

/** When the pass runs out, in milliseconds; null when it can't be read. */
export function passExpiresAt(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const { exp } = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Time to ask for a fresh pass. An unreadable one is left alone. */
export function passNeedsRenewing(token: string | null, now: number): boolean {
  if (!token) return false;
  const expires = passExpiresAt(token);
  return expires !== null && expires - now <= RENEW_WITHIN_MS;
}
