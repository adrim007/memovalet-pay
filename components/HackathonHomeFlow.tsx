"use client";

import { useMemo, useSyncExternalStore } from "react";
import HomeWorkspace from "@/components/HomeWorkspace";
import type { UpcomingCalendarEvent } from "@/lib/types";

const STORAGE_KEY = "memovalet:sample-workspace:scheduled-meetings:v1";
const CHANGE = "memovalet-sample-schedule-change";
function subscribe(listener: () => void) {
  window.addEventListener(CHANGE, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(CHANGE, listener); window.removeEventListener("storage", listener); };
}
function snapshot() { try { return localStorage.getItem(STORAGE_KEY) || "[]"; } catch { return "[]"; } }
function serverSnapshot() { return "[]"; }

export function useSampleMeetings() {
  const saved = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo<UpcomingCalendarEvent[]>(() => {
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(event => typeof event.id === "string" && typeof event.title === "string" && typeof event.start === "string" && Number.isFinite(Date.parse(event.start))) : [];
    } catch { return []; }
  }, [saved]);
}

// Saves a meeting into the sample workspace calendar. Home, Calendar and the simulated
// Alexa+ assistant all write through here, so a booking shows up everywhere at once.
export function saveSampleMeeting(title: string, start: string) {
  let events: UpcomingCalendarEvent[] = [];
  try { const parsed = JSON.parse(snapshot()); if (Array.isArray(parsed)) events = parsed; } catch { /* start a fresh list */ }
  if (events.some(event => event.title === title && Date.parse(event.start) === Date.parse(start))) return;
  const event: UpcomingCalendarEvent = { id: crypto.randomUUID(), title, start: new Date(start).toISOString(), end: new Date(Date.parse(start) + 30 * 60000).toISOString(), meetLink: "", attendees: [], source: "manual" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...events, event].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(-20)));
  window.dispatchEvent(new Event(CHANGE));
}

export default function HackathonHomeFlow() {
  const events = useSampleMeetings();

  function scheduleMeeting(title: string, start: string) {
    saveSampleMeeting(title, start);
  }

  return (
    <>
      <p className="mx-auto mb-5 max-w-7xl text-xs text-[var(--muted)]">Sample workspace · fictional meeting · new schedules stay in this browser</p>
      <HomeWorkspace
        firstName="Maya" accountType="business" previewMode
        totalMeetings={1} meetingsThisWeek={1} totalActionItems={2} totalTasksSent={0}
        askPath="/preview/ask?scenario=launch" onSampleSchedule={scheduleMeeting}
        calendarHref="/preview/calendar?scenario=launch"
        recentDocuments={[]} scheduleEvents={events}
        activeProject={{ id: "pilot", created_by: "preview-maya", team_id: null, name: "Acme pilot launch", client_name: "Acme", status: "active", created_at: "2026-10-14T09:00:00Z" }}
        priorities={[
          { title: "Finish the pilot onboarding copy", description: "Priya · due 20 October", href: "/preview/history/launch-date?scenario=launch", type: "commitment_due_i_owe" },
          { title: "Draft the support playbook", description: "Alex · due 21 October", href: "/preview/history/launch-date?scenario=launch", type: "commitment_due_i_owe" },
          { title: "Acme launch planning", description: "Decision saved · pilot launches 28 October", href: "/preview/history/launch-date?scenario=launch", type: "meeting_today" },
        ]}
      />
    </>
  );
}
