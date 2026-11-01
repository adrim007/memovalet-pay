"use client";

import { getMeetingStatus, MeetingStatus } from "@/lib/meetingStatus";
import { UpcomingCalendarEvent } from "@/lib/types";

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (totalMinutes < 1) return "less than a minute";
  return `${minutes}m`;
}

function formatClockTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface MeetingStatusHeaderProps {
  selectedEvent: UpcomingCalendarEvent | null;
  allEvents: UpcomingCalendarEvent[];
  now: number;
  isRecording: boolean;
  onSelectEvent: (event: UpcomingCalendarEvent) => void;
}

// Lives inside the same recording/transcript card as the mic controls and
// language picker — this is one continuous "listening to the meeting"
// session, not a separate status widget bolted on the side.
export default function MeetingStatusHeader({
  selectedEvent,
  allEvents,
  now,
  isRecording,
  onSelectEvent,
}: MeetingStatusHeaderProps) {
  if (!selectedEvent) return null;

  const status = getMeetingStatus(selectedEvent, now);
  const start = new Date(selectedEvent.start).getTime();
  const end = selectedEvent.end ? new Date(selectedEvent.end).getTime() : null;

  const nowDate = new Date(now);
  const todaysOtherEvents = allEvents.filter(
    (e) => e.id !== selectedEvent.id && isSameDay(new Date(e.start), nowDate)
  );

  return (
    <div className="mb-4 rounded-xl border border-[var(--surface-border)] bg-indigo-400/5 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold truncate">{selectedEvent.title}</p>
        <StatusPill status={status} />
      </div>
      <p className="text-xs text-[var(--muted)] mt-0.5">
        {formatClockTime(selectedEvent.start)}
        {selectedEvent.end ? ` to ${formatClockTime(selectedEvent.end)}` : ""}
      </p>

      {status === "live" && end !== null && (
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold tracking-tight brand-gradient-text">
              {formatCountdown(end - now)}
            </p>
            <p className="text-xs text-[var(--muted)]">left in this meeting</p>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-border)] overflow-hidden mt-2">
            <div
              className="h-full brand-gradient-bg rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))}%`,
              }}
            />
          </div>
          {!isRecording && (
            <p className="text-xs text-[var(--muted)] mt-2">
              We&apos;ll listen and build the transcript live. Hit <strong>Record live</strong>{" "}
              below to start, or paste notes instead.
            </p>
          )}
        </div>
      )}

      {status === "upcoming" && (
        <div className="mt-3">
          <p className="text-2xl font-extrabold tracking-tight brand-gradient-text">
            {formatCountdown(start - now)}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">until this meeting starts</p>
        </div>
      )}

      {status === "ended" && (
        <p className="text-xs text-[var(--muted)] mt-2">
          This meeting just wrapped. Stop recording below to generate your summary, or paste a
          transcript instead if you have one.
        </p>
      )}

      {status === "unknown" && (
        <p className="text-xs text-[var(--muted)] mt-2">
          Scheduled, but this meeting doesn&apos;t have a clear end time to count down to.
        </p>
      )}

      {todaysOtherEvents.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
            Also today
          </p>
          <div className="flex flex-wrap gap-1.5">
            {todaysOtherEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                className="text-xs rounded-full border border-[var(--surface-border)] px-2.5 py-1 transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
              >
                {formatClockTime(event.start)} · {event.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: MeetingStatus }) {
  const config: Record<MeetingStatus, { label: string; className: string }> = {
    live: { label: "Live", className: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400" },
    upcoming: {
      label: "Upcoming",
      className: "bg-indigo-400/15 text-indigo-500 dark:text-indigo-300",
    },
    ended: { label: "Ended", className: "bg-[var(--surface-border)] text-[var(--muted)]" },
    unknown: { label: "Scheduled", className: "bg-[var(--surface-border)] text-[var(--muted)]" },
  };
  const c = config[status];
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-1 flex items-center gap-1 ${c.className}`}
    >
      {status === "live" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {c.label}
    </span>
  );
}
