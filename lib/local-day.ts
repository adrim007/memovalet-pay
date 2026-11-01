import { dateKey } from "./work-calendar";

export const LOCAL_DAY_COOKIE = "memo_local_day";

export function localDayStamp(timeZone: string, now = new Date()): string {
  return `${timeZone}|${dateKey(now, timeZone)}`;
}

export function timeZoneFromStamp(value: string | undefined): string | null {
  if (!value || value.length > 150) return null;
  try {
    const decoded = decodeURIComponent(value);
    const [zone, day, extra] = decoded.split("|");
    if (extra || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return zone || null;
  } catch {
    return null;
  }
}

/** A time zone name the runtime understands, or null. */
export function validTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/**
 * The zone Home ranks priorities in: this device's own once LocalDaySync has
 * saved it, until then the connection's (Vercel's guess from the IP address),
 * and UTC as a last resort, so the list never waits on a cookie that a first
 * visit or a cookie-blocking browser doesn't have.
 */
export function homeTimeZone(stamp: string | undefined, connectionZone: string | null | undefined): string {
  return timeZoneFromStamp(stamp) ?? validTimeZone(connectionZone) ?? "UTC";
}
