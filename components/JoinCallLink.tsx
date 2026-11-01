"use client";

import { MEETING_PROVIDER_LABELS } from "@/lib/meetingLinks";
import { UpcomingCalendarEvent } from "@/lib/types";

// Opens the actual Zoom/Teams/Meet call. Deliberately a new tab: leaving
// MemoValet mid-meeting would throw away whatever is being recorded.
export default function JoinCallLink({
  event,
  className = "",
}: {
  event: UpcomingCalendarEvent;
  className?: string;
}) {
  if (!event.meetLink) return null;

  const where = event.provider ? MEETING_PROVIDER_LABELS[event.provider] : "the call";

  return (
    <a
      href={event.meetLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(clickEvent) => clickEvent.stopPropagation()}
      aria-label={`Join ${event.title} on ${where}, opens in a new tab`}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:gap-1.5 dark:text-indigo-400 ${className}`}
    >
      Join {where} <span aria-hidden="true">↗</span>
    </a>
  );
}
