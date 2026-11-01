"use client";

import {
  ArrowRight,
  ChartBar,
  CalendarBlank,
  ChatCenteredText,
  CheckCircle,
  FileText,
  PaperPlaneTilt,
  Translate,
  X,
} from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

const featureIcons = {
  planning: CalendarBlank,
  conversations: ChatCenteredText,
  translation: Translate,
  summaries: ChatCenteredText,
  actions: CheckCircle,
  sharing: PaperPlaneTilt,
  documents: FileText,
  insights: ChartBar,
};

export type ExpandableFeature = {
  key: keyof typeof featureIcons;
  title: string;
  body: string;
  detail: string;
  bullets: string[];
};

type ExpandableFeatureGridProps = {
  items: ExpandableFeature[];
};

export default function ExpandableFeatureGrid({ items }: ExpandableFeatureGridProps) {
  const [activeKey, setActiveKey] = useState<ExpandableFeature["key"] | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const activeItem = items.find((item) => item.key === activeKey) ?? null;

  const closeDialog = () => {
    setActiveKey(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!activeItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
        return;
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeItem]);

  return (
    <>
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = featureIcons[item.key];
          return (
            <button
              key={item.key}
              type="button"
              className="memo-feature-card group text-left"
              aria-haspopup="dialog"
              aria-expanded={activeKey === item.key}
              onClick={(event) => {
                lastTriggerRef.current = event.currentTarget;
                setActiveKey(item.key);
              }}
            >
              <span className="memo-feature-icon">
                <Icon size={28} weight="duotone" />
              </span>
              <span className="mt-7 block text-xl font-semibold leading-snug text-white">
                {item.title}
              </span>
              <span className="mt-3 block text-base leading-7 text-white/62">{item.body}</span>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#b9a8ff] transition group-hover:text-white">
                Read more
                <ArrowRight size={16} weight="bold" />
              </span>
            </button>
          );
        })}
      </div>

      {activeItem ? (
        <div
          className="memo-feature-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            ref={dialogRef}
            className="memo-feature-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            aria-describedby={`${dialogId}-description`}
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="memo-feature-dialog-close"
              aria-label="Close feature details"
              onClick={closeDialog}
            >
              <X size={20} weight="bold" />
            </button>

            {(() => {
              const Icon = featureIcons[activeItem.key];
              return (
                <span className="memo-feature-icon">
                  <Icon size={30} weight="duotone" />
                </span>
              );
            })()}
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#a98aff]">
              MemoValet feature
            </p>
            <h3
              id={`${dialogId}-title`}
              className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl"
            >
              {activeItem.title}
            </h3>
            <p id={`${dialogId}-description`} className="mt-5 text-base leading-7 text-white/70 sm:text-lg">
              {activeItem.detail}
            </p>
            <ul className="mt-7 space-y-3">
              {activeItem.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-sm leading-6 text-white/74 sm:text-base">
                  <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[#8f76ff]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="mk-glow-btn mt-8 min-h-12 rounded-full px-7 text-sm font-semibold text-white" onClick={closeDialog}>
              Got it
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
