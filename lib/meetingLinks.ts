import { MeetingProvider } from "@/lib/types";

// A Meet link always arrives in its own Calendar field, but Zoom and Teams
// calls are usually just a link pasted into the invite, so we match on the
// shapes those links actually take.
const PROVIDER_PATTERNS: { provider: MeetingProvider; pattern: RegExp }[] = [
  { provider: "google-meet", pattern: /https:\/\/meet\.google\.com\/[a-z0-9-]+/i },
  { provider: "zoom", pattern: /https:\/\/(?:[a-z0-9-]+\.)*(?:zoom\.us|zoomgov\.com)\/(?:j|w|s|my)\/[^\s"'<>]+/i },
  { provider: "teams", pattern: /https:\/\/teams\.(?:microsoft|live)\.com\/[^\s"'<>]+/i },
];

// The terms Gmail is searched for. Kept next to the patterns above so a new
// provider can't be findable in a calendar invite but invisible in email.
export const MEETING_LINK_SEARCH_TERMS = [
  "meet.google.com",
  "zoom.us",
  "zoomgov.com",
  "teams.microsoft.com",
];

export const MEETING_PROVIDER_LABELS: Record<MeetingProvider, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  teams: "Teams",
};

export function detectMeetingProvider(url: string): MeetingProvider | null {
  const match = PROVIDER_PATTERNS.find((entry) => entry.pattern.test(url));
  return match ? match.provider : null;
}

// Returns the first meeting link found anywhere in a block of text, along with
// which service it belongs to.
export function findMeetingLink(text: string): { url: string; provider: MeetingProvider } | null {
  if (!text) return null;
  for (const { provider, pattern } of PROVIDER_PATTERNS) {
    const found = text.match(pattern);
    if (found) return { url: found[0], provider };
  }
  return null;
}
