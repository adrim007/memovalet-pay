"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Check,
  DotsThree,
  FileText,
  FolderSimple,
  Lightning,
  MagnifyingGlass,
  NotePencil,
  Plus,
  Trash,
  Tray,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import { groupByPriority, groupByTimeline, spaceAndDescendants, spaceColor } from "@/lib/library";
import { PRIORITIES, PRIORITY_CHIP, PRIORITY_DOT, PRIORITY_LABEL, priorityRank, type Priority } from "@/lib/priority";
import type { LibraryItem, LibraryItemKind, LibrarySpace } from "@/lib/types";

type View = { type: "all" } | { type: "space"; id: string } | { type: "unfiled" } | { type: "follow-up" } | { type: "priority" };
type KindFilter = "all" | LibraryItemKind;

const KIND = {
  meeting: { label: "Meetings", singular: "Meeting", icon: VideoCamera, tint: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" },
  file: { label: "Files", singular: "File", icon: FileText, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  note: { label: "Notes", singular: "Note", icon: NotePencil, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
} as const;

const railHeading = "px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]";

function subscribeNoop() {
  return () => {};
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatWhen(iso: string, now: Date) {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString() || date.toDateString() === yesterday.toDateString()) {
    return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function RailButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${
        active
          ? "bg-[var(--surface)] font-semibold shadow-sm ring-1 ring-[var(--surface-border)]"
          : "text-[var(--muted)] hover:bg-indigo-500/5 hover:text-[var(--foreground)]"
      }`}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-[var(--muted)]">{count}</span>
    </button>
  );
}

function ItemMenu({
  item,
  spaces,
  onMove,
  onMark,
  onDelete,
  confirming,
  onAskDelete,
  onCancelDelete,
}: {
  item: LibraryItem;
  spaces: LibrarySpace[];
  onMove: (folderId: string | null) => void;
  onMark: (priority: Priority | null) => void;
  onDelete: () => void;
  confirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}) {
  // Deleting can't be undone, so the confirm happens right here rather than
  // one click away from a list where rows look alike.
  if (confirming) {
    return (
      <div
        role="menu"
        aria-label={`Delete ${item.title}?`}
        className="absolute right-0 top-9 z-20 w-64 rounded-xl bg-[var(--surface)] p-3 shadow-xl shadow-indigo-500/10 ring-1 ring-[var(--surface-border)]"
      >
        <p className="text-sm font-semibold">Delete this {KIND[item.kind].singular.toLowerCase()}?</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          “{item.title}” and anything only it holds
          {item.kind === "meeting" ? ", including its recording, summary and action items," : ""} will be gone for good.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            role="menuitem"
            onClick={onCancelDelete}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--background)]"
          >
            Keep it
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="menu"
      aria-label={`Actions for ${item.title}`}
      className="absolute right-0 top-9 z-20 w-56 rounded-xl bg-[var(--surface)] p-1 shadow-xl shadow-indigo-500/10 ring-1 ring-[var(--surface-border)]"
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Priority</p>
      <div className="flex gap-1 px-2 pb-2">
        {PRIORITIES.map((level) => (
          <button
            key={level}
            type="button"
            role="menuitemradio"
            onClick={() => onMark(item.priority === level ? null : level)}
            aria-checked={item.priority === level}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              item.priority === level ? PRIORITY_CHIP[level] : "text-[var(--muted)] hover:bg-indigo-500/10"
            }`}
          >
            {PRIORITY_LABEL[level]}
          </button>
        ))}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={!item.priority}
          onClick={() => onMark(null)}
          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-indigo-500/10"
        >
          None
        </button>
      </div>
      <div className="my-1 h-px bg-[var(--surface-border)]" />
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Move to</p>
      {spaces.length === 0 && <p className="px-2.5 pb-2 text-xs text-[var(--muted)]">Create a space first.</p>}
      {spaces.map((space) => (
        <button
          key={space.id}
          type="button"
          role="menuitem"
          onClick={() => onMove(space.id)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-indigo-500/10"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: spaceColor(space.id) }} />
          <span className="min-w-0 flex-1 truncate">{space.name}</span>
          {item.folderId === space.id && <Check size={14} weight="bold" className="text-indigo-600 dark:text-indigo-300" />}
        </button>
      ))}
      {item.folderId && (
        <>
          <div className="my-1 h-px bg-[var(--surface-border)]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => onMove(null)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--muted)] transition hover:bg-indigo-500/10 hover:text-[var(--foreground)]"
          >
            <X size={14} />
            Remove from space
          </button>
        </>
      )}
      <div className="my-1 h-px bg-[var(--surface-border)]" />
      <button
        type="button"
        role="menuitem"
        onClick={onAskDelete}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
      >
        <Trash size={14} />
        Delete
      </button>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {[3, 2].map((rows, group) => (
        <div key={group}>
          <div className="mb-2 h-3 w-20 rounded bg-[var(--surface-border)]" />
          <div className="divide-y divide-[var(--surface-border)] rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--surface-border)]">
            {Array.from({ length: rows }).map((_, row) => (
              <div key={row} className="flex items-center gap-3 px-3.5 py-3">
                <div className="h-9 w-9 rounded-xl bg-[var(--surface-border)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 rounded bg-[var(--surface-border)]" />
                  <div className="h-2.5 w-1/4 rounded bg-[var(--surface-border)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-3xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-[var(--surface-border)]">
      <div className="mx-auto flex w-fit -space-x-2">
        {(["meeting", "file", "note"] as const).map((kind) => {
          const Icon = KIND[kind].icon;
          return (
            <span key={kind} className={`grid h-11 w-11 place-items-center rounded-2xl ring-4 ring-[var(--surface)] ${KIND[kind].tint}`}>
              <Icon size={20} weight="duotone" />
            </span>
          );
        })}
      </div>
      <h2 className="mt-5 text-lg font-bold">Everything you capture lands here</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[var(--muted)]">
        Meetings, files and notes in one timeline. File them into spaces, so a client, a project or a hire is one click away.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/meeting" className="brand-gradient-bg rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90">
          Start a meeting
        </Link>
        <Link href="/documents" className="rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--surface-border)] transition hover:ring-indigo-300">
          Upload a file
        </Link>
        <Link href="/notes" className="rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--surface-border)] transition hover:ring-indigo-300">
          Write a note
        </Link>
      </div>
    </div>
  );
}

export default function LibraryClient({
  spaces: initialSpaces,
  items: initialItems,
  previewMode = false,
}: {
  spaces: LibrarySpace[];
  items: LibraryItem[];
  previewMode?: boolean;
}) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<View>({ type: "all" });
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [creating, setCreating] = useState<false | "rail" | "inline">(false);
  const [newSpace, setNewSpace] = useState("");
  const [error, setError] = useState("");
  const [now] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);
  // "Today" depends on the viewer's own clock, so the timeline renders once
  // mounted instead of disagreeing with the server's render.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // ⌘K / Ctrl+K jumps to search from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setMenuFor(null);
        setConfirmFor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest("[data-move-menu]")) {
        setMenuFor(null);
        setConfirmFor(null);
      }
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [menuFor]);

  const spaceById = useMemo(() => new Map(spaces.map((space) => [space.id, space])), [spaces]);
  const topSpaces = spaces.filter((space) => !space.parentId || !spaceById.has(space.parentId));
  const countFor = (spaceId: string) => {
    const ids = spaceAndDescendants(spaceId, spaces);
    return items.filter((item) => item.folderId && ids.has(item.folderId)).length;
  };

  const inView = useMemo(() => {
    if (view.type === "space") {
      const ids = spaceAndDescendants(view.id, spaces);
      return items.filter((item) => item.folderId && ids.has(item.folderId));
    }
    if (view.type === "unfiled") return items.filter((item) => !item.folderId);
    if (view.type === "follow-up") return items.filter((item) => item.needsFollowUp);
    // Marked things only, urgent first — the one view that ignores the timeline.
    if (view.type === "priority")
      return items
        .filter((item) => item.priority)
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    return items;
  }, [items, spaces, view]);

  const normalized = query.trim().toLowerCase();
  const visible = inView.filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      (!normalized || `${item.title} ${item.detail ?? ""}`.toLowerCase().includes(normalized))
  );
  // Urgency headings in the Priority view, dates everywhere else.
  const groups = view.type === "priority" ? groupByPriority(visible) : groupByTimeline(visible, now);
  const activeSpace = view.type === "space" ? spaceById.get(view.id) : undefined;

  const heading =
    view.type === "space" ? activeSpace?.name ?? "Library"
      : view.type === "unfiled" ? "Unfiled"
      : view.type === "follow-up" ? "Needs attention"
      : view.type === "priority" ? "Priority"
      : "Library";
  const subheading =
    view.type === "priority"
      ? `${plural(inView.length, "item")} you marked, most urgent first`
      : view.type === "unfiled"
      ? `${plural(inView.length, "item")} not in a space yet`
      : view.type === "follow-up"
        ? `${plural(inView.length, "meeting")} with tasks to follow up`
        : view.type === "space"
          ? plural(inView.length, "item")
          : `${plural(items.length, "item")} across ${plural(topSpaces.length, "space")}`;

  const mark = async (item: LibraryItem, priority: Priority | null) => {
    setMenuFor(null);
    setError("");
    const previous = item.priority;
    const sameItem = (other: LibraryItem) => other.id === item.id && other.kind === item.kind;
    setItems((prev) => prev.map((other) => (sameItem(other) ? { ...other, priority } : other)));
    if (previewMode) return;
    try {
      const response = await fetch("/api/items/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id, priority }),
      });
      if (!response.ok) throw new Error("priority failed");
    } catch {
      setItems((prev) => prev.map((other) => (sameItem(other) ? { ...other, priority: previous } : other)));
      setError(`Couldn't change the priority of “${item.title}”. Try again.`);
    }
  };

  const move = async (item: LibraryItem, folderId: string | null) => {
    setMenuFor(null);
    setError("");
    const previous = item.folderId;
    const sameItem = (other: LibraryItem) => other.id === item.id && other.kind === item.kind;
    setItems((prev) => prev.map((other) => (sameItem(other) ? { ...other, folderId } : other)));
    if (previewMode) return;
    try {
      const response = await fetch("/api/library/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id, folderId }),
      });
      if (!response.ok) throw new Error("move failed");
    } catch {
      setItems((prev) => prev.map((other) => (sameItem(other) ? { ...other, folderId: previous } : other)));
      setError(`Couldn't move “${item.title}”. Try again.`);
    }
  };

  const remove = async (item: LibraryItem) => {
    setMenuFor(null);
    setConfirmFor(null);
    setError("");
    const sameItem = (other: LibraryItem) => other.id === item.id && other.kind === item.kind;
    const previous = items;
    setItems((prev) => prev.filter((other) => !sameItem(other)));
    if (previewMode) return;
    try {
      const response = await fetch("/api/items/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
      if (!response.ok) throw new Error("delete failed");
    } catch {
      // Put it back exactly where it was rather than leave them thinking it went.
      setItems(previous);
      setError(`Couldn't delete “${item.title}”. Try again.`);
    }
  };

  const createSpace = async () => {
    const name = newSpace.trim();
    setCreating(false);
    setNewSpace("");
    if (!name) return;
    setError("");
    if (previewMode) {
      const id = `preview-space-${spaces.length + 1}`;
      setSpaces((prev) => [...prev, { id, name, parentId: null }]);
      setView({ type: "space", id });
      return;
    }
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok || !data.folder) throw new Error("create failed");
      setSpaces((prev) => [...prev, { id: data.folder.id, name: data.folder.name, parentId: data.folder.parent_id ?? null }]);
      setView({ type: "space", id: data.folder.id });
    } catch {
      setError("Couldn't create that space.");
    }
  };

  const renderNewSpaceForm = () => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void createSpace();
      }}
      className="px-1 pt-1"
    >
      <input
        autoFocus
        value={newSpace}
        onChange={(event) => setNewSpace(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setCreating(false);
            setNewSpace("");
          }
        }}
        onBlur={() => {
          if (!newSpace.trim()) setCreating(false);
        }}
        placeholder="Name your space"
        aria-label="New space name"
        className="w-full rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-sm outline-none ring-2 ring-indigo-400/50"
      />
    </form>
  );

  const viewOptions = [
    { key: "all", label: "All items", color: null, active: view.type === "all", select: () => setView({ type: "all" }) },
    ...topSpaces.map((space) => ({
      key: space.id,
      label: space.name,
      color: spaceColor(space.id),
      active: view.type === "space" && view.id === space.id,
      select: () => setView({ type: "space", id: space.id }),
    })),
    { key: "priority", label: "Priority", color: null, active: view.type === "priority", select: () => setView({ type: "priority" }) },
    { key: "follow-up", label: "Needs attention", color: null, active: view.type === "follow-up", select: () => setView({ type: "follow-up" }) },
    { key: "unfiled", label: "Unfiled", color: null, active: view.type === "unfiled", select: () => setView({ type: "unfiled" }) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 md:grid-cols-[232px_minmax(0,1fr)] md:gap-8">
        <aside aria-label="Spaces" className="hidden md:sticky md:top-6 md:block md:self-start">
          <button
            type="button"
            onClick={() => searchRef.current?.focus()}
            className="flex w-full items-center gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] ring-1 ring-[var(--surface-border)] transition hover:ring-indigo-300"
          >
            <MagnifyingGlass size={15} />
            Search
            <kbd className="ml-auto rounded-md border border-[var(--surface-border)] px-1.5 py-0.5 font-sans text-[10px] font-semibold">⌘K</kbd>
          </button>

          <div className="mt-5 space-y-0.5">
            <RailButton active={view.type === "all"} onClick={() => setView({ type: "all" })} icon={<Tray size={15} />} label="All items" count={items.length} />
          </div>

          <div className="mt-6 flex items-center justify-between pr-1">
            <span className={railHeading}>Spaces</span>
            <button
              type="button"
              aria-label="New space"
              onClick={() => setCreating("rail")}
              className="grid h-6 w-6 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-indigo-500/10 hover:text-indigo-600"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          <div className="mt-1 space-y-0.5">
            {topSpaces.map((space) => (
              <RailButton
                key={space.id}
                active={view.type === "space" && view.id === space.id}
                onClick={() => setView({ type: "space", id: space.id })}
                icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: spaceColor(space.id) }} />}
                label={space.name}
                count={countFor(space.id)}
              />
            ))}
            {creating === "rail" && renderNewSpaceForm()}
            {topSpaces.length === 0 && !creating && (
              <button
                type="button"
                onClick={() => setCreating("rail")}
                className="w-full rounded-xl border border-dashed border-[var(--surface-border)] px-3 py-3 text-left text-xs leading-5 text-[var(--muted)] transition hover:border-indigo-300"
              >
                Create a space for a client, a project or a part of your life.
              </button>
            )}
          </div>

          <div className={`mt-6 ${railHeading}`}>Smart views</div>
          <div className="mt-1 space-y-0.5">
            <RailButton
              active={view.type === "priority"}
              onClick={() => setView({ type: "priority" })}
              icon={<span className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT.high}`} />}
              label="Priority"
              count={items.filter((entry) => entry.priority).length}
            />
            <RailButton
              active={view.type === "follow-up"}
              onClick={() => setView({ type: "follow-up" })}
              icon={<Lightning size={15} />}
              label="Needs attention"
              count={items.filter((item) => item.needsFollowUp).length}
            />
            <RailButton
              active={view.type === "unfiled"}
              onClick={() => setView({ type: "unfiled" })}
              icon={<FolderSimple size={15} />}
              label="Unfiled"
              count={items.filter((item) => !item.folderId).length}
            />
          </div>
        </aside>

        <section aria-labelledby="library-heading" className="min-w-0">
          <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 md:hidden" role="group" aria-label="Spaces">
            {viewOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={option.active}
                onClick={option.select}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  option.active
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--surface-border)]"
                }`}
              >
                {option.color && <span className="h-2 w-2 rounded-full" style={{ background: option.color }} />}
                {option.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="New space"
              onClick={() => setCreating("inline")}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--surface-border)]"
            >
              <Plus size={13} weight="bold" />
            </button>
          </div>
          {creating === "inline" && <div className="mb-4 md:hidden">{renderNewSpaceForm()}</div>}

          <h1 id="library-heading" className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight md:text-3xl">
            {activeSpace && <span className="h-3 w-3 rounded-full" style={{ background: spaceColor(activeSpace.id) }} />}
            {heading}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{subheading}</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {(["all", "meeting", "file", "note"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={kind === option}
                  onClick={() => setKind(option)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    kind === option
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--surface-border)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option === "all" ? "All" : KIND[option].label}
                  <span className="ml-1.5 tabular-nums opacity-60">
                    {option === "all" ? inView.length : inView.filter((item) => item.kind === option).length}
                  </span>
                </button>
              ))}
            </div>
            <label className="relative sm:ml-auto sm:w-72">
              <span className="sr-only">Search the library</span>
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles and summaries"
                className="w-full rounded-xl bg-[var(--surface)] py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-[var(--surface-border)] transition placeholder:text-[var(--muted)] focus:ring-2 focus:ring-indigo-400/50"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-6">
            {!mounted ? (
              <TimelineSkeleton />
            ) : items.length === 0 ? (
              <EmptyLibrary />
            ) : visible.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--surface-border)] px-6 py-10 text-center">
                <p className="font-semibold">
                  {normalized ? `Nothing matches “${query.trim()}”` : activeSpace ? `Nothing in ${activeSpace.name} yet` : "Nothing here yet"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--muted)]">
                  {normalized
                    ? "Try another word, or clear the search."
                    : activeSpace
                      ? "Open All items and use the folder button on anything to file it here."
                      : "Things will show up here as you capture them."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setKind("all");
                    setView({ type: "all" });
                  }}
                  className="mt-4 rounded-xl bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold ring-1 ring-[var(--surface-border)] transition hover:ring-indigo-300"
                >
                  Show all items
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h2 className="mb-2 flex items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {group.label}
                      <span className="h-px flex-1 bg-[var(--surface-border)]" />
                    </h2>
                    <ul className="divide-y divide-[var(--surface-border)] rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--surface-border)]">
                      {group.items.map((item) => {
                        const key = `${item.kind}-${item.id}`;
                        const Icon = KIND[item.kind].icon;
                        const space = item.folderId ? spaceById.get(item.folderId) : undefined;
                        const menuOpen = menuFor === key;
                        return (
                          <li key={key} className="group relative flex items-center gap-3 px-3.5 py-3 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-indigo-500/[0.04]">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${KIND[item.kind].tint}`}>
                              <Icon size={18} weight="duotone" />
                            </span>
                            <Link
                              href={item.href}
                              className="min-w-0 flex-1 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-indigo-400"
                            >
                              <span className="block truncate text-sm font-semibold">{item.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                                {[KIND[item.kind].singular, item.detail].filter(Boolean).join(" · ")}
                              </span>
                            </Link>
                            {item.priority && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${PRIORITY_CHIP[item.priority]}`}
                                title={`${PRIORITY_LABEL[item.priority]} priority`}
                              >
                                {PRIORITY_LABEL[item.priority]}
                              </span>
                            )}
                            {space && (
                              <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[var(--background)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] sm:inline-flex">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: spaceColor(space.id) }} />
                                {space.name}
                              </span>
                            )}
                            <time dateTime={item.createdAt} className="w-16 shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
                              {formatWhen(item.createdAt, now)}
                            </time>
                            {item.isOwner && (
                              <div className="relative z-10" data-move-menu>
                                <button
                                  type="button"
                                  aria-label={`Actions for ${item.title}`}
                                  aria-expanded={menuOpen}
                                  onClick={() => {
                                    setMenuFor(menuOpen ? null : key);
                                    setConfirmFor(null);
                                  }}
                                  className={`grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:opacity-100 ${
                                    menuOpen ? "opacity-100" : "md:opacity-0 md:group-hover:opacity-100"
                                  }`}
                                >
                                  <DotsThree size={18} weight="bold" />
                                </button>
                                {menuOpen && (
                                  <ItemMenu
                                    item={item}
                                    spaces={spaces}
                                    onMove={(folderId) => void move(item, folderId)}
                                    onMark={(priority) => void mark(item, priority)}
                                    onDelete={() => void remove(item)}
                                    confirming={confirmFor === key}
                                    onAskDelete={() => setConfirmFor(key)}
                                    onCancelDelete={() => setConfirmFor(null)}
                                  />
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
