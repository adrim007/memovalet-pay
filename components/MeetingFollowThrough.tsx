"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FollowThroughPlan } from "@/lib/mcp/follow-through-server";

type Task = { id: string; task: string; owner: string | null; due_date: string | null; status: string };
const field = "w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm";
const button = "rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50";
const subscribeToZone = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const serverZone = () => "";
function isoDate(value: string | null) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }

async function save(meetingId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/meetings/${meetingId}/follow-through`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, confirmed: true }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Couldn't confirm the save. Please retry.");
  return result;
}

function TaskReview({ task, meetingId }: { task: Task; meetingId: string }) {
  const [owner, setOwner] = useState(task.owner || "");
  const [date, setDate] = useState(isoDate(task.due_date));
  const [saved, setSaved] = useState({ owner: task.owner || "", date: isoDate(task.due_date) });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const saving = useRef(false);
  const changed = owner !== saved.owner || date !== saved.date;
  const needsCalendarDate = !!task.due_date && !isoDate(task.due_date) && !date;
  async function confirm() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await save(meetingId, { kind: "task", taskId: task.id, owner, dueDate: date });
      const next = { owner: result.task.owner || "", date: isoDate(result.task.due_date) };
      setSaved(next); setOwner(next.owner); setDate(next.date);
      setMessage(next.date ? "Saved. This deadline appears in Calendar." : "Saved without a Calendar deadline.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save this task."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <li className="rounded-xl border border-[var(--surface-border)] p-4">
    <p className="text-sm font-medium">{task.task}</p>
    <p className="mt-1 text-xs text-[var(--muted)]">{task.status === "done" ? "Completed" : "Open task"}</p>
    {task.due_date && !isoDate(task.due_date) && <p className="mt-2 text-xs text-[var(--muted)]">Recorded deadline: {task.due_date}. Choose a calendar date below before saving.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium">Owner
        <input className={field + " mt-1"} value={owner} maxLength={120} disabled={busy} onChange={e => { setOwner(e.target.value); setMessage(""); }} />
      </label>
      <label className="text-xs font-medium">Deadline
        <input type="date" className={field + " mt-1"} value={date} disabled={busy} onChange={e => { setDate(e.target.value); setMessage(""); }} />
      </label>
    </div>
    <button type="button" className={button + " mt-3"} onClick={confirm} disabled={busy || !changed || needsCalendarDate}>{busy ? "Saving…" : "Save task changes"}</button>
    {message && <p role="status" className="mt-2 text-sm text-[var(--muted)]">{message}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
  </li>;
}

export default function MeetingFollowThrough({ meetingId, title }: { meetingId: string; title: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState(() => `Follow up: ${title}`.slice(0, 200));
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const localZone = useSyncExternalStore(subscribeToZone, browserZone, serverZone);
  const [zoneOverride, setZone] = useState<string | null>(null);
  const zone = zoneOverride ?? localZone;
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scheduled, setScheduled] = useState<{ id: string; date: string; label: string } | null>(null);
  const [prepared, setPrepared] = useState<FollowThroughPlan | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const preparationInFlight = useRef(false);
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setLoadError("");
      try {
        const response = await fetch(`/api/meetings/${meetingId}/follow-through`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Couldn't load the saved tasks.");
        setTasks(result.tasks);
      } catch (e) {
        if (!controller.signal.aborted) setLoadError(e instanceof Error ? e.message : "Couldn't load the saved tasks.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [meetingId, reload]);

  async function prepare() {
    if (preparationInFlight.current) return;
    preparationInFlight.current = true;
    setPreparing(true); setPrepareError(""); setPrepared(null);
    try {
      const { requestFollowThroughPlan } = await import("@/lib/mcp/follow-through-client");
      const plan = await requestFollowThroughPlan(meetingId);
      setPrepared(plan); setMeetingTitle(plan.followUp.title); setDuration(plan.followUp.durationMinutes);
      setScheduled(null);
    } catch (e) { setPrepareError(e instanceof Error ? e.message : "Couldn't prepare this meeting. Nothing was saved."); }
    finally { preparationInFlight.current = false; setPreparing(false); }
  }

  async function schedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError(""); setScheduled(null);
    const details = { title: meetingTitle, date, time, timeZone: zone, durationMinutes: duration };
    const fingerprint = JSON.stringify(details);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await save(meetingId, { kind: "meeting", ...details, requestId: pending.current.id });
      setScheduled({ id: result.session.id, date: result.schedule.date, label: result.schedule.label });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't confirm the meeting save."); }
    finally { saving.current = false; setBusy(false); }
  }

  return <section aria-labelledby="follow-through-heading" className="surface-card rounded-2xl p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="follow-through-heading" className="text-base font-semibold">Follow through</h2>
      <Link href="/calendar" className="text-sm text-indigo-500 hover:underline">Open Calendar</Link>
    </div>
    <p className="mt-2 text-sm text-[var(--muted)]">Review the saved tasks from this meeting, then choose a time to catch up. Nothing saves until you confirm it below.</p>
    <div className="mt-4 flex gap-4 text-xs">
      <Link className="text-indigo-500 hover:underline" href={`/history/${meetingId}`}>Source: {title}</Link>
      <Link className="text-indigo-500 hover:underline" href="/tasks">All tasks</Link>
    </div>
    <h3 className="mt-5 text-sm font-semibold">Meeting tasks</h3>
    <button type="button" className={button + " mt-3"} onClick={prepare} disabled={preparing || busy || loading || !!loadError}>
      {preparing ? "Preparing from saved meeting…" : "Prepare follow-up from meeting"}
    </button>
    {prepareError && <p role="alert" className="mt-2 text-sm text-red-500">{prepareError}</p>}
    {prepared && <div role="status" className="mt-3 rounded-xl border border-[var(--surface-border)] p-3 text-sm">
      <p className="font-medium">Prepared from your saved meeting</p>
      <p className="mt-1 text-[var(--muted)]">{prepared.openTasks.length} open tasks · {prepared.completedCount} completed tasks kept unchanged.</p>
      <p className="mt-1 text-[var(--muted)]">{prepared.missingOwners.length} need an owner · {prepared.missingDeadlines.length} need a calendar date. Review below before saving.</p>
      <details className="mt-2 text-xs text-[var(--muted)]"><summary>Connection details</summary><p className="mt-1">MCP meeting preparation succeeded. No tasks or meetings were saved by this tool.</p></details>
    </div>}
    {loading ? <p role="status" className="mt-3 text-sm text-[var(--muted)]">Loading saved tasks…</p>
      : loadError ? <div className="mt-3"><p role="alert" className="text-sm text-red-500">{loadError}</p><button type="button" className={button + " mt-2"} onClick={() => setReload(v => v + 1)}>Retry</button></div>
      : tasks.length ? <ul className="mt-3 space-y-3">{tasks.map(task => <TaskReview key={task.id} task={task} meetingId={meetingId} />)}</ul>
      : <p className="mt-3 text-sm text-[var(--muted)]">This meeting has no saved tasks.</p>}
    <form onSubmit={schedule} className="mt-6 border-t border-[var(--surface-border)] pt-5">
      <h3 className="text-sm font-semibold">Schedule a follow-up</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">Saves a MemoValet meeting in Calendar. This does not send invitations or add an event to Google Calendar.</p>
      <label className="mt-3 block text-xs font-medium">Meeting title
        <input className={field + " mt-1"} required maxLength={200} value={meetingTitle} disabled={busy} onChange={e => { setMeetingTitle(e.target.value); setScheduled(null); }} />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">Date
          <input className={field + " mt-1"} type="date" required value={date} disabled={busy} onChange={e => { setDate(e.target.value); setScheduled(null); }} />
        </label>
        <label className="text-xs font-medium">Time
          <input className={field + " mt-1"} type="time" required value={time} disabled={busy} onChange={e => { setTime(e.target.value); setScheduled(null); }} />
        </label>
        <label className="text-xs font-medium">Timezone
          <input className={field + " mt-1"} required value={zone} disabled={busy} onChange={e => { setZone(e.target.value); setScheduled(null); }} />
        </label>
        <label className="text-xs font-medium">Minutes
          <input className={field + " mt-1"} type="number" min={5} max={480} required value={duration} disabled={busy} onChange={e => { setDuration(Number(e.target.value)); setScheduled(null); }} />
        </label>
      </div>
      <button type="submit" className={button + " mt-3"} disabled={busy || !zone || !!scheduled}>{busy ? "Saving…" : scheduled ? "Follow-up saved" : "Confirm and schedule follow-up"}</button>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      {scheduled && <div role="status" className="mt-3 text-sm">
        <p>Saved: {scheduled.label}</p>
        <div className="mt-2 flex gap-4">
          <Link className="text-indigo-500 hover:underline" href={`/calendar?date=${scheduled.date}`}>View in Calendar</Link>
          <Link className="text-indigo-500 hover:underline" href={`/live/${scheduled.id}`}>Open meeting</Link>
        </div>
      </div>}
    </form>
  </section>;
}

