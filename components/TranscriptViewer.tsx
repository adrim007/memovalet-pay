"use client";

import { useState } from "react";

export default function TranscriptViewer({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);

  if (!transcript) return null;

  return (
    <div className="surface-card rounded-2xl p-6 md:p-7 shadow-xl shadow-indigo-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Full Transcript
        </h2>
        <span className="text-xs text-[var(--muted)]">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <p className="text-sm text-[var(--muted)] whitespace-pre-line leading-relaxed mt-4">
          {transcript}
        </p>
      )}
    </div>
  );
}
