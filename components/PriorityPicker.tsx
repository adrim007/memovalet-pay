"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AnchoredOverlay from "@/components/AnchoredOverlay";
import {
  PRIORITIES,
  PRIORITY_CHIP,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  type Priority,
  type PriorityKind,
} from "@/lib/priority";

/**
 * Sets how urgent one thing is. Shows the level when there is one and stays out
 * of the way when there isn't, since most things are never marked.
 */
export default function PriorityPicker({
  kind,
  id,
  value,
  name,
  onChanged,
}: {
  kind: PriorityKind;
  id: string;
  value: Priority | null | undefined;
  /** Its title, for the screen reader — a row of these is otherwise identical. */
  name: string;
  /** For pages holding their own list; otherwise the page is refreshed. */
  onChanged?: (priority: Priority | null) => void;
}) {
  const router = useRouter();
  const [level, setLevel] = useState<Priority | null>(value ?? null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The page can hand down a newer level than the one being shown — after a
  // refresh, or another tab. Taking it during render rather than in an effect
  // avoids rendering the stale one first and then correcting it.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setLevel(value ?? null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const choose = async (next: Priority | null) => {
    const previous = level;
    setLevel(next);
    setOpen(false);
    setFailed(false);
    try {
      const response = await fetch("/api/items/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, priority: next }),
      });
      if (!response.ok) throw new Error("priority failed");
      if (onChanged) onChanged(next);
      else router.refresh();
    } catch {
      setLevel(previous);
      setFailed(true);
    }
  };

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setOpen((value) => !value);
        }}
        aria-label={`Priority for ${name}`}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
          level
            ? PRIORITY_CHIP[level]
            : "border border-[var(--surface-border)] text-[var(--muted)] hover:border-indigo-400/40 hover:text-[var(--foreground)]"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${level ? PRIORITY_DOT[level] : "bg-[var(--surface-border)]"}`} />
        {level ? PRIORITY_LABEL[level] : "Priority"}
      </button>

      <AnchoredOverlay
        open={open}
        anchorRef={box}
        panelRef={panel}
        className="w-40 rounded-xl bg-[var(--surface)] p-1 shadow-xl shadow-indigo-500/10 ring-1 ring-[var(--surface-border)]"
      >
        <div
          role="menu"
          aria-label={`Set priority for ${name}`}
        >
          {PRIORITIES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={level === option}
              onClick={() => void choose(option)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                level === option ? "font-semibold" : ""
              } hover:bg-indigo-500/10`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[option]}`} />
              {PRIORITY_LABEL[option]}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--surface-border)]" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!level}
            onClick={() => void choose(null)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--muted)] transition hover:bg-indigo-500/10"
          >
            <span className="h-2 w-2 shrink-0 rounded-full border border-[var(--surface-border)]" />
            None
          </button>
        </div>
      </AnchoredOverlay>

      <AnchoredOverlay
        open={failed && !open}
        anchorRef={box}
        panelRef={panel}
        className="w-44 rounded-lg bg-[var(--surface)] px-2.5 py-2 text-xs text-red-600 shadow-lg ring-1 ring-[var(--surface-border)] dark:text-red-400"
      >
        <p role="alert">
          Couldn&apos;t save that. Try again.
        </p>
      </AnchoredOverlay>
    </div>
  );
}
