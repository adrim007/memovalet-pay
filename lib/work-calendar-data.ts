import { createClient } from "@/lib/supabase/server";
import { dateKey, monthRange, type WorkCalendarEntry, type WorkKind } from "@/lib/work-calendar";

type Row = Record<string, string | null>;
type Source = { table: string; columns: string; column: string; kind: WorkKind; label: string; owner?: string; dateOnly?: boolean };
const SOURCES: Source[] = [
  { table: "commitments", columns: "id,description,direction,due_date,due_at,status", column: "due_date", kind: "task", label: "Personal tasks", owner: "user_id", dateOnly: true },
  { table: "projects", columns: "id,name,due_date,due_at,status", column: "due_date", kind: "project", label: "Project deadlines", dateOnly: true },
  { table: "meetings", columns: "id,title,created_at", column: "created_at", kind: "meeting", label: "Saved meetings" },
  { table: "notes", columns: "id,title,body,created_at", column: "created_at", kind: "note", label: "Notes" },
  { table: "documents", columns: "id,title,created_at", column: "created_at", kind: "file", label: "Files", owner: "user_id" },
  { table: "action_items", columns: "id,task,due_date,status", column: "due_date", kind: "task", label: "Meeting tasks", dateOnly: true },
  { table: "task_assignments", columns: "id,title,due_date,status", column: "due_date", kind: "task", label: "Assigned tasks", owner: "created_by", dateOnly: true },
  { table: "live_sessions", columns: "id,title,scheduled_start,status,meeting_id", column: "scheduled_start", kind: "call", label: "Scheduled calls", owner: "created_by" },
];

function entry(source: Source, row: Row, timeZone: string): WorkCalendarEntry | null {
  const value = row[source.column];
  if (!row.id || !value || Number.isNaN(Date.parse(value))) return null;
  const id = encodeURIComponent(row.id);
  const href = source.table === "meetings" ? `/history/${id}`
    : source.table === "notes" ? `/notes?note=${id}#note-${id}`
    : source.table === "documents" ? `/documents?document=${id}`
    : source.table === "commitments" ? `/tasks?tab=${row.direction === "they_owe" ? "waiting-on" : "i-owe"}${row.status === "completed" ? "&status=done" : ""}#commitment-${id}`
    : source.table === "projects" ? `/projects/${id}`
    : source.table === "action_items" ? `/tasks?task=${id}#task-${id}`
    : source.table === "task_assignments" ? `/assigned/${id}`
    : row.meeting_id ? `/history/${encodeURIComponent(row.meeting_id)}` : `/live/${id}`;
  return {
    id: `${source.table}:${row.id}`, kind: source.kind,
    title: row.title?.trim() || row.name?.trim() || row.description?.trim() || row.task?.trim() || row.body?.trim().split("\n")[0].slice(0, 120) || "Untitled",
    date: row.due_at ? dateKey(new Date(row.due_at), timeZone) : source.dateOnly ? value.slice(0, 10) : dateKey(new Date(value), timeZone),
    at: row.due_at || (source.dateOnly ? undefined : value),
    detail: source.dateOnly ? "Due date" : source.kind === "call" ? row.status === "ended" ? "Call ended" : "Scheduled" : "Saved to your library",
    href, completed: row.status === "done" || row.status === "ended" || row.status === "completed" || row.status === "closed",
  };
}

export async function getWorkCalendar(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, month: string, timeZone: string) {
  const range = monthRange(month);
  // This is always the signed-in client's RLS context, including shared items
  // already visible in Library. Never use a service-role client here.
  const results = await Promise.all(SOURCES.map(async (source) => {
    const entries: WorkCalendarEntry[] = [];
    try {
      for (let offset = 0; offset < 5000; offset += 500) {
        let query = supabase.from(source.table).select(source.columns)
          .gte(source.column, source.columns.includes("due_at") ? range.start.slice(0, 10) : source.dateOnly ? range.first : range.start)
          .lt(source.column, source.columns.includes("due_at") ? new Date(Date.parse(range.end) + 86400000).toISOString().slice(0, 10) : source.dateOnly ? range.next : range.end)
          .order(source.column).order("id").range(offset, offset + 499)
          .abortSignal(AbortSignal.timeout(12000));
        if (source.owner) query = query.eq(source.owner, userId);
        const { data, error } = await query;
        if (error) throw error;
        const rows = (data ?? []) as unknown as Row[];
        for (const row of rows) {
          const item = entry(source, row, timeZone);
          if (item?.date.startsWith(`${month}-`)) entries.push(item);
        }
        if (rows.length < 500) return { entries, warning: null };
      }
      return { entries, warning: `${source.label}: this is a partial list for a very busy month. Open the source section to see more.` };
    } catch (error) {
      console.error(`Work calendar: ${source.table} failed`, error);
      return { entries, warning: `${source.label} could not be fully loaded. Please retry.` };
    }
  }));
  return {
    entries: results.flatMap((result) => result.entries).sort((a, b) => a.date.localeCompare(b.date) || (a.at || "").localeCompare(b.at || "") || a.id.localeCompare(b.id)),
    warnings: results.flatMap((result) => result.warning ? [result.warning] : []),
  };
}
