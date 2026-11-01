"use client";

import { useEffect, useRef, useState } from "react";
import { SerialSave } from "@/lib/serial-save";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";

export default function AutosaveNotes({ initial, endpoint, onSaved, placeholder, label = "Notes" }: {
  initial: string;
  endpoint: string;
  onSaved?: (notes: string) => void;
  placeholder: string;
  label?: string;
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queue] = useState(() => new SerialSave(initial, async notes => {
    const body = JSON.stringify({ notes });
    const response = await fetch(endpoint, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body, keepalive: new Blob([body]).size < 60000,
    });
    if (!response.ok) throw new Error("Notes were not saved");
    onSaved?.(notes);
  }));
  useUnsavedWarning(status === "pending" || status === "saving" || status === "error");
  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!queue.dirty && !queue.saving) { setStatus("saved"); return; }
    setStatus("saving");
    try {
      await queue.flush();
      if (mounted.current) setStatus(queue.dirty ? "pending" : "saved");
    } catch {
      if (mounted.current) setStatus("error");
    }
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      void queue.flush().catch(() => {});
    };
  }, [queue]);
  return <div>
    <textarea dir="auto" aria-label={label} value={value} onBlur={() => void flush()}
      onChange={event => {
        const next = event.target.value;
        setValue(next);
        queue.update(next);
        setStatus("pending");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 900);
      }}
      placeholder={placeholder}
      className="w-full min-h-32 rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 resize-y"
    />
    <div className="min-h-6 text-xs text-[var(--muted)]" role="status" aria-live="polite">
      {status === "pending" && "Unsaved changes"}
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
      {status === "error" && <span className="text-red-500">Couldn&apos;t save. Your text is still here. <button type="button" onClick={() => void flush()} className="underline font-semibold">Retry</button></span>}
    </div>
  </div>;
}
