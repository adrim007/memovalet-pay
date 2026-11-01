import { createClient } from "@/lib/supabase/server";
import { parseRecordingPath } from "@/lib/recording-path";
import { OWNED } from "@/lib/owned-items";

/** Everything a person can delete. The name is what the app calls it, not the table. */
export type DeletableKind =
  | "meeting"
  | "file"
  | "note"
  | "project"
  | "task"
  | "sent-task"
  | "person"
  | "team"
  | "commitment"
  | "reminder";

export type DeleteOutcome = "deleted" | "not_found" | "failed";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

// The database already removes what belongs to a row: a meeting takes its action
// items and translations, a team takes its members and invites, and a deleted
// project or team leaves the meetings under it alone. Two things it can't see to,
// and this does:
//   * files in storage — a recording, an upload, a photo — which would otherwise
//     keep taking up space, and in the case of photos stay readable by URL;
//   * "shared with" rows, which would otherwise leave the item listed in someone
//     else's library with nothing behind it.
// Both happen before the row goes, so a failure leaves something still visible
// and still deletable rather than a hidden orphan.

type Plan = {
  table: string;
  /** Column holding the id of the person allowed to delete the row. */
  owner: string;
  /** Read before deleting, so clean-up knows what else to remove. */
  columns: string;
  cleanUp?: (supabase: Client, row: Row, userId: string) => Promise<void>;
};

// Storage and the database can blip for a moment. Each clean-up step gets a
// few tries, so a momentary error doesn't leave someone unable to delete; a
// lasting one still stops the delete rather than call it done while their
// files or share listings remain. Removing an already-removed file succeeds,
// so a retry after a partial clean-up finishes the job.
const TRIES = 3;
async function retrying(what: string, step: () => PromiseLike<{ error: { message: string } | null }>) {
  let last = "";
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const { error } = await step();
    if (!error) return;
    last = error.message;
    if (attempt < TRIES) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw new Error(`${what}: ${last}`);
}

async function remove(supabase: Client, bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  await retrying(`Couldn't remove a file from ${bucket}`, () => supabase.storage.from(bucket).remove(paths));
}

/** The path inside `bucket` that a public URL points at, or null if it points elsewhere. */
function publicUrlPath(value: unknown, bucket: string): string | null {
  if (typeof value !== "string") return null;
  const marker = `/object/public/${bucket}/`;
  const at = value.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(value.slice(at + marker.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}

async function clearShares(supabase: Client, userId: string, itemType: string, id: string) {
  await retrying("Couldn't clear shares before deleting", () => supabase
    .from("shared_items")
    .delete()
    .eq("item_type", itemType)
    .eq("item_id", id)
    .eq("owner_id", userId));
}

const PLANS: Record<DeletableKind, Plan> = {
  // A meeting can hold several recordings — one per time it was restarted — and
  // every one of them has to go, not just the one the page plays first. The
  // share link lives on the row itself, so deleting it also kills the link;
  // anyone it was sent to in-app has to be let go of separately.
  meeting: {
    ...OWNED.meeting,
    columns: "id, video_url, metadata",
    async cleanUp(supabase, row, userId) {
      await clearShares(supabase, userId, "meeting", String(row.id));
      const metadata = row.metadata as { recording_urls?: unknown } | null;
      const clips = Array.isArray(metadata?.recording_urls) ? metadata.recording_urls : [];
      const paths = new Set<string>();
      for (const value of [row.video_url, ...clips]) {
        const path = typeof value === "string" ? parseRecordingPath(value) : null;
        if (path) paths.add(path);
      }
      await remove(supabase, "meeting-recordings", [...paths]);
    },
  },
  file: {
    ...OWNED.file,
    columns: "id, file_path",
    async cleanUp(supabase, row) {
      if (typeof row.file_path === "string" && row.file_path)
        await remove(supabase, "personal-documents", [row.file_path]);
    },
  },
  note: {
    ...OWNED.note,
    columns: "id",
    cleanUp: (supabase, row, userId) => clearShares(supabase, userId, "note", String(row.id)),
  },
  project: {
    ...OWNED.project,
    columns: "id",
    cleanUp: (supabase, row, userId) => clearShares(supabase, userId, "project", String(row.id)),
  },
  // A task off a meeting. Its photo is world-readable by URL, so it goes too.
  task: {
    ...OWNED.task,
    columns: "id, photo_url",
    async cleanUp(supabase, row) {
      const path = publicUrlPath(row.photo_url, "task-photos");
      if (path) await remove(supabase, "task-photos", [path]);
    },
  },
  // A task you sent someone. Any payment row stays — the database detaches it
  // rather than deleting it, so what was charged is still on record.
  "sent-task": {
    ...OWNED["sent-task"],
    columns: "id, completion_file_url",
    async cleanUp(supabase, row) {
      const path = publicUrlPath(row.completion_file_url, "task-photos");
      if (path) await remove(supabase, "task-photos", [path]);
    },
  },
  person: { ...OWNED.person, columns: "id" },
  team: { ...OWNED.team, columns: "id" },
  commitment: { ...OWNED.commitment, columns: "id" },
  reminder: { ...OWNED.reminder, columns: "id" },
};

export const DELETABLE_KINDS = Object.keys(PLANS) as DeletableKind[];

/**
 * Deletes one thing the person owns, plus whatever only it was using.
 * Returns "not_found" when it doesn't exist or belongs to someone else — the two
 * are deliberately indistinguishable to the caller.
 */
export async function deleteItem(
  supabase: Client,
  userId: string,
  kind: DeletableKind,
  id: string
): Promise<DeleteOutcome> {
  const plan = PLANS[kind];
  if (!plan) return "not_found";

  const { data: row, error: readError } = await supabase
    .from(plan.table)
    .select(plan.columns)
    .eq("id", id)
    .eq(plan.owner, userId)
    .maybeSingle();
  if (readError) return "failed";
  if (!row) return "not_found";

  // The table name is only known at runtime, so the client can't type the row.
  try {
    if (plan.cleanUp) await plan.cleanUp(supabase, row as unknown as Row, userId);
  } catch (error) {
    console.error(`Cleanup for ${kind} failed`, error);
    return "failed";
  }

  const { error } = await supabase.from(plan.table).delete().eq("id", id).eq(plan.owner, userId);
  if (error) {
    console.error(`Deleting a ${kind} failed`, error.message);
    return "failed";
  }
  return "deleted";
}
