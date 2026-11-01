import { generateAIText } from "@/lib/ai/provider";
import { getStoredGoogleRefreshToken, exchangeForAccessToken } from "./tokens";
import { UpcomingCalendarEvent } from "@/lib/types";
import { MEETING_LINK_SEARCH_TERMS, findMeetingLink } from "@/lib/meetingLinks";

interface GmailMessageListItem {
  id: string;
}

interface GmailMessageMeta {
  id: string;
  snippet?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

function getHeader(message: GmailMessageMeta, name: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

// Only looks at recent inbox mail that mentions a video meeting link — Meet,
// Zoom, or Teams — so this stays cheap: most inboxes have zero or a handful of
// matches, and we only spend an AI call at all when there's something to extract.
export async function scanGmailForMeetings(userId: string): Promise<UpcomingCalendarEvent[]> {
  const refreshToken = await getStoredGoogleRefreshToken(userId);
  if (!refreshToken) return [];

  const accessToken = await exchangeForAccessToken(refreshToken, userId);
  const headers = { Authorization: "Bearer " + accessToken };

  const listParams = new URLSearchParams({
    q: "(" + MEETING_LINK_SEARCH_TERMS.join(" OR ") + ") newer_than:14d in:inbox -in:spam -in:trash",
    maxResults: "10",
  });

  const listResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?" + listParams.toString(),
    { headers }
  );
  const listData = await listResponse.json();
  if (!listResponse.ok) return [];

  const items: GmailMessageListItem[] = listData.messages || [];
  if (items.length === 0) return [];

  const messages = await Promise.all(
    items.map(async (item) => {
      const params = new URLSearchParams({
        format: "metadata",
        metadataHeaders: "Subject",
      });
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
          item.id +
          "?" +
          params.toString(),
        { headers }
      );
      if (!response.ok) return null;
      return (await response.json()) as GmailMessageMeta;
    })
  );

  const candidates = messages
    .filter((m): m is GmailMessageMeta => !!m)
    .map((m) => {
      const link = findMeetingLink(m.snippet || "");
      return {
        id: m.id,
        subject: getHeader(m, "Subject"),
        snippet: m.snippet || "",
        meetLink: link ? link.url : "",
        provider: link ? link.provider : undefined,
      };
    })
    .filter((c) => c.meetLink);

  if (candidates.length === 0) return [];

  const prompt =
    "Today is " +
    new Date().toISOString() +
    ". Below are short email previews that mention a video meeting link. " +
    "For each one, decide if it's clearly describing a SPECIFIC upcoming meeting with a " +
    "discoverable date and time (e.g. \"let's meet Thursday at 3pm\"). Resolve relative dates " +
    "against today's date. Skip anything vague, already in the past, or with no clear time. " +
    'Return JSON only: { "meetings": [{ "id": string, "title": string, "start": string (ISO 8601) }] }, ' +
    "omitting any email that doesn't qualify.\n\n" +
    candidates
      .map((c) => `id: ${c.id}\nsubject: ${c.subject}\npreview: ${c.snippet}`)
      .join("\n\n");

  const rawText = await generateAIText({
    prompt,
    maxTokens: 1000,
    json: true,
  });
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: { meetings?: { id: string; title: string; start: string }[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const candidatesById = new Map(candidates.map((c) => [c.id, c]));

  return (parsed.meetings || [])
    .filter((m) => candidatesById.has(m.id) && !Number.isNaN(new Date(m.start).getTime()))
    .map((m) => ({
      id: "email-" + m.id,
      title: m.title || "Meeting",
      start: m.start,
      end: null,
      meetLink: candidatesById.get(m.id)!.meetLink,
      provider: candidatesById.get(m.id)!.provider,
      attendees: [],
      source: "email" as const,
    }));
}
