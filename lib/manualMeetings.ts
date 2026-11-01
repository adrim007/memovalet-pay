import { UpcomingCalendarEvent } from "./types";

// Manually-scheduled meetings live in localStorage, which doesn't exist during
// SSR. A module-level store (mirroring the calendar fetch cache in
// UpcomingMeetings) lets any component read it lazily on the client via
// useSyncExternalStore, keeping server and first client render in sync
// instead of racing a useEffect + setState on mount.
const MANUAL_MEETINGS_KEY = "mf-manual-meetings";
const EMPTY_MANUAL_EVENTS: UpcomingCalendarEvent[] = [];
let manualEventsCache: UpcomingCalendarEvent[] | null = null;
let manualListeners: (() => void)[] = [];

function readManualMeetingsFromStorage(): UpcomingCalendarEvent[] {
  try {
    const raw = localStorage.getItem(MANUAL_MEETINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UpcomingCalendarEvent[];
    // Drop meetings that ended more than a day ago so the list doesn't grow forever.
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter((m) => new Date(m.end || m.start).getTime() > cutoff);
  } catch {
    return [];
  }
}

export function getManualEventsSnapshot(): UpcomingCalendarEvent[] {
  if (manualEventsCache === null) {
    manualEventsCache = readManualMeetingsFromStorage();
  }
  return manualEventsCache;
}

export function getManualEventsServerSnapshot(): UpcomingCalendarEvent[] {
  return EMPTY_MANUAL_EVENTS;
}

export function subscribeManualEvents(callback: () => void) {
  manualListeners.push(callback);
  return () => {
    manualListeners = manualListeners.filter((l) => l !== callback);
  };
}

export function addManualMeeting(meeting: UpcomingCalendarEvent) {
  manualEventsCache = [...getManualEventsSnapshot(), meeting];
  try {
    localStorage.setItem(MANUAL_MEETINGS_KEY, JSON.stringify(manualEventsCache));
  } catch {
    // storage unavailable, manual meetings just won't persist across reloads
  }
  manualListeners.forEach((l) => l());
}
