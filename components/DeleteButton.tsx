"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import AnchoredOverlay from "@/components/AnchoredOverlay";
import type { DeletableKind } from "@/lib/deletion";

/**
 * Deletes one thing, asking first. The confirm opens right where the button is,
 * because in a list of similar-looking rows a dialog in the middle of the screen
 * doesn't tell you which one you're about to lose.
 *
 * After it works: `onDeleted` if the page keeps its own list in state, otherwise
 * `goTo` when the page you're on is about to stop existing, otherwise a refresh.
 */
export default function DeleteButton({
  kind,
  id,
  noun,
  name,
  detail,
  label,
  goTo,
  onDeleted,
  className,
  icon,
}: {
  kind: DeletableKind;
  id: string;
  /** What this is, in the words the app uses: "meeting", "project", "person". */
  noun: string;
  /** Its title, so the confirm names the exact row. */
  name: string;
  /** A sentence about what else goes — or stays — when that isn't obvious. */
  detail?: string;
  /** Text next to the icon. Leave it out for an icon-only button in a row. */
  label?: string;
  goTo?: string;
  onDeleted?: () => void;
  className?: string;
  icon?: ReactNode;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!asking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAsking(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !panel.current?.contains(target)) setAsking(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [asking]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/items/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      if (!response.ok) throw new Error("delete failed");
      setAsking(false);
      if (onDeleted) onDeleted();
      else if (goTo) router.push(goTo);
      router.refresh();
    } catch {
      setError("Couldn't delete that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label={label ? undefined : `Delete ${name}`}
        aria-expanded={asking}
        onClick={() => setAsking((open) => !open)}
        className={
          className ??
          (label
            ? "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--surface-border)] px-3.5 py-2 text-sm font-medium text-red-600 transition hover:border-red-400/40 hover:bg-red-500/5 dark:text-red-400"
            : "grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400")
        }
      >
        {icon ?? <Trash size={label ? 16 : 15} />}
        {label}
      </button>

      <AnchoredOverlay
        open={asking}
        anchorRef={box}
        panelRef={panel}
        className="w-64 rounded-xl bg-[var(--surface)] p-3 text-left shadow-xl shadow-indigo-500/10 ring-1 ring-[var(--surface-border)]"
      >
        <div
          role="dialog"
          aria-label={`Delete ${name}?`}
        >
          <p className="text-sm font-semibold">Delete this {noun}?</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            “{name}” will be gone for good.{detail ? ` ${detail}` : ""}
          </p>
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--background)]"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </AnchoredOverlay>
    </div>
  );
}
