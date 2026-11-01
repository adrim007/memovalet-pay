import type { CommitmentDirection } from "./types";

// How a promise is named on screen. A task you make for yourself (Create on
// Home saves it as something you owe, with no one attached) is named by what
// it is: not "Someone" above it on Work, nor "You promised someone" in Needs
// you. Promises that name a person, and anything owed to you, keep the person.
type Named = { person_name: string | null; direction: CommitmentDirection; description: string };

/** The heading over a promise on the Work page, or null when there isn't one. */
export function commitmentHeading(c: Pick<Named, "person_name" | "direction">): string | null {
  const person = c.person_name?.trim();
  if (person) return person;
  return c.direction === "they_owe" ? "Someone" : null;
}

/** The line a promise gets in Needs you. */
export function commitmentAttentionTitle(c: Named): string {
  const person = c.person_name?.trim();
  if (c.direction === "they_owe") return `${person || "Someone"} owes you: ${c.description}`;
  return person ? `You promised ${person}: ${c.description}` : c.description;
}
