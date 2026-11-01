import { commitmentAttentionTitle } from "./commitment-text";
import type { Priority } from "./priority";
import type { CommitmentDirection } from "./types";

// Your MemoValet calendar as a calendar file (iCalendar, RFC 5545) that
// Google Calendar, Apple Calendar and Outlook subscribe to by link, and check
// again on their own: open tasks, project deadlines, jobs you've sent and
// scheduled calls, each on its day (or at its time). Pure: the rows come in,
// the text goes out (lib/calendar-feed-data.ts fetches the rows).

export type FeedEvent = {
  uid: string;
  title: string;
  // An exact time with a length, or a whole day.
  when: { at: string; minutes: number } | { date: string };
  description?: string;
  url?: string;
  priority?: Priority | null;
};

export type FeedRows = {
  commitments: { id: string; description: string; direction: CommitmentDirection; person_name: string | null; due_date: string | null; due_at?: string | null; priority?: Priority | null }[];
  projects: { id: string; name: string; due_date?: string | null; due_at?: string | null }[];
  actionItems: { id: string; task: string; due_date: string | null; priority?: Priority | null; meeting_title?: string | null }[];
  sentTasks: { id: string; title: string; recipient_email: string; due_date: string | null; priority?: Priority | null }[];
  calls: { id: string; title: string; scheduled_start: string | null; duration_minutes: number | null }[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const valid = (iso?: string | null): iso is string => Boolean(iso) && !Number.isNaN(Date.parse(iso as string));
const day = (date?: string | null) => (date && DATE.test(date.slice(0, 10)) ? date.slice(0, 10) : null);

/** Every dated item, as calendar events, with a link back to it in MemoValet. */
export function feedEvents(rows: FeedRows, site: string): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const c of rows.commitments) {
    const when = valid(c.due_at) ? { at: c.due_at, minutes: 30 } : day(c.due_date) ? { date: day(c.due_date)! } : null;
    if (!when) continue;
    const tab = c.direction === "they_owe" ? "waiting-on" : "i-owe";
    events.push({ uid: `commitment-${c.id}`, title: commitmentAttentionTitle(c), when, priority: c.priority, url: `${site}/tasks?tab=${tab}#commitment-${encodeURIComponent(c.id)}`, description: "A task in MemoValet." });
  }
  for (const p of rows.projects) {
    const when = valid(p.due_at) ? { at: p.due_at, minutes: 30 } : day(p.due_date) ? { date: day(p.due_date)! } : null;
    if (when) events.push({ uid: `project-${p.id}`, title: `Project deadline: ${p.name}`, when, url: `${site}/projects/${encodeURIComponent(p.id)}`, description: "A project deadline in MemoValet." });
  }
  for (const a of rows.actionItems) {
    const date = day(a.due_date);
    if (date) events.push({ uid: `action-item-${a.id}`, title: a.task, when: { date }, priority: a.priority, url: `${site}/tasks?task=${encodeURIComponent(a.id)}#task-${encodeURIComponent(a.id)}`, description: a.meeting_title ? `From the meeting “${a.meeting_title}” in MemoValet.` : "A task in MemoValet." });
  }
  for (const s of rows.sentTasks) {
    const date = day(s.due_date);
    if (date) events.push({ uid: `sent-task-${s.id}`, title: `Sent to ${s.recipient_email}: ${s.title}`, when: { date }, priority: s.priority, url: `${site}/tasks`, description: "A job you sent from MemoValet." });
  }
  for (const call of rows.calls) {
    if (!valid(call.scheduled_start)) continue;
    const minutes = call.duration_minutes && call.duration_minutes > 0 ? Math.min(call.duration_minutes, 24 * 60) : 30;
    events.push({ uid: `call-${call.id}`, title: call.title || "MemoValet call", when: { at: call.scheduled_start, minutes }, url: `${site}/live/${encodeURIComponent(call.id)}`, description: `Join the call: ${site}/live/${encodeURIComponent(call.id)}` });
  }
  return events;
}

// ---- The iCalendar text ----

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateValue = (date: string) => date.replace(/-/g, "");
function nextDay(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function escapeText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// Lines longer than 75 bytes are folded: a line break, then a space.
export function fold(line: string) {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  if (bytes(line) <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of Array.from(line)) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes(current + char) > limit) { parts.push(current); current = char; } else current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
const PRIORITY: Record<Priority, number> = { high: 1, medium: 5, low: 9 };

export function buildCalendarFeed(events: FeedEvent[], { now = new Date(), name = "MemoValet" } = {}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MemoValet//Calendar link//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-CALDESC:Your tasks\\, deadlines and calls from MemoValet",
    "X-APPLE-CALENDAR-COLOR:#7755EF",
    // Ask calendar apps to check back hourly (Google decides for itself).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}@memovalet.com`, `DTSTAMP:${stamp(now)}`);
    if ("date" in event.when) {
      lines.push(`DTSTART;VALUE=DATE:${dateValue(event.when.date)}`, `DTEND;VALUE=DATE:${dateValue(nextDay(event.when.date))}`, "TRANSP:TRANSPARENT");
    } else {
      const start = new Date(event.when.at);
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + event.when.minutes * 60000))}`);
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.priority && PRIORITY[event.priority]) lines.push(`PRIORITY:${PRIORITY[event.priority]}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// The secret in a calendar link: 32 random bytes, URL-safe.
export const FEED_TOKEN = /^[A-Za-z0-9_-]{43}$/;
