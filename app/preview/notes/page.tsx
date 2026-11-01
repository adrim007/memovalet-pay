import AppShell from "@/components/AppShell";
import NotesClient from "@/components/NotesClient";
import LibraryTabs from "@/components/LibraryTabs";
import type { Bookmark, Note } from "@/lib/types";

const ME = "preview-user";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const notes: Note[] = [
  {
    id: "n1",
    user_id: ME,
    title: "Tiles: ask Marco about lead time",
    body: "He estimates six weeks. Confirm before ordering because the kitchen schedule depends on it.",
    created_at: daysAgo(0),
    folder_id: null,
    priority: "high",
  },
  {
    id: "n2",
    user_id: ME,
    title: null,
    body: "Quote from Orion came in under budget. Worth a call before Friday.",
    created_at: daysAgo(1),
    folder_id: null,
    priority: "medium",
  },
  {
    id: "n3",
    user_id: ME,
    title: "Ideas for the offsite",
    body: "Somewhere with a kitchen. Two nights, not three.",
    created_at: daysAgo(4),
    folder_id: null,
    priority: null,
  },
  {
    // Shared with you: readable, and not yours to mark or edit.
    id: "n4",
    user_id: "someone-else",
    title: "Handover notes",
    body: "Access details are with facilities. Badge collection is on level 2.",
    created_at: daysAgo(6),
    folder_id: null,
    priority: null,
  },
];

const bookmarks: Bookmark[] = [
  { id: "b1", user_id: ME, title: "Tile supplier price list", url: "https://example.com/tiles", created_at: daysAgo(3) },
];

export default function NotesPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <LibraryTabs base="/preview" />
      <NotesClient
        notes={notes}
        bookmarks={bookmarks}
        currentUserId={ME}
        sharedBy={{ "someone-else": "Priya" }}
      />
    </AppShell>
  );
}
