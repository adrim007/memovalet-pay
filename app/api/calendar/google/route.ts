import { NextResponse } from "next/server";
import { calendarSyncAvailable, calendarSyncUser } from "@/lib/google/calendar-sync-auth";
import { CalendarAccessError, syncAccessToken, writableCalendars } from "@/lib/google/calendar-sync-api";
import { SYNC_KINDS, type SyncKind } from "@/lib/google/calendar-sync-model";
import { syncStore } from "@/lib/google/calendar-sync-store";
import { runCalendarSync } from "@/lib/google/calendar-sync";

export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof CalendarAccessError ? error.message : "Your Google Calendar settings could not be saved or loaded. Please retry." }, { status: error instanceof CalendarAccessError ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try {
    const user = await calendarSyncUser(request);
    if (!calendarSyncAvailable()) return NextResponse.json({ available: false }, { headers });
    const store = syncStore(user.id);
    const [config, issues] = await Promise.all([store.config(), store.issues()]);
    if (new URL(request.url).searchParams.get("calendars") === "1") {
      return NextResponse.json({ available: true, config, issues, calendars: await writableCalendars(await syncAccessToken(user.id)) }, { headers });
    }
    return NextResponse.json({ available: true, config, issues }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await calendarSyncUser(request);
    if (!calendarSyncAvailable()) throw new CalendarAccessError("Direct Google Calendar sync is not available yet.", 503);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new CalendarAccessError("Choose a valid calendar action.", 400);
    const store = syncStore(user.id);
    if (body.action === "sync") {
      const result = await runCalendarSync(user.id);
      return NextResponse.json({ result }, { headers });
    }
    if (body.action === "resolve") {
      if (!SYNC_KINDS.includes(body.kind) || !/^[a-f0-9-]{36}$/i.test(body.sourceId) || !["google", "memovalet"].includes(body.use) || !body.expected || !("local" in body.expected) || !("remote" in body.expected)) throw new CalendarAccessError("Choose a valid calendar item.", 400);
      return NextResponse.json({ result: await runCalendarSync(user.id, { kind: body.kind, sourceId: body.sourceId, use: body.use, expected: body.expected }) }, { headers });
    }
    if (body.action === "pause") {
      const lease = await store.claim();
      if (!lease) throw new CalendarAccessError("A sync is running. Please retry shortly.", 409);
      await store.release(lease.token, { enabled: false });
      return NextResponse.json({ paused: true }, { headers });
    }
    if (body.action !== "configure") throw new CalendarAccessError("Choose a calendar action.", 400);
    const kinds = Array.isArray(body.kinds) ? [...new Set(body.kinds)] as SyncKind[] : [];
    if (!kinds.length || !kinds.every(kind => SYNC_KINDS.includes(kind)) || typeof body.calendarId !== "string" || typeof body.timeZone !== "string") throw new CalendarAccessError("Choose a calendar and at least one type of work.", 400);
    try { new Intl.DateTimeFormat("en", { timeZone: body.timeZone }).format(); } catch { throw new CalendarAccessError("Choose a valid time zone.", 400); }
    const calendars = await writableCalendars(await syncAccessToken(user.id));
    const calendar = calendars.find(value => value.id === body.calendarId);
    if (!calendar) throw new CalendarAccessError("Choose a calendar that you can edit.", 400);
    const existing = await store.config();
    // A destination change would leave old events behind. Keep the selected
    // destination stable until a dedicated migration flow is implemented.
    if (existing && existing.calendar_id !== calendar.id) throw new CalendarAccessError("This connection already uses another calendar. Pause it and contact support before moving its events.", 409);
    const values = { calendar_name: calendar.name, kinds, time_zone: body.timeZone, enabled: true, last_error: null };
    if (!existing) await store.create({ user_id: user.id, calendar_id: calendar.id, ...values });
    else {
      const lease = await store.claim();
      if (!lease) throw new CalendarAccessError("A sync is running. Please retry shortly.", 409);
      // Google changes made while a category was off or sync was paused were
      // never applied, so the next pass checks every linked event once.
      await store.release(lease.token, { ...values, remote_seen_at: null });
    }
    return NextResponse.json({ configured: true }, { headers });
  } catch (error) { return failure(error); }
}
