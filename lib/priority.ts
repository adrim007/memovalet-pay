/**
 * How urgent something is: the same three levels the tasks off a meeting have
 * always used, now available on the things you keep as well.
 *
 * No level is the normal state. Most of a library is neither urgent nor not —
 * marking everything would make the marks mean nothing.
 */

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** What can carry a level and be changed after it has been created. */
export type PriorityKind =
  | "meeting"
  | "file"
  | "note"
  | "project"
  | "task"
  | "sent-task"
  | "commitment";
export const PRIORITY_KINDS: PriorityKind[] = [
  "meeting",
  "file",
  "note",
  "project",
  "task",
  "sent-task",
  "commitment",
];

export function asPriority(value: unknown): Priority | null {
  return PRIORITIES.find((level) => level === value) ?? null;
}

/** Sorts high first and unmarked last, so a list can lead with what matters. */
export function priorityRank(value: Priority | null | undefined): number {
  const at = PRIORITIES.indexOf(value as Priority);
  return at === -1 ? PRIORITIES.length : at;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** The colours the Work page already uses, so a level reads the same anywhere. */
export const PRIORITY_CHIP: Record<Priority, string> = {
  high: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/** A dot for places too tight for a word. */
export const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};
