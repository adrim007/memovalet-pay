"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowClockwise, ArrowLeft, ArrowRight, CalendarBlank, CheckCircle, FileText, NotePencil, VideoCamera } from "@phosphor-icons/react";
import { calendarDays, dateInMonth, dateKey, shiftMonth, WORK_KIND_LABELS, type WorkCalendarEntry, type WorkKind } from "@/lib/work-calendar";
import CalendarCreate from "./CalendarCreate";
import CalendarSync from "./CalendarSync";
import styles from "./WorkCalendar.module.css";

const ICONS = { project: FileText, meeting: VideoCamera, call: VideoCamera, task: CheckCircle, file: FileText, note: NotePencil };
const COLORS: Record<WorkKind, string> = { project: "bg-indigo-500", meeting: "bg-violet-500", call: "bg-sky-500", task: "bg-amber-500", file: "bg-emerald-500", note: "bg-rose-400" };
const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" }));
const YEARS = Array.from({ length: 300 }, (_, index) => 1900 + index);
const subscribe = () => () => {};
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 text-sm font-semibold hover:border-indigo-400 disabled:opacity-40";

function previewEntries(month: string): WorkCalendarEntry[] {
  return [
    { id: "review", kind: "meeting", title: "Monday project review", date: `${month}-07`, detail: "Saved to your library", href: "/preview/history" },
    { id: "notes", kind: "note", title: "Ideas for the next launch", date: `${month}-07`, detail: "Saved to your library", href: "/preview/notes" },
    { id: "brief", kind: "file", title: "Project brief.pdf", date: `${month}-14`, detail: "Saved to your library", href: "/preview/documents" },
    { id: "task", kind: "task", title: "Send the updated proposal", date: `${month}-21`, detail: "Due date", href: "/preview/tasks", completed: false },
    { id: "call", kind: "call", title: "Team update", date: `${month}-21`, at: new Date(`${month}-21T10:00:00`).toISOString(), detail: "Scheduled", href: "/preview/live" },
    { id: "done", kind: "task", title: "Review the first draft", date: `${month}-14`, detail: "Due date", href: "/preview/tasks", completed: true },
  ];
}

function CalendarContent({ previewMode, entriesOverride }: { previewMode: boolean; entriesOverride?: WorkCalendarEntry[] }) {
  const dayPanel = useRef<HTMLElement>(null);
  const keyboardFocus = useRef(false);
  const today = dateKey(new Date());
  const [selected, setSelected] = useState(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    return date && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(date) && dateKey(new Date(`${date}T12:00:00`)) === date ? date : today;
  });
  const month = selected.slice(0, 7);
  const [kind, setKind] = useState<WorkKind | "all">("all");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ month: string; entries: WorkCalendarEntry[]; warnings: string[]; error?: string } | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const refresh = () => setRetry(value => value + 1);
    window.addEventListener("memovalet:calendar-changed", refresh);
    return () => window.removeEventListener("memovalet:calendar-changed", refresh);
  }, []);

  function choose(date: string) {
    setSelected(date);
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url);
  }

  function moveDay(date: string, offset: number, focus = false) {
    const target = new Date(`${date}T12:00:00`);
    target.setDate(target.getDate() + offset);
    const next = dateKey(target);
    if (next < "1900-01-01" || next > "2199-12-31") return;
    keyboardFocus.current = focus;
    choose(next);
  }

  useEffect(() => {
    if (!keyboardFocus.current) return;
    keyboardFocus.current = false;
    document.querySelector<HTMLButtonElement>(`[data-calendar-date="${selected}"]`)?.focus();
  }, [selected]);

  useEffect(() => {
    if (previewMode || entriesOverride !== undefined) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let active = true;
    fetch(`/api/calendar/work?${new URLSearchParams({ month, timeZone })}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 401 ? "Your session has expired. Please sign in again." : "Your calendar could not be loaded.");
        if (!Array.isArray(data.entries) || !Array.isArray(data.warnings)) throw new Error("Your calendar could not be loaded.");
        if (active) setResult({ month, entries: data.entries, warnings: data.warnings });
      })
      .catch((error) => {
        if (active) setResult({ month, entries: [], warnings: [], error: controller.signal.aborted ? "Loading took too long. Please try again." : error.message });
      }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [month, timeZone, retry, previewMode, entriesOverride]);

  const loading = entriesOverride === undefined && !previewMode && result?.month !== month;
  const entries = useMemo(() => entriesOverride !== undefined ? entriesOverride.filter(entry => entry.date.startsWith(month + "-")) : previewMode ? previewEntries(month) : result?.month === month ? result.entries : [], [entriesOverride, previewMode, month, result]);
  const filtered = entries.filter((entry) => kind === "all" || entry.kind === kind);
  const selectedEntries = filtered.filter((entry) => entry.date === selected);
  const days = calendarDays(month);
  const error = result?.month === month ? result.error : undefined;
  const warnings = result?.month === month ? result.warnings : [];
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayLabel = new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const activeDays = new Set(filtered.map((entry) => entry.date)).size;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  const dateNumber = Number(selected.slice(-2));
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const selectedDate = new Date(selected + "T12:00:00");
  const refresh = () => { setResult(null); setRetry((value) => value + 1); };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your library, through time</p>
          <h1>Your calendar</h1>
          <p className={styles.intro}>Revisit past work and see what’s coming up.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <CalendarSync buttonClass={buttonClass} preview={previewMode} />
          <Link className={`${buttonClass} ${styles.libraryLink}`} aria-label="Open library" href={previewMode ? "/preview/library" : "/library"}>Open library <ArrowRight size={16} /></Link>
        </div>
      </header>

      {(error || warnings.length > 0) && <div role="alert" className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <p className="font-semibold">{error || "Some work is missing from this view."}</p>
        {warnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
        <button className={buttonClass + " mt-3"} onClick={refresh}>Try again</button>
      </div>}

      <div className={styles.layout}>
        <section aria-label="Work calendar" className={styles.calendar}>
          <div className={styles.monthHeader}>
            <div>
              <h2>{monthLabel}</h2>
              <p aria-live="polite">{loading ? "Loading your month…" : error ? "Calendar unavailable" : filtered.length + " items · " + activeDays + " active days" + (warnings.length ? " loaded" : "")}</p>
            </div>
            <div className={styles.navigation}>
              <button aria-label="Previous month" disabled={month === "1900-01"} className={buttonClass} onClick={() => choose(dateInMonth(selected, shiftMonth(month, -1)))}><ArrowLeft size={16} /></button>
              <button className={buttonClass} onClick={() => choose(today)}>Today</button>
              <button aria-label="Next month" disabled={month === "2199-12"} className={buttonClass} onClick={() => choose(dateInMonth(selected, shiftMonth(month, 1)))}><ArrowRight size={16} /></button>
            </div>
          </div>

          <div className={styles.tools}>
            <fieldset className={styles.datePicker}>
              <legend className="sr-only">Go to a date</legend>
              <label><span>Day</span><select aria-label="Day" value={dateNumber} onChange={(event) => choose(month + "-" + event.target.value.padStart(2, "0"))}>
                {Array.from({ length: lastDay }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
              </select></label>
              <label className={styles.monthPicker}><span>Month</span><select aria-label="Month" value={monthNumber} onChange={(event) => choose(dateInMonth(selected, year + "-" + event.target.value.padStart(2, "0")))}>
                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select></label>
              <label><span>Year</span><select aria-label="Year" value={year} onChange={(event) => choose(dateInMonth(selected, event.target.value + "-" + String(monthNumber).padStart(2, "0")))}>
                {YEARS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
            </fieldset>
            <label className={styles.filter}><span>Show</span>
              <select aria-label="Filter calendar" value={kind} onChange={(event) => setKind(event.target.value as WorkKind | "all")}>
                <option value="all">All work</option>
                {Object.entries(WORK_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}s</option>)}
              </select>
            </label>
          </div>

          <div className={styles.weekdays} aria-hidden>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className={styles.grid} aria-busy={loading}>
            {days.map((date, index) => {
              if (!date) return <span className={styles.blank} key={"blank-" + index} />;
              const items = filtered.filter((entry) => entry.date === date);
              const count = loading || error ? "" : ", " + items.length + " item" + (items.length === 1 ? "" : "s");
              return <button key={date} data-calendar-date={date}
                aria-label={new Date(date + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) + count}
                aria-pressed={date === selected} aria-current={date === today ? "date" : undefined}
                onKeyDown={(event) => {
                  const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                  if (offset) { event.preventDefault(); moveDay(date, offset, true); }
                }}
                onClick={() => {
                  choose(date);
                  if (window.matchMedia("(max-width: 767px)").matches) {
                    dayPanel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
                  }
                }}
                className={styles.day + (date === selected ? " " + styles.selected : "") + (index % 7 > 4 ? " " + styles.weekend : "")}>
                <span className={styles.dayTop}>
                  <span className={styles.dayNumber + (date === today ? " " + styles.today : "")}>{Number(date.slice(-2))}</span>
                  {items.length > 0 && <span className={styles.count} aria-hidden>{items.length}</span>}
                </span>
                <span className={styles.previews} aria-hidden>
                  {items.slice(0, 2).map((entry) => <span key={entry.id} className={styles.event + " " + styles[entry.kind]}><span className={COLORS[entry.kind]} /><span>{entry.title}</span></span>)}
                  {items.length > 2 && <span className={styles.more}>+{items.length - 2} more</span>}
                </span>
                <span className={styles.dots} aria-hidden>{[...new Set(items.map((entry) => entry.kind))].slice(0, 4).map((entryKind) => <span key={entryKind} className={COLORS[entryKind]} />)}</span>
              </button>;
            })}
          </div>

          <footer className={styles.calendarFooter}>
            <div className={styles.legend}>{Object.entries(WORK_KIND_LABELS).map(([key, label]) => <span key={key}><i className={COLORS[key as WorkKind]} />{label}</span>)}</div>
            <span className={styles.timezone}>{timeZone.replaceAll("_", " ")}</span>
          </footer>
        </section>

        <section ref={dayPanel} aria-label="Selected day" aria-busy={loading} className={styles.agenda}>
          <div className={styles.agendaTop}>
            <p className={styles.eyebrow}>{selected === today ? "Today at a glance" : selected < today ? "On this day" : "Coming up"}</p>
            <div className={styles.dayNavigation}>
              <button aria-label="Previous day" disabled={selected === "1900-01-01"} onClick={() => moveDay(selected, -1)}><ArrowLeft size={15} /></button>
              <button aria-label="Next day" disabled={selected === "2199-12-31"} onClick={() => moveDay(selected, 1)}><ArrowRight size={15} /></button>
            </div>
          </div>
          <div className={styles.dateHeading}>
            <span className={styles.dateBadge} aria-hidden>{dateNumber}<small>{selectedDate.toLocaleDateString(undefined, { month: "short" })}</small></span>
            <div><h2 aria-label={dayLabel}>{selectedDate.toLocaleDateString(undefined, { weekday: "long" })}</h2><p>{selectedDate.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p></div>
          </div>
          <div aria-live="polite" className={styles.agendaSummary}>{loading ? "Loading your work…" : error ? "Calendar unavailable" : selectedEntries.length + " item" + (selectedEntries.length === 1 ? "" : "s") + (warnings.length ? " loaded" : "")}</div>
          {loading && <div className={styles.skeleton} aria-hidden><span /><span /><span /></div>}
          {!loading && !error && (selectedEntries.length > 0 ? <ol className={styles.timeline}>
            {selectedEntries.map((entry) => {
              const Icon = ICONS[entry.kind];
              return <li key={entry.id}>
                <span className={styles.timelineDot + " " + COLORS[entry.kind]} aria-hidden />
                <Link href={entry.href} className={styles.activity}>
                  <span className={styles.activityMeta}><span className={styles.activityKind + " " + styles[entry.kind]}><Icon size={14} />{WORK_KIND_LABELS[entry.kind]}</span>{entry.at && <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>}</span>
                  <p className={styles.activityTitle}>{entry.title}</p>
                  <span className={styles.activityBottom}><span>{entry.completed ? <><CheckCircle size={14} />Completed · {entry.detail}</> : entry.detail}</span><ArrowRight size={16} /></span>
                </Link>
              </li>;
            })}
          </ol> : <div className={styles.empty}><CalendarBlank size={30} /><p>{warnings.length ? "No items loaded for this day" : kind === "all" ? "A little breathing room" : "No matching work for this day"}</p><span>{warnings.length ? "Retry to check the missing sections." : kind !== "all" ? "Try All work to see other activity." : "Nothing saved or scheduled here. Choose a marked date to explore your work."}</span>{kind !== "all" && <button onClick={() => setKind("all")}>Show all work <ArrowRight size={14} /></button>}</div>)}
          <details className={styles.dateGuide}><summary>How your work is dated</summary><p>Meetings, notes and files use their saved date. Tasks use their due date, including completed tasks. Calls use their scheduled time. Undated work stays in Library and Work. Connected Google calls appear on Home.</p></details>
          <CalendarCreate key={selected} date={selected} preview={previewMode} onSaved={refresh} />
          {!previewMode && <button className={styles.refresh} onClick={refresh} disabled={loading}><ArrowClockwise size={15} />Refresh calendar</button>}
        </section>
      </div>
    </div>
  );
}

export default function WorkCalendar({ previewMode = false, entriesOverride }: { previewMode?: boolean; entriesOverride?: WorkCalendarEntry[] }) {
  // Resolve the user's timezone after hydration, never the server's timezone.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <CalendarContent previewMode={previewMode} entriesOverride={entriesOverride} /> : <p role="status" className="p-6 text-[var(--muted)]">Loading your calendar…</p>;
}
