import { dateKey } from "./work-calendar";
export type WorkFilter = "open" | "overdue" | "done";
export function matchesWorkFilter(filter: WorkFilter, status: string, date?: string | null, at?: string | null, now = new Date()): boolean {
  const done = status === "done" || status === "completed";
  if (filter === "done") return done;
  if (done || status === "cancelled") return false;
  if (filter === "open") return true;
  return at ? Date.parse(at) < now.getTime() : !!date && date < dateKey(now);
}
