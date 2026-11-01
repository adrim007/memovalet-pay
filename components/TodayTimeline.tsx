"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MeetingProvider, UpcomingCalendarEvent } from "@/lib/types";
import { MEETING_PROVIDER_LABELS } from "@/lib/meetingLinks";
import JoinCallLink from "@/components/JoinCallLink";

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// The dot says, in colour, where the meeting is: each service keeps its own
// colour so a glance down the timeline shows what you are about to walk into.
const PROVIDER_DOT: Record<MeetingProvider, string> = {
  "google-meet": "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.22)]",
  zoom: "bg-sky-500 shadow-[0_0_0_2px_rgba(14,165,233,0.22)]",
  teams: "bg-violet-500 shadow-[0_0_0_2px_rgba(139,92,246,0.22)]",
};

// Nothing to join — an in-person entry stays quiet rather than competing.
const IN_PERSON_DOT = "bg-slate-400 shadow-[0_0_0_2px_rgba(148,163,184,0.22)]";

function eventDetail(event: UpcomingCalendarEvent) {
  const start = new Date(event.start).getTime();
  const end = event.end ? new Date(event.end).getTime() : 0;
  const duration = end > start ? `${Math.round((end - start) / 60000)}m` : null;
  const location = event.provider
    ? MEETING_PROVIDER_LABELS[event.provider]
    : event.meetLink
      ? "Online"
      : event.source === "manual"
        ? "Manual"
        : "Calendar";
  return [duration, location].filter(Boolean).join(" · ");
}

export default function TodayTimeline({ eventsOverride, calendarHref }: { eventsOverride?: UpcomingCalendarEvent[]; calendarHref?: string }) {
  const [events, setEvents] = useState<UpcomingCalendarEvent[]>(eventsOverride || []);
  const [loading, setLoading] = useState(!eventsOverride);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const visibleEvents = eventsOverride ?? events;

  useEffect(() => {
    if (eventsOverride) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const request: Promise<UpcomingCalendarEvent[]> = fetch("/api/calendar/upcoming", { signal: controller.signal, cache: "no-store" })
          .then((response) => { if (!response.ok) throw new Error("Schedule unavailable"); return response.json(); })
          .then((data) => {
            const next = Array.isArray(data.events) ? data.events : [];
            if (!cancelled && data.incomplete) setError("Some meetings could not be loaded.");
            return next;
          });

    request
      .then((next) => {
        if (!cancelled) {
          setEvents(
            next
              .filter((event: UpcomingCalendarEvent) => isToday(event.start))
              .sort(
                (a: UpcomingCalendarEvent, b: UpcomingCalendarEvent) =>
                  new Date(a.start).getTime() - new Date(b.start).getTime()
              )
              .slice(0, 4)
          );
        }
      })
      .catch(() => {
        if (!cancelled) { setEvents([]); setError("Unable to load your schedule."); }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [eventsOverride, retry]);

  return (
    <section aria-labelledby="today-heading">
      <h2 id="today-heading" className="text-lg font-semibold">
        Today&apos;s schedule
      </h2>
      {error && <div role="alert" className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm"><p>{error}</p><button type="button" className="mt-2 min-h-10 font-semibold underline" onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }}>Try again</button></div>}

      {loading ? (
        <div className="mt-5 space-y-5" aria-label="Loading today's meetings">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex gap-3 animate-pulse">
              <span className="mt-1 h-3 w-3 rounded-full bg-indigo-400/30" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-indigo-400/15" />
                <div className="h-4 w-32 rounded bg-indigo-400/10" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleEvents.length > 0 ? (
        <ol className="relative mt-4 space-y-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--surface-border)]">
          {visibleEvents.map((event) => (
            <li key={event.id} className="relative flex gap-4">
              <span
                className={`relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--surface)] ${
                  event.provider ? PROVIDER_DOT[event.provider] : IN_PERSON_DOT
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {formatTime(event.start)}
                </p>
                <p className="min-w-0 break-words text-sm font-semibold">{event.title}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{eventDetail(event)}</p>
                <JoinCallLink event={event} className="mt-1.5" />
              </div>
            </li>
          ))}
        </ol>
      ) : !error ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--surface-border)] p-5">
          <p className="text-sm font-semibold">No meetings to show</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            No meetings are booked for today.
          </p>
        </div>
      ) : null}

      <Link
        href={calendarHref ?? (eventsOverride ? "/preview/calendar" : "/calendar")}
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:gap-3 dark:text-indigo-400"
      >
        Open work calendar <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
