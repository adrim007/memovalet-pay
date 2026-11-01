"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import { TaskAssignment } from "@/lib/types";
import { mapsUrl, handleMapsClick } from "@/lib/maps";
import { formatMoney } from "@/lib/money";
import { PRIORITY_CHIP, PRIORITY_LABEL } from "@/lib/priority";

export default function AssignedTaskClient({ assignment: initial }: { assignment: TaskAssignment }) {
  const [assignment, setAssignment] = useState(initial);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  const postUpdate = async () => {
    const text = updateText.trim();
    if (!text || postingUpdate) return;

    setPostingUpdate(true);
    try {
      const response = await fetch(`/api/task-assignments/${assignment.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: "recipient" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "failed");

      setAssignment(data.assignment);
      setUpdateText("");
    } catch {
      setError("Couldn't post that update. Try again.");
    } finally {
      setPostingUpdate(false);
    }
  };

  const markDone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("note", note);
      if (file) formData.set("file", file);

      const response = await fetch(`/api/task-assignments/${assignment.id}/complete`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "failed");
      }

      setAssignment(data.assignment);
    } catch {
      setError("Couldn't mark this done. Mind trying again?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-16 flex items-center justify-center">
      <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
      <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />
      <div className="relative surface-card rounded-2xl p-8 max-w-md w-full">
        <Logo size="md" href="/" />

        <p className="text-xs text-[var(--muted)] mt-6 mb-1">
          Task from {assignment.createdByEmail || "MemoValet"}
        </p>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-xl font-bold tracking-tight">{assignment.title}</h1>
          {assignment.priority && (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_CHIP[assignment.priority]}`}>
              {PRIORITY_LABEL[assignment.priority]} priority
            </span>
          )}
        </div>
        {assignment.description && (
          <p className="text-sm text-[var(--muted)] mb-2">{assignment.description}</p>
        )}
        {assignment.due_date && (
          <p className="text-xs text-[var(--muted)] mb-1">Due {assignment.due_date}</p>
        )}
        {assignment.location && (
          <a
            href={mapsUrl(assignment.location)}
            onClick={handleMapsClick(assignment.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 underline inline-block mb-4"
          >
            {assignment.location}
          </a>
        )}
        {!assignment.due_date && !assignment.location && <div className="mb-4" />}

        {assignment.notes.length > 0 && (
          <div className="space-y-1.5 mb-4 rounded-xl bg-black/5 dark:bg-white/5 px-3.5 py-3">
            {assignment.notes.map((n, i) => (
              <p key={i} className="text-xs text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">
                  {n.author === "recipient" ? "You" : "Sender"}:
                </span>{" "}
                {n.text}
              </p>
            ))}
          </div>
        )}

        {assignment.status !== "done" && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Add an update…"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") postUpdate();
              }}
              className="flex-1 rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-1.5 text-xs placeholder:text-[var(--muted)] outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={postUpdate}
              disabled={postingUpdate || !updateText.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--surface-border)] hover:border-indigo-400/40 disabled:opacity-60 shrink-0"
            >
              Post
            </button>
          </div>
        )}

        {assignment.status === "done" ? (
          <div className="rounded-xl bg-emerald-500/10 px-4 py-3 mt-4">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
              Marked done
            </p>
            {assignment.amount_cents ? (
              <p className="text-sm text-[var(--muted)] mb-1">
                {assignment.payment_status === "paid"
                  ? `Customer paid ${formatMoney(assignment.amount_cents, assignment.currency || "aud")}.`
                  : assignment.payment_status === "pending"
                    ? `Payment link for ${formatMoney(assignment.amount_cents, assignment.currency || "aud")} sent to the customer.`
                    : `The sender will send the customer a payment link for ${formatMoney(assignment.amount_cents, assignment.currency || "aud")}.`}
              </p>
            ) : null}
            {assignment.completion_note && (
              <p className="text-sm text-[var(--muted)]">{assignment.completion_note}</p>
            )}
            {assignment.completion_file_url && (
              <a
                href={assignment.completion_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-500 dark:text-indigo-400 hover:opacity-80 underline mt-1 inline-block"
              >
                View attachment
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={markDone} className="mt-4 space-y-2.5">
            {assignment.amount_cents ? (
              <p className="rounded-xl bg-indigo-500/10 px-3.5 py-2.5 text-xs text-indigo-700 dark:text-indigo-300">
                Marking this done sends the customer a payment link for{" "}
                <strong>{formatMoney(assignment.amount_cents, assignment.currency || "aud")}</strong>. Attach a photo of
                the finished job if you can.
              </p>
            ) : null}
            <textarea
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none focus:border-indigo-400 resize-none"
            />
            {/* Photos only, up to 10 MB: all the server takes from someone
                without an account (it goes to public storage). Offering video
                here let people pick one, fill everything in, and then be
                refused on "Mark as done". */}
            <label htmlFor="completion-photo" className="block text-xs font-medium text-[var(--muted)]">
              Attach a photo (optional, up to 10 MB)
            </label>
            <input
              id="completion-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-[var(--muted)]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full brand-gradient-bg text-white font-medium py-2.5 rounded-xl transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Mark as done"}
            </button>
            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
