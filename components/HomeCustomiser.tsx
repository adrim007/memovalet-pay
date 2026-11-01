"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal, X } from "@phosphor-icons/react";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_CARDS,
  moveCard,
  toggleCard,
  type HomeLayout,
  type HomeToggleId,
} from "@/lib/home-layout";

/**
 * "Customise" on the home page: show or hide each part, and move it up or down.
 * Changes show straight away; the page saves them.
 */
export default function HomeCustomiser({
  layout,
  onChange,
  saveError,
}: {
  layout: HomeLayout;
  onChange: (next: HomeLayout) => void;
  saveError?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = (id: HomeToggleId) => !layout.hidden.includes(id);
  const label = (id: string) => HOME_CARDS.find((card) => card.id === id)?.label ?? id;
  const isDefault =
    layout.hidden.length === 0 && layout.order.every((id, index) => id === DEFAULT_HOME_LAYOUT.order[index]);

  const toggle = (id: HomeToggleId, name: string) => (
    <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={shown(id)}
        onChange={(event) => onChange(toggleCard(layout, id, event.target.checked))}
        className="h-4 w-4 shrink-0 accent-indigo-600"
      />
      <span className={`truncate text-sm ${shown(id) ? "font-medium" : "text-[var(--muted)]"}`}>{name}</span>
    </label>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 text-sm font-semibold shadow-sm transition-colors hover:border-indigo-400"
      >
        <SlidersHorizontal size={18} aria-hidden />
        Customise
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Customise your home page"
          className="fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xl shadow-black/15 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Your home page</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => { setOpen(false); buttonRef.current?.focus(); }}
              className="-mr-2 grid size-11 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-border)]"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <p className="px-4 pt-3 text-xs text-[var(--muted)]">Tick what to show. Use the arrows to change the order.</p>

          <ul className="px-4 py-2" aria-label="Parts of the home page">
            <li className="flex items-center gap-2 border-b border-[var(--surface-border)] py-1">
              {toggle("weather", "Weather")}
              <span className="shrink-0 pr-1 text-[11px] text-[var(--muted)]">By the greeting</span>
            </li>
            {layout.order.map((id, index) => (
              <li key={id} className="flex items-center gap-1 border-b border-[var(--surface-border)] py-1 last:border-b-0">
                {toggle(id, label(id))}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onChange(moveCard(layout, id, -1))}
                  aria-label={`Move ${label(id)} up`}
                  className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-[var(--surface-border)] disabled:opacity-30"
                >
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={index === layout.order.length - 1}
                  onClick={() => onChange(moveCard(layout, id, 1))}
                  aria-label={`Move ${label(id)} down`}
                  className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-[var(--surface-border)] disabled:opacity-30"
                >
                  <ArrowDown size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--surface-border)] px-4 py-2">
            <p className="text-[11px] text-[var(--muted)]">{saveError || "Saved to your account as you go."}</p>
            <button
              type="button"
              disabled={isDefault}
              onClick={() => onChange(DEFAULT_HOME_LAYOUT)}
              className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium hover:bg-[var(--surface-border)] disabled:opacity-40"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
