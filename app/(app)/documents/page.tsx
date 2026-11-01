import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { listDocuments, listFolders, listVisibleMeetingsLight } from "@/lib/database";
import DocumentsClient from "@/components/DocumentsClient";
import FileShareHistory from "@/components/FileShareHistory";
import LibraryTabs from "@/components/LibraryTabs";
import { calendarSourceItem } from "@/lib/calendar-source-item";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ document?: string }> }) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  const { document } = await searchParams;

  const [documents, folders, meetingPacks] = await Promise.all([
    listDocuments(user.id),
    listFolders(user.id),
    listVisibleMeetingsLight(),
  ]);
  if (document && !documents.some((item) => item.id === document)) {
    const selected = await calendarSourceItem("documents", document);
    if (selected) documents.unshift(selected);
  }

  return (
    <><LibraryTabs />
    {document && !documents.some((item) => item.id === document) && <p role="alert" className="mb-4 rounded-xl bg-amber-500/10 p-4 text-sm">This file was removed or is no longer available to you.</p>}
    <DocumentsClient
      key={document || "files"}
      initialDocumentId={document}
      documents={documents}
      folders={folders}
      meetingPacks={meetingPacks}
    /><FileShareHistory /></>
  );
}
