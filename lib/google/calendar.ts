import { getStoredGoogleRefreshToken, exchangeForAccessToken } from "./tokens";
import { MeetingProvider, UpcomingCalendarEvent } from "@/lib/types";
import { detectMeetingProvider, findMeetingLink } from "@/lib/meetingLinks";

interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  hangoutLink?: string;
  location?: string;
  description?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { displayName?: string; email?: string; responseStatus?: string }[];
}

// Google puts a Meet link in its own field, but a Zoom or Teams call reaches
// the calendar as conference data added by an add-on, or simply as a link in
// the location or the invite body. Check each in turn so those meetings are
// found too, rather than dropped for not being Meet.
function meetingLinkFor(
  event: GoogleCalendarEventItem
): { url: string; provider: MeetingProvider } | null {
  if (event.hangoutLink) {
    return { url: event.hangoutLink, provider: "google-meet" };
  }

  const entryPoints = event.conferenceData?.entryPoints || [];
  for (const entry of entryPoints) {
    if (entry.entryPointType !== "video" || !entry.uri) continue;
    const provider = detectMeetingProvider(entry.uri);
    if (provider) return { url: entry.uri, provider };
  }

  return findMeetingLink(event.location || "") || findMeetingLink(event.description || "");
}

export async function getUpcomingMeetingEvents(userId: string): Promise<UpcomingCalendarEvent[]> {
  const refreshToken = await getStoredGoogleRefreshToken(userId);
  if (!refreshToken) return [];

  const accessToken = await exchangeForAccessToken(refreshToken, userId);

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + params.toString(),
    { headers: { Authorization: "Bearer " + accessToken } }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Failed to fetch calendar events: " + JSON.stringify(data));
  }

  const items: GoogleCalendarEventItem[] = data.items || [];

  return items.flatMap(function (event) {
    const link = meetingLinkFor(event);
    if (!link) return [];

    return [
      {
        id: event.id,
        title: event.summary || "Untitled meeting",
        start: (event.start && (event.start.dateTime || event.start.date)) || "",
        end: (event.end && (event.end.dateTime || event.end.date)) || null,
        meetLink: link.url,
        provider: link.provider,
        source: "calendar" as const,
        attendees: (event.attendees || [])
          .filter(function (a) {
            return !!a.email;
          })
          .map(function (a) {
            return {
              name: a.displayName || a.email || "",
              email: a.email || "",
              accepted: a.responseStatus === "accepted",
            };
          }),
      },
    ];
  });
}
