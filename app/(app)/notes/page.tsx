import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getUserLabels, listBookmarks, listNotes } from "@/lib/database";
import NotesClient from "@/components/NotesClient";
import LibraryTabs from "@/components/LibraryTabs";
import { calendarSourceItem } from "@/lib/calendar-source-item";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const [notes, bookmarks] = await Promise.all([listNotes(), listBookmarks()]);
  const { note } = await searchParams;
  if (note && !notes.some((item) => item.id === note)) {
    const selected = await calendarSourceItem("notes", note);
    if (selected) notes.unshift(selected);
  }

  // Names of the people who shared notes with this user (for the badge).
  const ownerIds = notes.filter((note) => note.user_id !== user.id).map((note) => note.user_id);
  const sharedBy = ownerIds.length ? await getUserLabels(ownerIds) : {};

  return (
    <>
      <LibraryTabs />
      {note && !notes.some((item) => item.id === note) && <p role="alert" className="mb-4 rounded-xl bg-amber-500/10 p-4 text-sm">This note was removed or is no longer shared with you.</p>}
      <NotesClient key={note || "notes"} notes={notes} bookmarks={bookmarks} currentUserId={user.id} sharedBy={sharedBy} />
    </>
  );
}
