"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AttentionItem, AttentionType } from "@/lib/types";

const STYLE_BY_TYPE: Record<AttentionType, { dot: string }> = {
  commitment_overdue_they_owe: { dot: "bg-red-500" },
  commitment_due_i_owe: { dot: "bg-orange-500" },
  task_overdue: { dot: "bg-orange-500" },
  task_due_today: { dot: "bg-amber-400" },
  reminder_due: { dot: "bg-blue-400" },
  meeting_today: { dot: "bg-blue-400" },
};

function openHref(item: AttentionItem): string {
  if (item.sourceType === "commitment") {
    return item.type === "commitment_overdue_they_owe" ? "/tasks?tab=waiting-on" : "/tasks?tab=i-owe";
  }
  return "/tasks";
}

export default function NeedsAttention({ items: initialItems }: { items: AttentionItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const dismiss = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const complete = async (item: AttentionItem) => {
    setPendingId(item.id);
    try {
      if (item.sourceType === "action_item") {
        await fetch(`/api/action-items/${item.sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
      } else if (item.sourceType === "commitment") {
        await fetch(`/api/commitments/${item.sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
      } else if (item.sourceType === "reminder") {
        await fetch(`/api/reminders/${item.sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
      }
      dismiss(item.id);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const remind = async (item: AttentionItem) => {
    setPendingId(item.id);
    try {
      if (item.sourceType === "task_assignment") {
        await fetch(`/api/task-assignments/${item.sourceId}/remind`, { method: "POST" });
      }
      dismiss(item.id);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="mb-8" aria-labelledby="briefing-heading">
      <h2 id="briefing-heading" className="mb-3 text-lg font-semibold">
        Today&apos;s briefing
      </h2>

      <div className="surface-card overflow-hidden rounded-2xl px-5">
        {items.map((item) => {
          const style = STYLE_BY_TYPE[item.type];
          const busy = pendingId === item.id;

          return (
            <div
              key={item.id}
              className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 border-b border-[var(--surface-border)] py-4 last:border-b-0 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-400/10 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                {(item.relatedPerson || item.title).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-[var(--muted)] mt-0.5">{item.description}</p>
                )}
              </div>
              <div className="col-start-3 flex flex-wrap items-center gap-2 sm:col-start-4 sm:row-start-1 sm:shrink-0">
                {item.availableActions.includes("remind") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remind(item)}
                    className="rounded-xl brand-gradient-bg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Remind
                  </button>
                )}
                {item.availableActions.includes("complete") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => complete(item)}
                    className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold transition hover:border-emerald-400/40 hover:bg-emerald-400/5 disabled:opacity-50"
                  >
                    Mark done
                  </button>
                )}
                {item.availableActions.includes("open") && (
                  <Link
                    href={openHref(item)}
                    className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
                  >
                    Review
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
