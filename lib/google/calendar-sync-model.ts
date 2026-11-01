import { dateKey } from "@/lib/work-calendar";

export const SYNC_KINDS = ["commitment", "project", "call", "action_item", "assignment"] as const;
export type SyncKind = typeof SYNC_KINDS[number];
export type Snapshot = { title: string; date: string | null; at: string | null; minutes: number };
export type SourceRow = Record<string, string | number | null>;
export const SOURCES = {
  commitment: { table: "commitments", owner: "user_id", title: "description", date: "due_date", at: "due_at", states: ["pending", "overdue"], columns: "id,description,due_date,due_at,reminder_at,status" },
  project: { table: "projects", owner: "created_by", title: "name", date: "due_date", at: "due_at", states: ["active"], columns: "id,name,due_date,due_at,status" },
  call: { table: "live_sessions", owner: "created_by", title: "title", date: "", at: "scheduled_start", states: ["active"], columns: "id,title,scheduled_start,duration_minutes,status" },
  action_item: { table: "action_items", owner: "user_id", title: "task", date: "due_date", at: "", states: ["todo"], columns: "id,task,due_date,status" },
  assignment: { table: "task_assignments", owner: "created_by", title: "title", date: "due_date", at: "", states: ["pending"], columns: "id,title,due_date,status" },
} as const;

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function sourceSnapshot(kind: SyncKind, row: SourceRow | null, timeZone: string): Snapshot | null {
  const source = SOURCES[kind];
  if (!row || !(source.states as readonly string[]).includes(String(row.status))) return null;
  const rawAt = source.at ? row[source.at] : null;
  const at = typeof rawAt === "string" && Number.isFinite(Date.parse(rawAt)) ? new Date(rawAt).toISOString() : null;
  const rawDate = source.date ? row[source.date] : null;
  const date = at ? dateKey(new Date(at), timeZone) : validDate(rawDate) ? rawDate : null;
  if (!date) return null;
  return { title: String(row[source.title] || "Untitled"), date, at, minutes: kind === "call" && Number(row.duration_minutes) > 0 ? Math.min(1440, Number(row.duration_minutes)) : 30 };
}

export type GoogleEvent = {
  id: string; etag?: string; status?: string; summary?: string;
  start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
  recurrence?: string[]; recurringEventId?: string; attendees?: unknown[];
  extendedProperties?: { private?: Record<string, string> };
};
export function remoteSnapshot(event: GoogleEvent | null, kind: SyncKind, timeZone: string): Snapshot | null {
  if (!event || event.status === "cancelled") return null;
  if (event.recurrence?.length || event.recurringEventId) throw new Error("Repeating events cannot sync back yet. Remove repetition in Google Calendar to continue.");
  // The integration never sends invitations or modifies an event with guests.
  if (event.attendees?.length) throw new Error("This event now has guests. Remove the guests or pause sync before changing it in MemoValet.");
  const at = event.start?.dateTime;
  if (at) {
    if (!SOURCES[kind].at) throw new Error("This type of task supports dates only. Make it an all day event in Google Calendar.");
    if (!Number.isFinite(Date.parse(at))) throw new Error("Google returned an invalid start time.");
    const minutes = (Date.parse(event.end?.dateTime || "") - Date.parse(at)) / 60000;
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440 || !Number.isInteger(minutes)) throw new Error("Choose an event length between 1 minute and 24 hours.");
    // Non-call due times represent a point deadline, not a meeting duration.
    return { title: event.summary?.trim() || "Untitled", date: dateKey(new Date(at), timeZone), at: new Date(at).toISOString(), minutes: kind === "call" ? minutes : 30 };
  }
  if (kind === "call") throw new Error("Scheduled calls need a time. Set a start time in Google Calendar.");
  const date = event.start?.date;
  if (!validDate(date)) throw new Error("Google returned an invalid date.");
  const tomorrow = new Date(`${date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (event.end?.date !== tomorrow.toISOString().slice(0, 10)) throw new Error("A deadline must occupy one day. Shorten this event in Google Calendar.");
  return { title: event.summary?.trim() || "Untitled", date, at: null, minutes: 30 };
}

export function sameSnapshot(a: Snapshot | null, b: Snapshot | null) {
  return a === null || b === null ? a === b : a.title === b.title && a.date === b.date && a.at === b.at && a.minutes === b.minutes;
}
export function syncDecision(base: Snapshot | null, local: Snapshot | null, remote: Snapshot | null): "same" | "push" | "pull" | "conflict" {
  if (sameSnapshot(local, remote)) return "same";
  if (sameSnapshot(base, remote)) return "push";
  if (sameSnapshot(base, local)) return "pull";
  return "conflict";
}

export function googleBody(value: Snapshot, userId: string, key: string, timeZone: string) {
  const tomorrow = new Date(`${value.date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return {
    summary: value.title,
    description: "Managed by MemoValet. Open your work at https://memovalet.com/calendar",
    start: value.at ? { dateTime: value.at, timeZone } : { date: value.date },
    end: value.at ? { dateTime: new Date(Date.parse(value.at) + value.minutes * 60000).toISOString(), timeZone } : { date: tomorrow.toISOString().slice(0, 10) },
    extendedProperties: { private: { memovaletOwner: userId, memovaletSource: key } },
  };
}

export function sourceChanges(kind: SyncKind, value: Snapshot | null, previous?: SourceRow): Record<string, string | number | null> {
  const source = SOURCES[kind];
  const changes: Record<string, string | number | null> = {};
  if (value) changes[source.title] = value.title;
  if (source.date) changes[source.date] = value?.date ?? null;
  if (source.at) changes[source.at] = value?.at ?? null;
  if (kind === "call" && value) changes.duration_minutes = value.minutes;
  if (kind === "commitment" && previous?.reminder_at && previous.due_at) {
    // Preserve a timed task's reminder offset when the due time moves. The
    // existing reminder triggers cancel its previous scheduled delivery.
    const offset = Date.parse(String(previous.reminder_at)) - Date.parse(String(previous.due_at));
    if (Number.isFinite(offset)) changes.reminder_at = value?.at ? new Date(Date.parse(value.at) + offset).toISOString() : null;
  }
  return changes;
}
