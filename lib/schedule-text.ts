import { en } from "chrono-node";

export type ParsedSchedule = { date: string; at: string | null; timeZone: string; label: string };

function wallTime(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
}

export function parseSchedule(text: string, timeZone: string, now = new Date()): ParsedSchedule | null {
  if (!timeZone || !Number.isFinite(now.getTime())) throw new Error("Choose a valid timezone before scheduling.");
  try { new Intl.DateTimeFormat("en", { timeZone }).format(now); } catch { throw new Error("Choose a valid timezone before scheduling."); }
  if (/\b(0?[1-9]|1[0-2])\/(0?[1-9]|1[0-2])(?:\/\d{2,4})?\b/.test(text)) throw new Error("Please write the month in words, such as 5 October, so the date is clear.");
  const offset = (wallTime(now, timeZone) - Math.floor(now.getTime() / 1000) * 1000) / 60000;
  const matches = en.GB.parse(text, { instant: now, timezone: offset }, { forwardDate: true });
  if (!matches.length) {
    if (/\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text)) throw new Error("Please enter a valid date, such as tomorrow at 1pm or 5 October 2027.");
    return null;
  }
  // A date and a time can be separated by the task description in either order.
  // Combine only one date-only match and one time-only match; never merge two dates.
  let start = matches[0].start;
  let timeText = matches[0].text;
  if (matches.length === 2 && matches.every(match => !match.end)) {
    const clock = matches.find(match => match.start.isCertain("hour") &&
      !(["day", "month", "year", "weekday"] as const).some(component => match.start.isCertain(component)));
    const day = matches.find(match => match !== clock && !match.start.isCertain("hour"));
    if (!clock || !day) throw new Error("Please use one date and time for this item.");
    const combined = en.GB.parse(`${day.text} ${clock.text}`, { instant: now, timezone: offset }, { forwardDate: true });
    if (combined.length !== 1 || combined[0].end) throw new Error("Please use one date and time for this item.");
    start = combined[0].start;
    timeText = clock.text;
  } else if (matches.length > 1 || matches[0].end) {
    throw new Error("Please use one date and time for this item.");
  }
  const year = start.get("year")!, month = start.get("month")!, day = start.get("day")!;
  if (year < 1900 || year > 2199) throw new Error("Choose a year between 1900 and 2199.");
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  let at: string | null = null;
  if (start.isCertain("hour")) {
    const hour = start.get("hour")!, minute = start.get("minute")!;
    if (!start.isCertain("meridiem") && hour > 0 && hour <= 12 && !/\b\d{1,2}:\d{2}\b|\b(noon|midnight|morning|afternoon|evening|tonight)\b/i.test(timeText)) throw new Error("Please include am or pm, such as 1pm, so the time is clear.");
    const desired = Date.UTC(year, month - 1, day, hour, minute, start.get("second") || 0);
    if (start.isCertain("timezoneOffset")) {
      at = new Date(desired - start.get("timezoneOffset")! * 60000).toISOString();
    } else {
      const candidates = new Set<number>();
      for (const shift of [-86400000, 0, 86400000]) {
        const sample = desired + shift;
        const zoneOffset = wallTime(new Date(sample), timeZone) - sample;
        const candidate = desired - zoneOffset;
        if (wallTime(new Date(candidate), timeZone) === desired) candidates.add(candidate);
      }
      if (candidates.size !== 1) throw new Error("That time is skipped or repeated when the clocks change. Please choose another time or include a UTC offset.");
      at = new Date([...candidates][0]).toISOString();
    }
  }
  const label = at
    ? new Intl.DateTimeFormat("en-AU", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(at)) + ` (${timeZone})`
    : new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", dateStyle: "full" }).format(new Date(date + "T12:00:00Z")) + " (all day)";
  return { date, at, timeZone, label };
}

/** An explicit date field takes precedence over dates mentioned in the title. */
export function explicitSchedule(date: unknown, time: unknown, timeZone: unknown): ParsedSchedule | null {
  if (date === null || date === "") {
    if (time) throw new Error("Choose a date before adding a time.");
    return null;
  }
  if (typeof date !== "string" || !/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + "T12:00:00Z")) || new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date)
    throw new Error("Choose a valid date.");
  if (time !== undefined && time !== null && time !== "" && (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
    throw new Error("Choose a valid time.");
  const zone = typeof timeZone === "string" ? timeZone : "UTC";
  return parseSchedule(date + (time ? ` at ${time}` : ""), zone);
}

export function reminderInstant(local: unknown, timeZone: unknown): string | null {
  if (local === null || local === "" || local === undefined) return null;
  if (typeof local !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Choose a reminder date and time.");
  return explicitSchedule(local.slice(0, 10), local.slice(11), timeZone)?.at ?? null;
}
