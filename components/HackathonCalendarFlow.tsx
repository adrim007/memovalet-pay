"use client";

import { useSampleMeetings } from "@/components/HackathonHomeFlow";
import WorkCalendar from "@/components/WorkCalendar";
import { demoMeetingMemory } from "@/lib/hackathon/meeting-memory";
import { dateKey, type WorkCalendarEntry } from "@/lib/work-calendar";

export default function HackathonCalendarFlow() {
  const events = useSampleMeetings();
  const entries: WorkCalendarEntry[] = [
    { id: "launch-date", kind: "meeting", title: "Acme launch planning", date: "2026-10-14", detail: "Saved decision and transcript", href: "/preview/history/launch-date?scenario=launch" },
    ...demoMeetingMemory.actionItems.filter(a => a.status === "open").map(a => ({ id: a.id, kind: "task" as const, title: a.task, date: a.due, detail: `${a.owner} · ${a.meeting}`, href: "/preview/history/launch-date?scenario=launch", completed: false })),
    ...events.map(event => ({ id: event.id, kind: "call" as const, title: event.title, date: dateKey(new Date(event.start)), at: event.start, detail: "Scheduled in this sample workspace · 30 minutes", href: "/preview?scenario=launch" })),
  ];
  return <><p className="mb-5 text-xs text-[var(--muted)]">Sample workspace · the same meeting schedule as Home · fictional task deadlines</p><WorkCalendar previewMode entriesOverride={entries} /></>;
}
