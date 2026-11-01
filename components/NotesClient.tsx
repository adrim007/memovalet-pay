"use client";

import { useState } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import { Bookmark, Note } from "@/lib/types";
import { ShareForm } from "@/components/ShareWithUser";
import PageHeader from "@/components/PageHeader";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import PriorityPicker from "@/components/PriorityPicker";
import { PRIORITY_CHIP, PRIORITY_LABEL } from "@/lib/priority";

// A fixed locale, as the Library uses: the server and the browser each used
// their own ("Sep 19, 2026" against "19 Sept 2026"), and the page complained.
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}


export default function NotesClient({
  notes: initialNotes,
  bookmarks: initialBookmarks = [],
  currentUserId,
  sharedBy = {},
}: {
  notes: Note[];
  bookmarks?: Bookmark[];
  currentUserId?: string;
  sharedBy?: Record<string, string>;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);

  const isOwner = (note: Note) => !currentUserId || note.user_id === currentUserId;
  const originalNote = notes.find((note) => note.id === editingId);
  const editDirty = Boolean(originalNote && (editTitle !== (originalNote.title || "") || editBody !== originalNote.body));
  const dirty = Boolean(title || body || linkUrl || linkTitle || editDirty);
  useUnsavedWarning(dirty);
  const visibleNotes = notes.filter((note) => `${note.title || ""} ${note.body}`.toLowerCase().includes(query.trim().toLowerCase()));

  const createNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null, body: body.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Couldn't save that note.");
        return;
      }
      setNotes((prev) => [data.note, ...prev]);
      setTitle("");
      setBody("");
      setQuery("");
      setNotice("Note saved.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (note: Note) => {
    if (busyId || (editDirty && !window.confirm("Discard the changes to your current note?"))) return;
    setEditingId(note.id);
    setEditTitle(note.title || "");
    setEditBody(note.body);
    setConfirmDeleteId(null);
  };

  const saveEdit = async (id: string) => {
    if (!editBody.trim() || busyId) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() || null, body: editBody.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Couldn't update that note.");
        return;
      }
      setNotes((prev) => prev.map((n) => (n.id === id ? data.note : n)));
      setEditingId(null);
      setNotice("Changes saved.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const removeNote = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Couldn't delete that note.");
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDeleteId(null);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const addBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || savingLink) return;
    setSavingLink(true);
    setLinkError("");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim(), title: linkTitle.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLinkError(data.error || "Couldn't save that link.");
        return;
      }
      setBookmarks((prev) => [data.bookmark, ...prev]);
      setLinkUrl("");
      setLinkTitle("");
    } catch {
      setLinkError("Something went wrong. Try again.");
    } finally {
      setSavingLink(false);
    }
  };

  const removeBookmark = async (id: string) => {
    if (busyLinkId) return;
    setBusyLinkId(id);
    setLinkError("");
    try {
      const response = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setLinkError(data.error || "Couldn't remove that link.");
        return;
      }
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setLinkError("Something went wrong. Try again.");
    } finally {
      setBusyLinkId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notes"
        subtitle="Ideas, plans and useful details. Keep them here, and share them when you’re ready."
      />

      <form onSubmit={createNote} className="surface-card rounded-2xl p-5 mb-6 space-y-3">
        <input
          dir="auto"
          aria-label="Note title"
          readOnly={saving}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
        />
        <textarea
          dir="auto"
          aria-label="Note body"
          readOnly={saving}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note…"
          rows={3}
          className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-[var(--muted)]">{saving ? "Saving your note…" : title || body ? "Unsaved note · add it to keep it" : notice || "Only shared when you choose"}</p>
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="brand-gradient-bg rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {notes.length > 0 && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Your notes <span className="text-sm font-medium text-[var(--muted)]">({notes.length})</span></h2>
        <input type="search" aria-label="Search notes" placeholder="Find a note…" value={query} disabled={editingId !== null} onChange={(event) => setQuery(event.target.value)} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm" />
      </div>}
      {notes.length > 0 && visibleNotes.length === 0 && <p role="status" className="py-6 text-sm text-[var(--muted)]">No notes match your search. Try another word.</p>}

      {notes.length === 0 ? (
        <div className="surface-card dashed-card rounded-2xl p-8 text-center">
          <p className="font-semibold">No notes yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add one above, or use the + button anywhere in the app.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleNotes.map((note) => (
            <li key={note.id} id={`note-${note.id}`} tabIndex={-1} className="surface-card scroll-mt-24 rounded-xl p-5 target:ring-2 target:ring-indigo-400/60 focus-visible:outline-2 focus-visible:outline-indigo-400">
              {editingId === note.id ? (
                <div className="space-y-3">
                  <input
                    dir="auto"
                    aria-label="Edit note title"
                    readOnly={busyId === note.id}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                  <textarea
                    dir="auto"
                    aria-label="Edit note body"
                    readOnly={busyId === note.id}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === note.id}
                      onClick={() => { if (!editDirty || window.confirm("Discard your unsaved changes?")) setEditingId(null); }}
                      className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(note.id)}
                      disabled={busyId === note.id || !editBody.trim()}
                      className="brand-gradient-bg rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busyId === note.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                    <div className="min-w-0 flex-1 w-full [overflow-wrap:anywhere]">
                      {!isOwner(note) && (
                        <span className="mb-1.5 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                          Shared by {sharedBy[note.user_id] || "someone"}
                        </span>
                      )}
                      {/* The owner already sees the level in their own picker;
                          this is for a note shared with you. */}
                      {!isOwner(note) && note.priority && (
                        <span className={`mb-1.5 mr-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_CHIP[note.priority]}`}>
                          {PRIORITY_LABEL[note.priority]}
                        </span>
                      )}
                      {note.title && <h2 dir="auto" className="font-semibold">{note.title}</h2>}
                      <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(note.created_at)}</p>
                    </div>
                    {isOwner(note) && (
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <PriorityPicker
                          kind="note"
                          id={note.id}
                          value={note.priority}
                          name={note.title || "this note"}
                          onChanged={(priority) =>
                            setNotes((prev) =>
                              prev.map((other) => (other.id === note.id ? { ...other, priority } : other))
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setSharingId(sharingId === note.id ? null : note.id)}
                          aria-expanded={sharingId === note.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          <ShareNetwork size={14} weight="bold" />
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(note)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-indigo-500/5"
                        >
                          Edit
                        </button>
                        {confirmDeleteId === note.id ? (
                          <button
                            type="button"
                            onClick={() => removeNote(note.id)}
                            disabled={busyId === note.id}
                            className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60"
                          >
                            {busyId === note.id ? "Deleting…" : "Confirm delete"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(note.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-red-500/5 hover:text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isOwner(note) && sharingId === note.id && (
                    <ShareForm itemType="note" itemId={note.id} onClose={() => setSharingId(null)} />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10" aria-labelledby="saved-links-heading">
        <h2 id="saved-links-heading" className="text-lg font-bold tracking-tight mb-1">
          Saved links
        </h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Save useful search results, suppliers and places here so you can find them again easily.
        </p>

        <form onSubmit={addBookmark} className="surface-card rounded-2xl p-4 mb-4 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              aria-label="Link URL"
              readOnly={savingLink}
              type="text"
              inputMode="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste a link"
              className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={savingLink || !linkUrl.trim()}
              className="brand-gradient-bg rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingLink ? "Saving…" : "Save link"}
            </button>
          </div>
          <input
            aria-label="Link name"
            readOnly={savingLink}
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Name it (optional)"
            className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          {linkError && <p className="text-xs text-red-500 dark:text-red-400">{linkError}</p>}
        </form>

        {bookmarks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nothing saved yet. You can also hit Save after a web search on Home.
          </p>
        ) : (
          <ul className="space-y-2">
            {bookmarks.map((bookmark) => (
              <li
                key={bookmark.id}
                className="surface-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              >
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-sm font-semibold hover:underline">{bookmark.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{hostOf(bookmark.url)}</span>
                </a>
                <button
                  type="button"
                  onClick={() => removeBookmark(bookmark.id)}
                  disabled={busyLinkId === bookmark.id}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-red-500/5 hover:text-red-600 disabled:opacity-60"
                >
                  {busyLinkId === bookmark.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
