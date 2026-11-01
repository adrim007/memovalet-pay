"use client";
import { FormEvent, useRef, useState } from "react";

const inputClass = "mt-1 block w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 text-base";
export default function CalendarCreate({ date, preview, onSaved }: { date: string; preview: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("task");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (preview) { setNotice("Preview only. In your workspace, this saves to the selected date."); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const endpoint = kind === "task" ? "commitments" : kind === "project" ? "projects" : "live";
      const response = await fetch(`/api/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ title: title.trim(), name: title.trim(), description: title.trim(), direction: "i_owe",
          dueDate: date, dueTime: time || null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          meetingType: "general", durationMinutes: 30 }),
      });
      const data = await response.json();
      if (!response.ok || !(data.commitment || data.project || data.session)) throw new Error(data.error || "Couldn't save this item. Please try again.");
      setTitle(""); setTime(""); setOpen(false); setNotice("Saved to your calendar."); onSaved(); trigger.current?.focus();
    } catch (err) { setError(err instanceof Error && err.name !== "TimeoutError" ? err.message : "Saving took too long. Please check your connection."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mt-4 border-t border-[var(--surface-border)] pt-4">
    <button ref={trigger} type="button" disabled={busy} aria-expanded={open} onClick={() => { setOpen(!open); setError(""); setNotice(""); }} className="min-h-11 w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{open ? "Close form" : "Create on this day"}</button>
    {open && <form onSubmit={save} className="mt-4 space-y-3" aria-label="Create a calendar item">
      <p className="text-sm font-semibold">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}</p>
      <label className="block text-sm">Create<select autoFocus disabled={busy} value={kind} onChange={e => setKind(e.target.value)} className={inputClass}><option value="task">Task</option><option value="meeting">Meeting</option><option value="project">Project deadline</option></select></label>
      <label className="block text-sm">Title<input required maxLength={200} disabled={busy} value={title} onChange={e => setTitle(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm">Time {kind === "meeting" ? "(required)" : "(optional)"}<input required={kind === "meeting"} type="time" disabled={busy} value={time} onChange={e => setTime(e.target.value)} className={inputClass} /></label>
      <p className="text-xs text-[var(--muted)]">{Intl.DateTimeFormat().resolvedOptions().timeZone}{kind === "meeting" ? ". Meeting duration is 30 minutes. You can invite people from Meetings after saving." : ". Leave time blank for an all day deadline."}</p>
      <button disabled={busy || !title.trim()} className="min-h-11 w-full rounded-xl border border-indigo-400 px-3 py-2 text-sm font-semibold">{busy ? "Saving…" : preview ? "Preview save" : "Save to calendar"}</button>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-[var(--muted)]">{notice}</p>}
  </div>;
}
