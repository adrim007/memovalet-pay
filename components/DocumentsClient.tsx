"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRIORITIES, PRIORITY_CHIP, PRIORITY_LABEL, type Priority } from "@/lib/priority";
import { DOCUMENT_COLORS, DocumentColor, Folder, LightMeeting, UserDocument } from "@/lib/types";
import { SectionStarter } from "@/components/AssistantStarter";
import PageHeader from "@/components/PageHeader";
import FileSharePanel from "@/components/FileSharePanel";
import AutosaveNotes from "@/components/AutosaveNotes";
import DocumentTimeline from "@/components/DocumentTimeline";

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

// Manual, UTC-based formatting — deterministic regardless of where the
// server renders vs. where the browser is, so it's safe in the SSR pass.
function formatAddedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <path
        d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h4.4a1.5 1.5 0 0 1 1.2.6l1.1 1.4h8.3A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11z"
        fill="url(#folder-gradient)"
      />
      <defs>
        <linearGradient
          id="folder-gradient"
          x1="3"
          y1="5"
          x2="21"
          y2="19"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--accent-from, #6366f1)" />
          <stop offset="1" stopColor="var(--accent-to, #d946ef)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const isImage = !!mimeType && mimeType.startsWith("image/");
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-7 w-7 text-[var(--muted)]"
    >
      <path
        d="M6.5 3.5h7l4 4v12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5v4h4" strokeLinejoin="round" />
      {isImage ? (
        <path
          d="M9 15l1.8-2.2a1 1 0 0 1 1.5-.05L14 15M13.5 14l.9-1.1a1 1 0 0 1 1.5-.03L17 15M8.5 17.5h7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path d="M9 12.5h6M9 15.5h6" strokeLinecap="round" />
      )}
    </svg>
  );
}

interface DocumentsClientProps {
  initialDocumentId?: string;
  documents: UserDocument[];
  folders: Folder[];
  meetingPacks: LightMeeting[];
}

export default function DocumentsClient({
  documents: initialDocuments,
  folders: initialFolders,
  meetingPacks,
  initialDocumentId,
}: DocumentsClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [folders, setFolders] = useState(initialFolders);
  const initialDocument = initialDocuments.find((doc) => doc.id === initialDocumentId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialDocument?.folder_id ?? null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initialDocument?.id ?? null);
  const [shareSelection, setShareSelection] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [colorFilter, setColorFilter] = useState<DocumentColor | null>(null);
  const [query, setQuery] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{
    kind: "folder" | "document";
    id: string;
    value: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const colorSavesRef = useRef(new Set<string>());
  const uploadInProgress = useRef(false);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const breadcrumb = useMemo(() => {
    const path: Folder[] = [];
    const visited = new Set<string>();
    let cursor = currentFolderId ? folderById.get(currentFolderId) : undefined;
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      path.unshift(cursor);
      cursor = cursor.parent_id ? folderById.get(cursor.parent_id) : undefined;
    }
    return path;
  }, [currentFolderId, folderById]);

  const normalizedQuery = query.trim().toLowerCase();
  const childFolders = folders
    .filter((f) => normalizedQuery || (f.parent_id ?? null) === currentFolderId)
    .filter((f) => !normalizedQuery || f.name.toLowerCase().includes(normalizedQuery));
  const childDocuments = documents
    .filter((d) => normalizedQuery || (d.folder_id ?? null) === currentFolderId)
    .filter((d) => !colorFilter || d.color === colorFilter)
    .filter(
      (d) =>
        !normalizedQuery ||
        d.title.toLowerCase().includes(normalizedQuery) ||
        d.notes?.toLowerCase().includes(normalizedQuery)
    );
  const filteredMeetingPacks = meetingPacks.filter(
    (meeting) =>
      !normalizedQuery ||
      meeting.title.toLowerCase().includes(normalizedQuery) ||
      meeting.summary?.toLowerCase().includes(normalizedQuery)
  );
  const selectedDoc = documents.find((d) => d.id === selectedDocId) ?? null;
  const hasAnyColor = documents.some((d) => !!d.color);

  const setDocumentColor = async (docId: string, color: DocumentColor | null) => {
    if (colorSavesRef.current.has(docId)) return;
    colorSavesRef.current.add(docId);
    setMenuFor(null);
    setError("");
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!response.ok) throw new Error("Colour update was not saved");
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, color } : d)));
    } catch {
      setError("Couldn't save that colour. Your previous colour is unchanged. Please try again.");
    } finally {
      colorSavesRef.current.delete(docId);
    }
  };

  const setDocumentPriority = async (docId: string, priority: Priority | null) => {
    setMenuFor(null);
    setError("");
    const previous = documents.find((d) => d.id === docId)?.priority ?? null;
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, priority } : d)));
    try {
      const response = await fetch("/api/items/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "file", id: docId, priority }),
      });
      if (!response.ok) throw new Error("Priority was not saved");
    } catch {
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, priority: previous } : d)));
      setError("Couldn't save that priority. Please try again.");
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (uploadInProgress.current) return;
    uploadInProgress.current = true;
    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      for (const file of Array.from(files)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "dat";
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("personal-documents")
          .upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const response = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: file.name,
            filePath,
            mimeType: file.type || null,
            folderId: currentFolderId,
          }),
        });
        if (!response.ok) throw new Error("failed");

        const data = await response.json();
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch {
      setError("Couldn't upload that file.");
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentFolderId }),
      });
      if (!response.ok) throw new Error("failed");
      const data = await response.json();
      setFolders((prev) => [...prev, data.folder]);
    } catch {
      setError("Couldn't create that folder.");
    } finally {
      setCreatingFolder(false);
      setNewFolderName("");
    }
  };

  const handleRenameSubmit = async () => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (!value) {
      setRenaming(null);
      return;
    }
    try {
      if (renaming.kind === "folder") {
        const response = await fetch(`/api/folders/${renaming.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: value }),
        });
        if (!response.ok) throw new Error("Rename failed");
        setFolders((prev) => prev.map((f) => (f.id === renaming.id ? { ...f, name: value } : f)));
      } else {
        const response = await fetch(`/api/documents/${renaming.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: value }),
        });
        if (!response.ok) throw new Error("Rename failed");
        setDocuments((prev) =>
          prev.map((d) => (d.id === renaming.id ? { ...d, title: value } : d))
        );
      }
    } catch {
      setError("Couldn't rename that.");
    } finally {
      setRenaming(null);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    setMenuFor(null);
    try {
      const response = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      const removed = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of folders) {
          if (folder.parent_id && removed.has(folder.parent_id) && !removed.has(folder.id)) {
            removed.add(folder.id);
            changed = true;
          }
        }
      }
      setFolders(prev => prev.filter(folder => !removed.has(folder.id)));
      setDocuments(prev => prev.map(doc => doc.folder_id && removed.has(doc.folder_id) ? { ...doc, folder_id: null } : doc));
      if (currentFolderId && removed.has(currentFolderId)) setCurrentFolderId(null);
    } catch {
      setError("Couldn't delete that folder.");
    }
  };

  const handleDeleteDocument = async (doc: UserDocument) => {
    setMenuFor(null);
    try {
      const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("failed");
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (selectedDocId === doc.id) setSelectedDocId(null);
    } catch {
      setError("Couldn't delete that document.");
    }
  };

  const handleView = (doc: UserDocument) => {
    window.open(`/api/documents/${doc.id}/open`, "_blank", "noopener,noreferrer");
  };

  const saveNotes = (docId: string, notes: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, notes } : d)));
  };

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
          title="Files"
          subtitle="Meeting packs, recordings and documents. Searchable, shareable, and private by default."
        />

        <label className="mb-6 block">
          <span className="sr-only">Search documents and meeting packs</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meeting packs, files, and notes…"
            className="surface-card w-full rounded-2xl px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        {selectedDoc && (
          <DetailPanel
            key={selectedDoc.id}
            doc={selectedDoc}
            onClose={() => setSelectedDocId(null)}
            onView={() => handleView(selectedDoc)}
            onDelete={() => handleDeleteDocument(selectedDoc)}
            onSaveNotes={(notes) => saveNotes(selectedDoc.id, notes)}
            onSetColor={(color) => setDocumentColor(selectedDoc.id, color)}
          />
        )}
        <DocumentTimeline documents={documents} meetings={meetingPacks} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!shareSelection.length || shareSelection.length > 10} onClick={() => setSharing(true)} className="rounded-xl border border-violet-200 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-900 disabled:opacity-50">Share selected ({shareSelection.length})</button>
          <p className="text-xs text-[var(--muted)]">Select up to 10 photos or files to share together.</p>
        </div>
        {sharing && <FileSharePanel key={shareSelection.join(",")} documents={documents.filter(doc => shareSelection.includes(doc.id))} onClose={() => setSharing(false)} />}

        {(currentFolderId === null || normalizedQuery) && filteredMeetingPacks.length > 0 && (
          <section className="mb-6" aria-labelledby="meeting-packs-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="meeting-packs-heading" className="text-sm font-semibold">Meeting packs</h2>
              <Link href="/history" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
                View all meetings
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(normalizedQuery ? filteredMeetingPacks : filteredMeetingPacks.slice(0, 6)).map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/history/${meeting.id}`}
                  className="surface-card rounded-2xl p-4 transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
                >
                  <p className="truncate text-sm font-semibold">{meeting.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                    {meeting.summary || "Transcript, notes, decisions, and action items from this meeting."}
                  </p>
                  <p className="mt-3 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                    {(meeting.decisions?.length || 0)} decisions · {(meeting.action_items?.length || 0)} actions
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-x-auto">
            <button
              onClick={() => setCurrentFolderId(null)}
              className={`shrink-0 font-medium transition ${currentFolderId === null ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
            >
              Home
            </button>
            {breadcrumb.map((folder) => (
              <span key={folder.id} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[var(--muted)]">/</span>
                <button
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={`font-medium transition ${folder.id === currentFolderId ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5 transition"
            >
              New folder
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="brand-gradient-bg text-white text-xs font-medium px-3 py-2 rounded-lg transition hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {hasAnyColor && (
          <div className="flex items-center gap-1.5 mb-4">
            <button
              type="button"
              onClick={() => setColorFilter(null)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                colorFilter === null
                  ? "border-indigo-400/60 bg-indigo-400/10 text-[var(--foreground)]"
                  : "border-[var(--surface-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              All
            </button>
            {DOCUMENT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColorFilter(colorFilter === c.value ? null : c.value)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                  colorFilter === c.value
                    ? "border-indigo-400/60 bg-indigo-400/10 text-[var(--foreground)]"
                    : "border-[var(--surface-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepthRef.current += 1;
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) {
              dragDepthRef.current = 0;
              setDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepthRef.current = 0;
            setDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
              uploadFiles(e.dataTransfer.files);
          }}
          className={`rounded-2xl transition ${dragOver ? "ring-2 ring-indigo-400 bg-indigo-400/5" : ""}`}
        >
          {childFolders.length === 0 && childDocuments.length === 0 && !creatingFolder ? (
            dragOver ? (
              <div className="surface-card dashed-card rounded-2xl p-10 text-center">
                <p className="font-medium">Drop to upload</p>
              </div>
            ) : normalizedQuery ? (
              <div className="surface-card dashed-card rounded-2xl p-10 text-center">
                <p className="font-medium mb-1">No matches</p>
                <p className="text-sm text-[var(--muted)]">Try another file, meeting, or note.</p>
              </div>
            ) : (
              <SectionStarter
                icon="documents"
                eyebrow="Your shared memory"
                title="Meeting files and uploads will stay together here."
                body={`Finish a meeting to create a meeting pack, or use Upload above to add the files you want MemoValet to remember.`}
                primaryHref="/meeting"
                primaryLabel="Start or import a meeting"
                points={[
                  "Recording and transcript",
                  "Translated versions and PDF",
                  "Notes, decisions, tasks, and sharing",
                ]}
              />
            )
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {creatingFolder && (
                <div className="surface-card rounded-2xl p-3.5 flex flex-col items-center gap-2 text-center">
                  <span className="flex h-11 w-11 items-center justify-center">
                    <FolderIcon />
                  </span>
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={handleCreateFolder}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateFolder();
                      }
                      if (e.key === "Escape") {
                        setCreatingFolder(false);
                        setNewFolderName("");
                      }
                    }}
                    placeholder="Folder name"
                    className="w-full text-xs text-center rounded-md border border-indigo-400 bg-transparent px-1.5 py-1 outline-none"
                  />
                </div>
              )}

              {childFolders.map((folder) => (
                <div key={folder.id} className="relative group">
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="w-full surface-card rounded-2xl p-3.5 flex flex-col items-center gap-2 text-center transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10"
                  >
                    <span className="flex h-11 w-11 items-center justify-center">
                      <FolderIcon />
                    </span>
                    {renaming?.kind === "folder" && renaming.id === folder.id ? (
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(e) =>
                          setRenaming({ kind: "folder", id: folder.id, value: e.target.value })
                        }
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRenameSubmit();
                          }
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs text-center rounded-md border border-indigo-400 bg-transparent px-1 py-0.5 outline-none"
                      />
                    ) : (
                      <span className="text-xs font-medium truncate w-full">{folder.name}</span>
                    )}
                  </button>
                  <TileMenu
                    open={menuFor === `folder:${folder.id}`}
                    onToggle={() =>
                      setMenuFor(menuFor === `folder:${folder.id}` ? null : `folder:${folder.id}`)
                    }
                    onRename={() => {
                      setRenaming({ kind: "folder", id: folder.id, value: folder.name });
                      setMenuFor(null);
                    }}
                    onDelete={() => handleDeleteFolder(folder.id)}
                  />
                </div>
              ))}

              {childDocuments.map((doc) => (
                <div key={doc.id} className="relative group">
                  <input type="checkbox" aria-label={`Select ${doc.title} to share`} checked={shareSelection.includes(doc.id)} disabled={sharing} onChange={e => setShareSelection(previous => e.target.checked ? [...previous, doc.id] : previous.filter(id => id !== doc.id))} className="absolute left-2 top-2 z-10 h-4 w-4 accent-violet-600" />
                  <button
                    onClick={() => setSelectedDocId(doc.id)}
                    className="w-full surface-card rounded-2xl p-3.5 flex flex-col items-center gap-2 text-center transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10"
                  >
                    <span className="relative flex h-11 w-11 items-center justify-center">
                      <FileIcon mimeType={doc.mime_type} />
                      {doc.color && (
                        <span
                          className={`absolute -top-0.5 -left-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface)] ${
                            DOCUMENT_COLORS.find((c) => c.value === doc.color)?.dot || ""
                          }`}
                        />
                      )}
                    </span>
                    {renaming?.kind === "document" && renaming.id === doc.id ? (
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(e) =>
                          setRenaming({ kind: "document", id: doc.id, value: e.target.value })
                        }
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRenameSubmit();
                          }
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs text-center rounded-md border border-indigo-400 bg-transparent px-1 py-0.5 outline-none"
                      />
                    ) : (
                      <span className="text-xs font-medium truncate w-full">{doc.title}</span>
                    )}
                    {doc.priority && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_CHIP[doc.priority]}`}>
                        {PRIORITY_LABEL[doc.priority]}
                      </span>
                    )}
                  </button>
                  <TileMenu
                    open={menuFor === `document:${doc.id}`}
                    onToggle={() =>
                      setMenuFor(menuFor === `document:${doc.id}` ? null : `document:${doc.id}`)
                    }
                    onRename={() => {
                      setRenaming({ kind: "document", id: doc.id, value: doc.title });
                      setMenuFor(null);
                    }}
                    onDelete={() => handleDeleteDocument(doc)}
                    color={doc.color}
                    onSetColor={(color) => setDocumentColor(doc.id, color)}
                    priority={doc.priority}
                    onSetPriority={(priority) => setDocumentPriority(doc.id, priority)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--muted)] mt-4">
          Files stay private unless you share them. Sharing links expire after 7 days; individual file links expire after a minute.
        </p>
      </div>
    </div>
  );
}

function TileMenu({
  open,
  onToggle,
  onRename,
  onDelete,
  color,
  onSetColor,
  priority,
  onSetPriority,
}: {
  open: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  color?: DocumentColor | null;
  onSetColor?: (color: DocumentColor | null) => void;
  priority?: Priority | null;
  onSetPriority?: (priority: Priority | null) => void;
}) {
  return (
    <div className="absolute top-1.5 right-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="h-6 w-6 rounded-md flex items-center justify-center text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:bg-indigo-400/10 hover:text-[var(--foreground)] transition"
        aria-label="More options"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <circle cx="12" cy="5.5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18.5" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl overflow-hidden z-10">
          {onSetPriority && (
            <div className="flex items-center gap-1 border-b border-[var(--surface-border)] px-2 py-2">
              {PRIORITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-label={`${PRIORITY_LABEL[level]} priority`}
                  aria-pressed={priority === level}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPriority(priority === level ? null : level);
                  }}
                  className={`flex-1 rounded-md py-1 text-[10px] font-semibold transition ${
                    priority === level ? PRIORITY_CHIP[level] : "text-[var(--muted)] hover:bg-indigo-400/10"
                  }`}
                >
                  {PRIORITY_LABEL[level]}
                </button>
              ))}
              <button
                type="button"
                aria-label="No priority"
                aria-pressed={!priority}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetPriority(null);
                }}
                className="rounded-md px-1.5 py-1 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-indigo-400/10"
              >
                None
              </button>
            </div>
          )}
          {onSetColor && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--surface-border)]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetColor(null);
                }}
                aria-label="No color"
                className={`h-4 w-4 rounded-full border border-dashed border-[var(--surface-border)] shrink-0 ${
                  !color ? "ring-2 ring-offset-1 ring-offset-[var(--surface)] ring-indigo-400" : ""
                }`}
              />
              {DOCUMENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetColor(c.value);
                  }}
                  aria-label={c.label}
                  className={`h-4 w-4 rounded-full shrink-0 ${c.dot} ${
                    color === c.value
                      ? "ring-2 ring-offset-1 ring-offset-[var(--surface)] ring-indigo-400"
                      : ""
                  }`}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            className="w-full text-left text-xs px-3 py-2 hover:bg-indigo-400/5 transition"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-full text-left text-xs px-3 py-2 text-red-500 dark:text-red-400 hover:bg-red-500/10 transition"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  doc,
  onClose,
  onView,
  onDelete,
  onSaveNotes,
  onSetColor,
}: {
  doc: UserDocument;
  onClose: () => void;
  onView: () => void;
  onDelete: () => void;
  onSaveNotes: (notes: string) => void;
  onSetColor: (color: DocumentColor | null) => void;
}) {
  return (
    <div className="surface-card rounded-2xl p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <FileIcon mimeType={doc.mime_type} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{doc.title}</p>
            <p className="text-xs text-[var(--muted)]">Added {formatAddedDate(doc.created_at)}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-indigo-400/10 hover:text-[var(--foreground)] transition shrink-0"
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <AutosaveNotes
        initial={doc.notes ?? ""}
        endpoint={`/api/documents/${doc.id}`}
        onSaved={onSaveNotes}
        label="Document notes"
        placeholder="Notes about this file, like expiry dates, reference numbers, or anything worth remembering."
      />

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[var(--muted)] mr-1">Color</span>
        <button
          type="button"
          onClick={() => onSetColor(null)}
          aria-label="No color"
          className={`h-5 w-5 rounded-full border border-dashed border-[var(--surface-border)] shrink-0 transition ${
            !doc.color ? "ring-2 ring-offset-1 ring-offset-[var(--surface)] ring-indigo-400" : ""
          }`}
        />
        {DOCUMENT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onSetColor(c.value)}
            aria-label={c.label}
            className={`h-5 w-5 rounded-full shrink-0 transition ${c.dot} ${
              doc.color === c.value
                ? "ring-2 ring-offset-1 ring-offset-[var(--surface)] ring-indigo-400"
                : ""
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onView}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5 transition"
        >
          View file
        </button>
        <button
          onClick={onDelete}
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-500/10 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
