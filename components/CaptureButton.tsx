"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

function subscribeNoop() {
  return () => {};
}
function getMountedTrue() {
  return true;
}
function getMountedFalse() {
  return false;
}

type CaptureView = "menu" | "reminder" | "note";

const inputClasses =
  "w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20";

const menuButtonClasses =
  "w-full text-left rounded-xl border border-[var(--surface-border)] px-4 py-3 text-sm font-medium transition hover:border-indigo-400/40 hover:bg-indigo-400/5";

interface CaptureButtonProps {
  variant?: "sidebar" | "primary" | "panel";
  label?: string;
}

export default function CaptureButton({ variant = "primary", label = "Capture" }: CaptureButtonProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeNoop, getMountedTrue, getMountedFalse);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CaptureView>("menu");
  const [saving, setSaving] = useState(false);

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const reset = () => {
    setView("menu");
    setReminderTitle("");
    setReminderDate("");
    setNoteTitle("");
    setNoteBody("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const goTo = (path: string) => {
    close();
    router.push(path);
  };

  const saveReminder = async (e: FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderDate) return;
    setSaving(true);
    try {
      await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reminderTitle.trim(),
          remindAt: new Date(reminderDate).toISOString(),
        }),
      });
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: noteTitle.trim() || null, body: noteBody.trim() }),
      });
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const triggerClasses =
    variant === "sidebar"
      ? "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[15px] font-medium border border-dashed border-[var(--surface-border)] text-[var(--muted)] hover:border-indigo-400/40 hover:text-[var(--foreground)] transition shrink-0"
      : variant === "panel"
        ? "group flex w-full items-center gap-3 rounded-2xl px-5 py-5 text-left text-white brand-gradient-bg shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:shadow-xl"
        : "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold brand-gradient-bg text-white transition hover:opacity-90 shadow-lg shadow-indigo-500/20";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClasses}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={variant === "panel" ? "h-9 w-9 shrink-0 rounded-full border-2 border-white p-2" : "h-4 w-4 shrink-0"}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        {variant === "sidebar" && <span className="hidden md:inline">{label}</span>}
        {variant === "primary" && label}
        {variant === "panel" && (
          <span>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="mt-0.5 block text-xs font-normal text-white/80">
              Note, task, reminder, promise, or meeting
            </span>
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            onClick={close}
            role="presentation"
          >
          <div className="fixed inset-0 bg-[rgba(10,10,22,0.6)]" />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative surface-card rounded-2xl p-6 w-full max-w-sm shadow-xl shadow-indigo-500/20"
          >
            {view === "menu" && (
              <>
                <h2 className="text-lg font-semibold mb-4">Capture something</h2>
                <div className="space-y-2">
                  <button type="button" onClick={() => goTo("/meeting")} className={menuButtonClasses}>
                    Start meeting
                  </button>
                  <button type="button" onClick={() => goTo("/tasks")} className={menuButtonClasses}>
                    Add task
                  </button>
                  <button type="button" onClick={() => setView("reminder")} className={menuButtonClasses}>
                    Create reminder
                  </button>
                  <button type="button" onClick={() => setView("note")} className={menuButtonClasses}>
                    Add note
                  </button>
                  <button type="button" onClick={() => goTo("/documents")} className={menuButtonClasses}>
                    Upload document
                  </button>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition"
                >
                  Cancel
                </button>
              </>
            )}

            {view === "reminder" && (
              <form onSubmit={saveReminder} className="space-y-3">
                <h2 className="text-lg font-semibold mb-1">Create reminder</h2>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Remind me to…
                  </label>
                  <input
                    type="text"
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="Renew insurance"
                    className={inputClasses}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">When</label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving || !reminderTitle.trim() || !reminderDate}
                    className="brand-gradient-bg text-white font-medium py-2 px-4 rounded-xl transition hover:opacity-90 disabled:opacity-60 text-sm"
                  >
                    {saving ? "Saving…" : "Create reminder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("menu")}
                    className="text-sm font-medium text-[var(--muted)] hover:text-current transition px-2"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}

            {view === "note" && (
              <form onSubmit={saveNote} className="space-y-3">
                <h2 className="text-lg font-semibold mb-1">Add note</h2>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g. Restaurant Sarah recommended"
                    className={inputClasses}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Note</label>
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Anything worth remembering…"
                    rows={4}
                    className={inputClasses}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving || !noteBody.trim()}
                    className="brand-gradient-bg text-white font-medium py-2 px-4 rounded-xl transition hover:opacity-90 disabled:opacity-60 text-sm"
                  >
                    {saving ? "Saving…" : "Save note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("menu")}
                    className="text-sm font-medium text-[var(--muted)] hover:text-current transition px-2"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
          </div>,
          document.body
        )}
    </>
  );
}
