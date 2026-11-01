import type { LibraryItem, LibrarySpace } from "@/lib/types";

// Example library for /preview/library. Dates are relative to now, so the
// Today / Yesterday / This week groups always have something in them.
export function previewLibrary(): { spaces: LibrarySpace[]; items: LibraryItem[] } {
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  const spaces: LibrarySpace[] = [
    { id: "preview-space-kitchen", name: "Kitchen renovation", parentId: null },
    { id: "preview-space-orion", name: "Client: Orion", parentId: null },
    { id: "preview-space-hiring", name: "Hiring", parentId: null },
  ];
  const item = (
    kind: LibraryItem["kind"],
    id: string,
    title: string,
    detail: string | null,
    hours: number,
    folderId: string | null,
    needsFollowUp = false,
    priority: LibraryItem["priority"] = null
  ): LibraryItem => ({ id, kind, title, detail, createdAt: hoursAgo(hours), folderId, href: "#", isOwner: true, needsFollowUp, priority });

  const items = [
    item("meeting", "m1", "Product review", "3 decisions · 2 tasks", 2, "preview-space-orion", true, "high"),
    item("file", "f1", "Budget tracker.xlsx", "Spreadsheet", 5, "preview-space-kitchen"),
    item("note", "n1", "Tiles: ask Marco about lead time", "He thinks six weeks, but check before ordering.", 7, "preview-space-kitchen", false, "high"),
    item("meeting", "m2", "Client sync: Orion", "Recording · 2 tasks", 27, "preview-space-orion", true),
    item("file", "f2", "Project proposal.pdf", "PDF", 30, "preview-space-orion", false, "medium"),
    item("note", "n2", "Interview notes: Priya", "Strong on systems design, wants to lead a small team.", 52, "preview-space-hiring"),
    item("meeting", "m3", "Hiring sync", "1 decision", 76, "preview-space-hiring", false, "low"),
    item("file", "f3", "Floor plan v3.png", "Image", 120, "preview-space-kitchen"),
    item("meeting", "m4", "Weekly planning", "4 tasks", 140, null, true),
    item("file", "f4", "Q3 planning deck", "Slides", 24 * 20, null),
    item("note", "n3", "Ideas for the offsite", null, 24 * 40, null),
  ];
  return { spaces, items };
}
