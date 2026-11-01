import { calendarFeedFor } from "@/lib/calendar-feed-data";

// The calendar link itself: what Google Calendar, Apple Calendar or Outlook
// fetch, signed out, every so often. The secret in the address is the key.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = new URL(request.url).origin;
  try {
    const calendar = await calendarFeedFor(token.replace(/\.ics$/, ""), site);
    if (!calendar) return new Response("This calendar link isn't in use. Make a new one on the Calendar page in MemoValet.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    return new Response(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="memovalet.ics"',
        // Private to whoever holds the link; never stored by a shared cache.
        "Cache-Control": "private, max-age=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("Calendar link failed", error);
    // A failure keeps the calendar app's last copy, rather than emptying it.
    return new Response("The calendar couldn't be loaded just now.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store" } });
  }
}
