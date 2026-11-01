"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import CommitmentsList from "@/components/CommitmentsList";
import DeleteButton from "@/components/DeleteButton";
import PageHeader from "@/components/PageHeader";
import PriorityPicker from "@/components/PriorityPicker";
import { ActionItemRecord, Commitment, TaskAssignment } from "@/lib/types";
import { mapsUrl, handleMapsClick } from "@/lib/maps";
import { useIsPersonal } from "@/lib/account-type-context";

// Both are secondary to the task list itself (a form card, and a detail
// editor only shown once a row is expanded) — splitting them out keeps
// this page's server bundle light, the same fix that solved the cold-start
// lag on Home by lazy-loading its heaviest sub-component.
const TaskDetailsEditor = dynamic(() => import("@/components/TaskDetailsEditor"), { ssr: false });
const SendTaskSection = dynamic(() => import("@/components/SendTaskSection"), {
  ssr: false,
  loading: () => (
    <div className="surface-card rounded-2xl p-6 mb-6 h-24 animate-pulse" />
  ),
});

function subscribeNoop() {
  return () => {};
}

function getMountedTrue() {
  return true;
}

function getMountedFalse() {
  return false;
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// A manual, locale-independent formatter — toLocaleString() can resolve
// differently between Node's server-side ICU and the browser's locale,
// which produces a hydration mismatch since this renders from server props.
function formatReminder(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours24 < 12 ? "AM" : "PM";
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${hours12}:${minutes} ${ampm}`;
}

function isOverdue(item: ActionItemRecord): boolean {
  if (!item.due_date || item.status === "done") return false;
  const due = new Date(/^\d{4}-\d{2}-\d{2}$/.test(item.due_date) ? `${item.due_date}T00:00:00` : item.due_date);
  if (isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

type TasksView = "tasks" | "i-owe" | "waiting-on";

export default function TasksClient({
  items: initialItems,
  assignments,
  iOwe: initialIOwe,
  theyOwe: initialTheyOwe,
}: {
  items: ActionItemRecord[];
  assignments: TaskAssignment[];
  iOwe: Commitment[];
  theyOwe: Commitment[];
}) {
  const [iOwe, setIOwe] = useState(initialIOwe);
  const [theyOwe, setTheyOwe] = useState(initialTheyOwe);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [view, setView] = useState<TasksView>(
    initialTab === "i-owe" || initialTab === "waiting-on" ? initialTab : "tasks"
  );

  const [items, setItems] = useState(initialItems);
  const personal = useIsPersonal();
  const requestedTask = initialItems.find((item) => item.id === searchParams.get("task"));
  const [filter, setFilter] = useState<"open" | "overdue" | "done">(requestedTask?.status === "done" ? "done" : "open");
  const pendingStatusRef = useRef(new Set<string>());
  const [pendingStatus, setPendingStatus] = useState(new Set<string>());
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindedId, setRemindedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(requestedTask?.id ?? null);
  // Reminder times are formatted in the viewer's local timezone, which can
  // differ from the server's — only render that text after mount so the SSR
  // pass and first client render always agree (empty), avoiding a hydration
  // mismatch, then it fills in immediately after.
  const mounted = useSyncExternalStore(subscribeNoop, getMountedTrue, getMountedFalse);

  const updateItem = (id: string, patch: Partial<ActionItemRecord>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const forgetItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const toggleStatus = async (item: ActionItemRecord) => {
    if (pendingStatusRef.current.has(item.id)) return;
    pendingStatusRef.current.add(item.id);
    setPendingStatus(new Set(pendingStatusRef.current));
    setError("");
    const nextStatus = item.status === "done" ? "todo" : "done";

    try {
      const response = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Task update failed");
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)));
    } catch {
      setError("Couldn't save that change. Your task hasn't changed. Please try again.");
    } finally {
      pendingStatusRef.current.delete(item.id);
      setPendingStatus(new Set(pendingStatusRef.current));
    }
  };

  const sendReminder = async (item: ActionItemRecord) => {
    setRemindingId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/action-items/${item.id}/remind`, { method: "POST" });
      if (!response.ok) throw new Error("failed");
      setRemindedId(item.id);
      setTimeout(() => setRemindedId(null), 3000);
    } catch {
      setError("Couldn't send that reminder. Is your Google account connected?");
    } finally {
      setRemindingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "done") return items.filter((i) => i.status === "done");
    if (filter === "overdue") return items.filter((i) => isOverdue(i));
    return items.filter((i) => i.status === "todo");
  }, [items, filter]);


  return (
    <div className="relative mx-auto max-w-5xl">
      <div
        className="pointer-events-none absolute -top-16 -left-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-from), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -top-8 -right-16 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-to), transparent 70%)" }}
      />

      <div className="relative">
        <PageHeader
          title={personal ? "Tasks" : "Work"}
          subtitle={
            personal
              ? "Things to get done, errands to hand to someone else, and what's coming back to you."
              : "Jobs you sent, jobs you owe, and what's waiting on someone else."
          }
        />

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: "tasks" as const, label: "My tasks" },
            { key: "i-owe" as const, label: `I owe${iOwe.filter((c) => c.status === "pending").length ? ` (${iOwe.filter((c) => c.status === "pending").length})` : ""}` },
            { key: "waiting-on" as const, label: `Waiting on${theyOwe.filter((c) => c.status === "pending").length ? ` (${theyOwe.filter((c) => c.status === "pending").length})` : ""}` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={view === tab.key}
              onClick={() => setView(tab.key)}
              className={`text-sm font-medium px-3.5 py-2 rounded-xl transition shrink-0 ${
                view === tab.key
                  ? "brand-gradient-bg text-white shadow-lg shadow-indigo-500/25"
                  : "surface-card text-[var(--muted)] hover:bg-indigo-400/5 hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {view === "i-owe" && <CommitmentsList direction="i_owe" commitments={iOwe} onChange={setIOwe} defaultFilter={searchParams.get("status") === "done" ? "done" : "open"} />}
        {view === "waiting-on" && <CommitmentsList direction="they_owe" commitments={theyOwe} onChange={setTheyOwe} defaultFilter={searchParams.get("status") === "done" ? "done" : "open"} />}

        {view === "tasks" && (
        <>
        <div className="flex gap-2 mb-6">
          {[
            { key: "open" as const, label: "Open" },
            {
              key: "overdue" as const,
              label: "Overdue",
            },
            { key: "done" as const, label: "Done" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`text-sm font-medium px-3.5 py-2 rounded-xl transition ${
                filter === tab.key
                  ? "brand-gradient-bg text-white shadow-lg shadow-indigo-500/25"
                  : "surface-card text-[var(--muted)] hover:bg-indigo-400/5 hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section aria-label="Personal tasks" className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Your personal tasks</h2>
          <CommitmentsList direction="i_owe" commitments={iOwe} onChange={setIOwe} filter={filter} />
        </section>
        <SendTaskSection
          assignments={assignments}
          filter={filter}
          initiallyOpen={assignments.length === 0 && items.length === 0}
        />

        <h2 className="mb-3 text-lg font-semibold">Meeting actions</h2>
        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="surface-card dashed-card rounded-2xl p-10 text-center">
            <p className="font-medium mb-1">Nothing here</p>
            <p className="text-sm text-[var(--muted)]">
              {filter === "done"
                ? "Completed meeting actions will appear here."
                : filter === "overdue"
                  ? "Nothing is overdue. MemoValet will surface slipping promises here."
                  : "Create a task above or finish a meeting to bring its action items here."}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((item) => {
            const overdue = isOverdue(item);
            const expanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                id={`task-${item.id}`}
                className={`surface-card scroll-mt-24 rounded-2xl px-4 py-3.5 shadow-lg shadow-indigo-500/5 transition target:ring-2 target:ring-indigo-400 hover:-translate-y-0.5 hover:shadow-indigo-500/15 ${
                  overdue ? "border-rose-500/30" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <button
                    onClick={() => toggleStatus(item)}
                    disabled={pendingStatus.has(item.id)}
                    aria-busy={pendingStatus.has(item.id)}
                    className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition ${
                      item.status === "done"
                        ? "brand-gradient-bg border-transparent"
                        : "border-[var(--surface-border)] hover:border-indigo-400"
                    }`}
                    aria-label="Toggle done"
                  >
                    {item.status === "done" && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        className="h-3 w-3"
                      >
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {item.owner && <Avatar name={item.owner} size="xs" />}

                  <div className="min-w-0 flex-1 basis-[calc(100%-4.5rem)] sm:basis-auto">
                    <p
                      className={`text-sm font-medium truncate ${item.status === "done" ? "line-through text-[var(--muted)]" : ""}`}
                    >
                      {item.task}
                    </p>
                    <p className="text-xs text-[var(--muted)] truncate">
                      {item.meeting_title}
                      {item.owner ? ` · ${item.owner}` : ""}
                      {item.due_date ? ` · due ${item.due_date}` : ""}
                    </p>
                  </div>

                  <div className="ml-8 flex w-full flex-wrap items-center justify-end gap-2 sm:ml-0 sm:w-auto sm:flex-nowrap">
                    <PriorityPicker
                      kind="task"
                      id={item.id}
                      value={item.priority}
                      name={item.task}
                      onChanged={(priority) => updateItem(item.id, { priority })}
                    />

                    {overdue && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 shrink-0">
                        Overdue
                      </span>
                    )}

                    {item.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => sendReminder(item)}
                        disabled={remindingId === item.id}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--surface-border)] text-[var(--muted)] hover:border-indigo-400/40 hover:bg-indigo-400/5 hover:text-[var(--foreground)] transition disabled:opacity-60 shrink-0"
                      >
                        {remindingId === item.id
                          ? "Sending…"
                          : remindedId === item.id
                            ? "Sent ✓"
                            : "Remind me"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition shrink-0"
                      aria-label={expanded ? "Hide details" : "Show details"}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    <DeleteButton
                      kind="task"
                      id={item.id}
                      noun="task"
                      name={item.task}
                      detail="The meeting it came from stays."
                      onDeleted={() => forgetItem(item.id)}
                    />
                  </div>
                </div>

                {(item.location || item.reminder_at || item.photo_url) && !expanded && (
                  <p className="text-xs text-[var(--muted)] mt-1.5 pl-8 truncate">
                    {item.location && (
                      <a
                        href={mapsUrl(item.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMapsClick(item.location as string)(e);
                        }}
                        className="text-indigo-500 dark:text-indigo-400 hover:opacity-80 underline"
                      >
                        {item.location}
                      </a>
                    )}
                    {[
                      item.reminder_at && mounted
                        ? `reminder ${formatReminder(item.reminder_at)}`
                        : null,
                      item.photo_url ? "photo attached" : null,
                    ]
                      .filter(Boolean)
                      .map((text, i) => (
                        <span key={i}>
                          {(item.location || i > 0) && " · "}
                          {text}
                        </span>
                      ))}
                  </p>
                )}

                {expanded && (
                  <TaskDetailsEditor item={item} onUpdate={(patch) => updateItem(item.id, patch)} />
                )}
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
