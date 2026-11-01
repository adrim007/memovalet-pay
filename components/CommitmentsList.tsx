"use client";

import { FormEvent, useRef, useState } from "react";
import { Commitment, CommitmentDirection } from "@/lib/types";
import { dateKey } from "@/lib/work-calendar";
import DeleteButton from "@/components/DeleteButton";
import PriorityPicker from "@/components/PriorityPicker";
import { commitmentHeading } from "@/lib/commitment-text";
import { matchesWorkFilter, type WorkFilter } from "@/lib/work-filter";

const inputClasses = "w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400";
const buttonClasses = "min-h-10 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm font-medium disabled:opacity-50";

export default function CommitmentsList({ direction, commitments: initialCommitments, filter, onChange, defaultFilter = "open" }: {
  direction: CommitmentDirection; commitments: Commitment[]; filter?: WorkFilter; defaultFilter?: WorkFilter; onChange?: (items: Commitment[]) => void;
}) {
  const [localItems, setLocalItems] = useState(initialCommitments);
  const commitments = onChange ? initialCommitments : localItems;
  const [localFilter, setLocalFilter] = useState<WorkFilter>(defaultFilter);
  const selectedFilter = filter ?? localFilter;
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [personName, setPersonName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [reminderLocal, setReminderLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isWaitingOn = direction === "they_owe";
  const visible = commitments.filter(c => matchesWorkFilter(selectedFilter, c.status, c.due_date, c.due_at));
  const change = (items: Commitment[]) => { setLocalItems(items); onChange?.(items); };
  const reset = () => { setShowForm(false); setEditing(null); setDescription(""); setPersonName(""); setDueDate(""); setDueTime(""); setReminderLocal(""); };
  const startEdit = (c: Commitment) => {
    setEditing(c.id); setDescription(c.description); setPersonName(c.person_name || "");
    const at = c.due_at ? new Date(c.due_at) : null;
    setDueDate(at ? dateKey(at) : c.due_date || "");
    setDueTime(at ? `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}` : "");
    const reminder = c.reminder_at ? new Date(c.reminder_at) : null;
    setReminderLocal(reminder ? `${dateKey(reminder)}T${String(reminder.getHours()).padStart(2, "0")}:${String(reminder.getMinutes()).padStart(2, "0")}` : "");
    setShowForm(true); setError(""); setNotice("");
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(editing ? `/api/commitments/${editing}` : "/api/commitments", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ reminderLocal: reminderLocal || null, description: description.trim(), personName: personName.trim() || null, direction,
          dueDate: dueDate || null, dueTime: dueTime || null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await response.json();
      if (!response.ok || !data.commitment) throw new Error(data.error || "Couldn't save this task. Please try again.");
      change(editing ? commitments.map(c => c.id === editing ? data.commitment : c) : [data.commitment, ...commitments]);
      reset(); setNotice("Your task is saved.");
    } catch (err) { setError(err instanceof Error && err.name !== "TimeoutError" ? err.message : "Saving took too long. Check your connection and try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function updateStatus(c: Commitment) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    const status = c.status === "pending" ? "completed" : "pending";
    try {
      const response = await fetch(`/api/commitments/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000), body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok || !data.commitment) throw new Error(data.error || "Couldn't update this task. Please try again.");
      change(commitments.map(other => other.id === c.id ? data.commitment : other));
      setNotice(status === "completed" ? "Task completed. You can find it in Done." : "Task reopened. You can find it in Open.");
    } catch { setError("Couldn't save that change. Your task has not changed. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--muted)]">{isWaitingOn ? "Things other people promised you." : "Your tasks and things you promised other people."}</p>
      <button type="button" disabled={busy} className={buttonClasses} onClick={() => { if (showForm) reset(); else { reset(); setShowForm(true); setError(""); } }}>{showForm ? "Cancel" : isWaitingOn ? "Track something" : "Add a task"}</button>
    </div>
    {filter === undefined && <div className="mb-4 flex gap-2" role="group" aria-label="Filter personal tasks">
      {(["open", "overdue", "done"] as const).map(value => <button key={value} type="button" aria-pressed={selectedFilter === value} onClick={() => setLocalFilter(value)} className={`${buttonClasses} ${selectedFilter === value ? "brand-gradient-bg text-white" : ""}`}>{value === "open" ? "Open" : value === "overdue" ? "Overdue" : "Done"}</button>)}
    </div>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {showForm && <form onSubmit={save} className="surface-card mb-5 space-y-4 rounded-2xl p-4">
      <h3 className="font-semibold">{editing ? "Edit task" : "New task"}</h3>
      <label className="block text-sm">What needs to be done?<input autoFocus required maxLength={2000} disabled={busy} value={description} onChange={e => setDescription(e.target.value)} className={inputClasses} /></label>
      <label className="block text-sm">{isWaitingOn ? "Person responsible" : "Person involved (optional)"}<input required={isWaitingOn} maxLength={200} disabled={busy} value={personName} onChange={e => setPersonName(e.target.value)} className={inputClasses} /></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">Due date (optional)<input type="date" disabled={busy} value={dueDate} onChange={e => { setDueDate(e.target.value); if (!e.target.value) setDueTime(""); }} className={inputClasses} /></label>
        <label className="block text-sm">Time (optional)<input type="time" disabled={busy || !dueDate} value={dueTime} onChange={e => setDueTime(e.target.value)} className={inputClasses} /></label>
      </div>
      <label className="block text-sm">Remind me (optional)<input type="datetime-local" disabled={busy} value={reminderLocal} onChange={e => setReminderLocal(e.target.value)} className={inputClasses} /></label>
      <p className="text-xs text-[var(--muted)]">Times use your current timezone. Choose a separate reminder time to receive an email and a notification, subject to your notification preferences.</p>
      <button disabled={busy || !description.trim()} className={`${buttonClasses} brand-gradient-bg text-white`}>{busy ? "Saving…" : "Save task"}</button>
    </form>}
    {!visible.length ? <p className="surface-card rounded-2xl p-5 text-sm text-[var(--muted)]">{selectedFilter === "done" ? "No completed tasks yet." : selectedFilter === "overdue" ? "No overdue tasks." : "No open tasks."}</p> : <div className="space-y-3">{visible.map(c => <div key={c.id} id={`commitment-${c.id}`} className="surface-card rounded-2xl p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          {commitmentHeading(c) && <p className="text-xs text-[var(--muted)]">{commitmentHeading(c)}</p>}
          <p className={`break-words text-sm font-semibold ${c.status === "completed" ? "line-through" : ""}`}>{c.description}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{c.due_at ? new Date(c.due_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : c.due_date || "No date set"}</p>
          {c.reminder_at && <p className="mt-1 text-xs text-[var(--muted)]">Reminder: {new Date(c.reminder_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>}
          {matchesWorkFilter("overdue", c.status, c.due_date, c.due_at) && <span className="text-xs text-rose-600">Overdue</span>}
        </div>
        <PriorityPicker kind="commitment" id={c.id} value={c.priority} name={c.description} onChanged={priority => change(commitments.map(other => other.id === c.id ? { ...other, priority } : other))} />
        <button type="button" disabled={busy} className={buttonClasses} onClick={() => startEdit(c)}>Edit</button>
        <button type="button" disabled={busy} className={buttonClasses} onClick={() => void updateStatus(c)}>{c.status === "pending" ? "Mark done" : "Reopen"}</button>
        <DeleteButton kind="commitment" id={c.id} noun="task" name={c.description} onDeleted={() => change(commitments.filter(other => other.id !== c.id))} />
      </div>
    </div>)}</div>}
  </div>;
}
