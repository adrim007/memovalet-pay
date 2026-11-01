/**
 * Which table each kind of thing lives in, and which column says who owns it.
 *
 * One source of truth on purpose. Deleting something and changing it both hang
 * on getting the owner column right, and the columns disagree — a meeting is
 * owned by user_id, a project by created_by. Two copies of that list would
 * eventually drift, and the way it would show up is somebody editing a row that
 * was never theirs.
 */
export type OwnedKind =
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

export const OWNED: Record<OwnedKind, { table: string; owner: string }> = {
  meeting: { table: "meetings", owner: "user_id" },
  file: { table: "documents", owner: "user_id" },
  note: { table: "notes", owner: "user_id" },
  project: { table: "projects", owner: "created_by" },
  task: { table: "action_items", owner: "user_id" },
  "sent-task": { table: "task_assignments", owner: "created_by" },
  person: { table: "people", owner: "user_id" },
  team: { table: "teams", owner: "created_by" },
  commitment: { table: "commitments", owner: "user_id" },
  reminder: { table: "reminders", owner: "user_id" },
};
