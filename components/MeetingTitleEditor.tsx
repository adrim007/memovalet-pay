"use client";

import { useState } from "react";

export default function MeetingTitleEditor({
  meetingId,
  initialTitle,
}: {
  meetingId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) {
      setDraft(title);
      setEditing(false);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (response.ok) {
        setTitle(trimmed);
      } else {
        setDraft(title);
        setError("Couldn't save that title.");
      }
    } catch {
      setDraft(title);
      setError("Couldn't save that title.");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="text-2xl font-extrabold tracking-tight bg-transparent border-b border-indigo-400 outline-none w-full"
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        className="group flex items-center gap-2 text-left"
      >
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-4 w-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition shrink-0"
        >
          <path
            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}
