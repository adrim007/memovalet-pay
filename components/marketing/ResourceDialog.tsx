"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowRight, X } from "@phosphor-icons/react";
import Link from "next/link";
import type { ResourceCategory, ResourceDetail } from "@/lib/marketing-resources";
import ResourceDetailBody from "./ResourceDetailBody";

export interface ResourceDialogItem {
  slug: string;
  category: ResourceCategory;
  title: string;
  body: string;
  detail: ResourceDetail;
}

// Reading a resource shouldn't cost you your place in the library. This
// opens the whole thing over the page and closes on X, Escape, or a click
// outside, putting you straight back where you were.
export default function ResourceDialog({
  resource,
  onClose,
}: {
  resource: ResourceDialogItem;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    // Stop the page behind from scrolling while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleKey]);

  const { detail } = resource;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm sm:px-6 sm:py-12"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-dialog-title"
        className="mk-dark relative w-full max-w-3xl rounded-3xl border border-white/12 bg-[#140f2b] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)] sm:p-9"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/12 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X size={18} weight="bold" />
        </button>

        <span className="inline-flex items-center rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
          {resource.category}
        </span>

        <h2
          id="resource-dialog-title"
          className="mt-5 pr-10 font-display text-2xl font-light leading-tight tracking-[-0.04em] text-white sm:text-4xl"
        >
          {resource.title}
        </h2>
        <p className="mt-4 text-base leading-8 text-white/62">{resource.body}</p>

        <div className="mt-8">
          <ResourceDetailBody detail={detail} />
        </div>

        {/* The X, Escape and a click outside all close this, so the footer
            carries the one action worth taking instead of a second Close. */}
        <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-6">
          <Link
            href="/login"
            className="mk-glow-btn inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
          >
            Get started free <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </div>
    </div>
  );
}
