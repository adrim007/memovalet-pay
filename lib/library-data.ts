import { createClient } from "@/lib/supabase/server";
import { listDocuments, listFolders } from "@/lib/database";
import { buildLibrary } from "@/lib/library";

// Only what a list needs: never a meeting's transcript. Includes team
// meetings and notes shared with the user, as the database already allows.
export async function getLibrary(userId: string) {
  const supabase = await createClient();
  const [folders, documents, meetings, notes] = await Promise.all([
    listFolders(userId),
    listDocuments(userId),
    supabase
      .from("meetings")
      .select("id, title, summary, created_at, action_items, decisions, video_url, user_id, folder_id, priority")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("notes")
      .select("id, title, body, created_at, user_id, folder_id, priority")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (meetings.error) console.error("Library meetings failed", meetings.error.message);
  if (notes.error) console.error("Library notes failed", notes.error.message);

  return buildLibrary({
    userId,
    folders,
    documents,
    meetings: meetings.data ?? [],
    notes: notes.data ?? [],
  });
}
