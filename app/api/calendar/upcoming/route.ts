import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingMeetingEvents } from "@/lib/google/calendar";
import { scanGmailForMeetings } from "@/lib/google/gmailScan";
import { getUpcomingMemoValetSessions } from "@/lib/upcoming-sessions";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Connected Calendar is authoritative for imported events; Gmail adds
    // meetings coordinated over email that never became a calendar event.
    // Each is independent, so one failing (e.g. missing Gmail scope on an
    // older connection) shouldn't take down the other.
    const results = await Promise.allSettled([
      getUpcomingMeetingEvents(user.id).then(events => ({ events, incomplete: false })),
      scanGmailForMeetings(user.id).then(events => ({ events, incomplete: false })),
      getUpcomingMemoValetSessions(supabase, user.id),
    ]);

    const events = results.flatMap((result) => result.status === "fulfilled" ? result.value.events : [])
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const incomplete = results.some((result) => result.status === "rejected" || result.value.incomplete);
    for (const result of results) if (result.status === "rejected") console.error("Schedule source failed", result.reason);
    return NextResponse.json({ events, incomplete }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load calendar events" }, { status: 500 });
  }
}
