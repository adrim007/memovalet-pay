import AppShell from "@/components/AppShell";
import LibraryClient from "@/components/LibraryClient";
import LibraryTabs from "@/components/LibraryTabs";
import { previewLibrary } from "@/lib/libraryPreviewData";

export default async function LibraryPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const library = state === "empty" ? { spaces: [], items: [] } : previewLibrary();

  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <LibraryTabs base="/preview" />
      <LibraryClient spaces={library.spaces} items={library.items} previewMode />
    </AppShell>
  );
}
