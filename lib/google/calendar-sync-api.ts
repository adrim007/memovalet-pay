import { getStoredGoogleRefreshTokenService } from "@/lib/google/tokens";
import type { GoogleEvent } from "./calendar-sync-model";

export class CalendarAccessError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
export async function syncAccessToken(userId: string) {
  const token = await getStoredGoogleRefreshTokenService(userId);
  if (!token) throw new CalendarAccessError("Connect Google Calendar to continue.", 409);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: token, grant_type: "refresh_token" }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new CalendarAccessError(response.status >= 500 ? "Google is unavailable. Please retry shortly." : "Reconnect Google Calendar to restore access.", response.status >= 500 ? 503 : 409);
  const scopes: string[] = typeof data.scope === "string" ? data.scope.split(" ") : [];
  if (!scopes.includes("https://www.googleapis.com/auth/calendar") && !CALENDAR_SCOPES.every(scope => scopes.includes(scope))) {
    throw new CalendarAccessError("Reconnect Google Calendar and allow calendar updates.", 409);
  }
  return String(data.access_token);
}

export async function googleRequest(token: string, path: string, options: { method?: string; body?: unknown; etag?: string } = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    method: options.method || "GET", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.etag ? { "If-Match": options.etag } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) {
    if (response.status === 409 || response.status === 412) throw new CalendarAccessError("This calendar event changed while syncing. Please retry.", response.status);
    if (response.status === 401 || response.status === 403) throw new CalendarAccessError("Google denied access. Reconnect Google Calendar and check the selected calendar permissions.", 409);
    throw new CalendarAccessError(response.status === 429 ? "Google is busy. Sync will retry later." : "Google Calendar could not be reached. Sync will retry later.", 503);
  }
  return response.status === 204 ? {} : response.json();
}

export type WritableCalendar = { id: string; name: string; timeZone: string };
export async function writableCalendars(token: string): Promise<WritableCalendar[]> {
  const calendars: WritableCalendar[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ minAccessRole: "writer", maxResults: "250", ...(pageToken ? { pageToken } : {}) });
    const data = await googleRequest(token, `users/me/calendarList?${query}`);
    if (!data) throw new CalendarAccessError("Your calendar list could not be loaded.");
    for (const item of data.items || []) if (item.id && ["owner", "writer"].includes(item.accessRole)) calendars.push({ id: item.id, name: item.summaryOverride || item.summary || "Google Calendar", timeZone: item.timeZone || "UTC" });
    pageToken = data.nextPageToken || "";
    if (calendars.length > 2000) throw new CalendarAccessError("Too many calendars were returned. Please contact support.");
  } while (pageToken);
  return calendars;
}

export function eventPath(calendarId: string, eventId?: string) {
  return `calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ""}`;
}
export async function readGoogleEvent(token: string, calendarId: string, eventId: string): Promise<GoogleEvent | null> {
  return googleRequest(token, eventPath(calendarId, eventId));
}
/**
 * IDs of events in this calendar edited or deleted since `since` (Google
 * includes deletions whenever updatedMin is set). Null when Google can't say,
 * because the moment is older than it keeps deletions for or too much changed,
 * and every linked event has to be checked instead.
 */
export async function changedEventIds(token: string, calendarId: string, since: string): Promise<Set<string> | null> {
  const ids = new Set<string>();
  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const query = new URLSearchParams({ updatedMin: since, showDeleted: "true", maxResults: "2500", fields: "items(id),nextPageToken", ...(pageToken ? { pageToken } : {}) });
    const data = await googleRequest(token, `${eventPath(calendarId)}?${query}`);
    if (!data) return null;
    for (const item of data.items || []) if (typeof item.id === "string") ids.add(item.id);
    pageToken = data.nextPageToken || "";
    if (!pageToken) return ids;
  }
  return null;
}
