"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getManualEventsServerSnapshot,
  getManualEventsSnapshot,
  subscribeManualEvents,
} from "@/lib/manualMeetings";
import { UpcomingCalendarEvent } from "@/lib/types";
import JoinCallLink from "@/components/JoinCallLink";

// This hits Google's Calendar API (a real round trip to Google's servers,
// not our own backend), so cache the result across navigations within the
// session instead of re-fetching it fresh on every single visit to Home.
const CACHE_TTL_MS = 3 * 60 * 1000;
let cache: { events: UpcomingCalendarEvent[]; fetchedAt: number } | null = null;
let inFlight: Promise<UpcomingCalendarEvent[]> | null = null;

function fetchUpcomingEvents(): Promise<UpcomingCalendarEvent[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cache.events);
  }
  if (inFlight) return inFlight;

  inFlight = fetch("/api/calendar/upcoming")
    .then((response) => response.json())
    .then((data) => {
      if (!data.events) throw new Error("Couldn't load your calendar.");
      cache = { events: data.events, fetchedAt: Date.now() };
      return data.events as UpcomingCalendarEvent[];
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function mergeEvents(
  calendar: UpcomingCalendarEvent[],
  manual: UpcomingCalendarEvent[]
): UpcomingCalendarEvent[] {
  return [...calendar, ...manual].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

function formatEventTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface UpcomingMeetingsProps {
  onSelect: (event: UpcomingCalendarEvent) => void;
  onEventsChange?: (events: UpcomingCalendarEvent[]) => void;
  selectedId?: string | null;
}

export default function UpcomingMeetings({
  onSelect,
  onEventsChange,
  selectedId,
}: UpcomingMeetingsProps) {
  const [calendarEvents, setCalendarEvents] = useState<UpcomingCalendarEvent[]>([]);
  const manualEvents = useSyncExternalStore(
    subscribeManualEvents,
    getManualEventsSnapshot,
    getManualEventsServerSnapshot
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchUpcomingEvents()
      .then((events) => {
        if (!cancelled) setCalendarEvents(events);
      })
      .catch(() => {
        if (!cancelled) setCalendarEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const events = mergeEvents(calendarEvents, manualEvents);

  useEffect(() => {
    onEventsChange?.(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEvents, manualEvents]);

  if (events.length === 0 && loading) {
    return null;
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="surface-card rounded-2xl p-6 shadow-xl shadow-indigo-500/5">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
        Coming Up
      </h2>

      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id}>
          <button
            type="button"
            onClick={() => onSelect(event)}
            className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition ${
              selectedId === event.id
                ? "border-indigo-400/60 bg-indigo-400/10"
                : "border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium flex items-center gap-1.5">
                {event.title}
                {event.source === "manual" && (
                  <span className="text-[10px] font-normal text-[var(--muted)] rounded-full border border-[var(--surface-border)] px-1.5 py-0.5">
                    manual
                  </span>
                )}
                {event.source === "email" && (
                  <span className="text-[10px] font-normal text-[var(--muted)] rounded-full border border-[var(--surface-border)] px-1.5 py-0.5">
                    from email
                  </span>
                )}
              </span>
              <span className="text-xs text-[var(--muted)] shrink-0">
                {formatEventTime(event.start)}
              </span>
            </div>
            {event.attendees.length > 0 && (
              <p className="text-xs text-[var(--muted)] mt-1">
                {event.attendees.map((a) => a.name).join(", ")}
              </p>
            )}
          </button>
          <JoinCallLink event={event} className="mt-1 ml-3.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
