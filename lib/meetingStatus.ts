import { UpcomingCalendarEvent } from "./types";

export type MeetingStatus = "upcoming" | "live" | "ended" | "unknown";

export function getMeetingStatus(event: UpcomingCalendarEvent, now: number): MeetingStatus {
  const start = new Date(event.start).getTime();
  if (Number.isNaN(start)) return "unknown";
  if (!event.end) return now < start ? "upcoming" : "unknown";

  const end = new Date(event.end).getTime();
  if (Number.isNaN(end)) return "unknown";

  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "ended";
}
