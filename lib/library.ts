import { asPriority, PRIORITIES, PRIORITY_LABEL, type Priority } from "@/lib/priority";
import type {
  Folder,
  LibraryItem,
  LibrarySpace,
  Note,
  SavedMeeting,
  UserDocument,
} from "@/lib/types";

// Pure helpers for the Library, safe to use in the browser. The server loader
// lives in lib/library-data.ts.

type MeetingRow = Pick<
  SavedMeeting,
  "id" | "title" | "summary" | "created_at" | "action_items" | "decisions" | "video_url"
> & { user_id: string | null; folder_id?: string | null; priority?: string | null };

type NoteRow = Pick<Note, "id" | "title" | "body" | "created_at" | "user_id"> & {
  folder_id?: string | null;
  priority?: string | null;
};

type DocumentRow = Pick<UserDocument, "id" | "title" | "mime_type" | "folder_id" | "created_at"> & {
  priority?: string | null;
};

const SPACE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#f43f5e", "#14b8a6"];

// A space keeps the same colour everywhere without storing one: it comes from the id.
export function spaceColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return SPACE_COLORS[Math.abs(hash) % SPACE_COLORS.length];
}

function firstLine(text: string | null | undefined, max = 120): string | null {
  const line = (text || "")
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  return line.length > max ? line.slice(0, max - 1).trimEnd() + "…" : line;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function meetingDetail(meeting: MeetingRow): string | null {
  const parts: string[] = [];
  const decisions = meeting.decisions?.length ?? 0;
  const tasks = meeting.action_items?.length ?? 0;
  if (decisions) parts.push(plural(decisions, "decision"));
  if (tasks) parts.push(plural(tasks, "task"));
  if (meeting.video_url) parts.push("Recording");
  return parts.length ? parts.join(" · ") : firstLine(meeting.summary);
}

function fileDetail(document: DocumentRow): string {
  const mime = document.mime_type || "";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (/sheet|excel|csv/.test(mime)) return "Spreadsheet";
  if (/presentation|powerpoint/.test(mime)) return "Slides";
  if (/word|document|text/.test(mime)) return "Document";
  return "File";
}

export function buildLibrary(input: {
  userId: string;
  folders: Folder[];
  meetings: MeetingRow[];
  documents: DocumentRow[];
  notes: NoteRow[];
}): { spaces: LibrarySpace[]; items: LibraryItem[] } {
  const spaces = input.folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
  }));
  const known = new Set(spaces.map((space) => space.id));
  // A folder id we can't see — someone else's space on a team meeting — reads as unfiled.
  const inSpace = (id: string | null | undefined) => (id && known.has(id) ? id : null);

  const items: LibraryItem[] = [
    ...input.meetings.map((meeting) => ({
      id: meeting.id,
      kind: "meeting" as const,
      title: meeting.title || "Untitled meeting",
      detail: meetingDetail(meeting),
      createdAt: meeting.created_at,
      folderId: inSpace(meeting.folder_id),
      href: `/history/${meeting.id}`,
      isOwner: meeting.user_id === input.userId,
      needsFollowUp: (meeting.action_items?.length ?? 0) > 0,
      priority: asPriority(meeting.priority),
    })),
    ...input.documents.map((document) => ({
      id: document.id,
      kind: "file" as const,
      title: document.title,
      detail: fileDetail(document),
      createdAt: document.created_at,
      folderId: inSpace(document.folder_id),
      href: `/documents?document=${encodeURIComponent(document.id)}`,
      isOwner: true,
      needsFollowUp: false,
      priority: asPriority(document.priority),
    })),
    ...input.notes.map((note) => {
      const title = note.title?.trim();
      return {
        id: note.id,
        kind: "note" as const,
        title: title || firstLine(note.body, 60) || "Untitled note",
        detail: title ? firstLine(note.body) : null,
        createdAt: note.created_at,
        folderId: inSpace(note.folder_id),
        href: `/notes?note=${encodeURIComponent(note.id)}#note-${encodeURIComponent(note.id)}`,
        isOwner: note.user_id === input.userId,
        needsFollowUp: false,
        priority: asPriority(note.priority),
      };
    }),
  ];

  items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { spaces, items };
}

// A space and every folder nested inside it, so a space's count and view
// include what's in its sub-folders.
export function spaceAndDescendants(spaceId: string, spaces: LibrarySpace[]): Set<string> {
  const ids = new Set([spaceId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const space of spaces) {
      if (space.parentId && ids.has(space.parentId) && !ids.has(space.id)) {
        ids.add(space.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function timelineLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    return "Earlier this month";
  }
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// Items arrive newest first, so each label forms one unbroken run.
/**
 * Groups the Priority view by level rather than by date, because "most urgent
 * first" and "newest first" fight each other: date headings would put a low
 * thing from yesterday above a high thing from last week.
 */
export function groupByPriority<T extends { priority?: Priority | null }>(
  items: T[]
): { label: string; items: T[] }[] {
  return PRIORITIES.map((level) => ({
    label: PRIORITY_LABEL[level],
    items: items.filter((item) => item.priority === level),
  })).filter((group) => group.items.length > 0);
}

export function groupByTimeline<T extends { createdAt: string }>(
  items: T[],
  now: Date
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = timelineLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
