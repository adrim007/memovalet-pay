export type WorkKind = "meeting" | "call" | "task" | "project" | "file" | "note";

export interface WorkCalendarEntry {
  id: string;
  kind: WorkKind;
  title: string;
  date: string;
  at?: string;
  detail: string;
  href: string;
  completed?: boolean;
}

export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  meeting: "Saved meeting", call: "Scheduled call", task: "Task", project: "Project deadline", file: "File", note: "Note",
};

export function dateKey(date: Date, timeZone?: string): string {
  if (!timeZone) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function monthRange(month: string) {
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid month between 1900 and 2199.");
  const [year, index] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, index - 1, 1));
  const end = new Date(Date.UTC(year, index, 1));
  return {
    first: `${month}-01`, next: end.toISOString().slice(0, 10),
    // Include both extremes of civil time. Filter to the viewer's month after
    // converting timestamps; date-only deadlines must never shift timezones.
    start: new Date(start.getTime() - 14 * 3600000).toISOString(),
    end: new Date(end.getTime() + 14 * 3600000).toISOString(),
  };
}

export function calendarDays(month: string): (string | null)[] {
  const { first, next } = monthRange(month);
  const start = new Date(`${first}T12:00:00Z`);
  const count = Math.round((Date.parse(`${next}T12:00:00Z`) - start.getTime()) / 86400000);
  const days: (string | null)[] = Array((start.getUTCDay() + 6) % 7).fill(null);
  for (let day = 1; day <= count; day++) days.push(`${month}-${String(day).padStart(2, "0")}`);
  while (days.length % 7) days.push(null);
  return days;
}

export function shiftMonth(month: string, step: number): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + step, 1)).toISOString().slice(0, 7);
}

// Keep the selected day when browsing months/years, clamping January 31 to
// February 28/29 instead of spilling into March or resetting to the first.
export function dateInMonth(date: string, month: string): string {
  monthRange(month);
  const [year, index] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const day = Math.min(Math.max(Number(date.slice(-2)) || 1, 1), lastDay);
  return `${month}-${String(day).padStart(2, "0")}`;
}
