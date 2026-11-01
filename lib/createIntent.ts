import { en } from "chrono-node";

// What the home bar's Create mode makes from what you type. Pure, so the rules
// can be tested without a browser.
//
// Plain words ("Call Sarah Friday") are a task. Starting with a keyword picks
// something else: "note …", "project …", "meeting". The words only ever go to
// your own lists — Create never sends anything to anyone.

export type CreateIntent =
  | { kind: "task"; text: string }
  | { kind: "note"; text: string }
  | { kind: "project"; text: string }
  | { kind: "meeting" }
  // A keyword with nothing after it, or a file (which can't be made from words).
  | { kind: "open"; href: string; label: string };

const MAX_TEXT = 500;
const MAX_NOTE = 5000;

// "note buy grout", "New project: Orion", "add a task – call Sarah", "to-do pay invoice".
const KEYWORD = /^(?:(?:new|add|create|start|make|finish|complete|schedule)\s+)?(?:(?:a|an)\s+)?(note|project|meeting|task|to-?do|document|file)\b\s*[:\-–—]?\s*/i;

const PAGE: Record<string, { href: string; label: string }> = {
  note: { href: "/notes", label: "Notes" },
  project: { href: "/projects", label: "Projects" },
  task: { href: "/tasks", label: "Tasks" },
};

export function createIntent(input: string): CreateIntent | null {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return null;

  let found = KEYWORD.exec(text);
  let prefix = "";
  if (!found) {
    // Recognise the item type after a leading date or time without treating
    // ordinary task wording, such as "call the project manager", as a project.
    for (const boundary of text.matchAll(/\s+/g)) {
      const offset = boundary.index! + boundary[0].length;
      const candidate = KEYWORD.exec(text.slice(offset));
      if (!candidate) continue;
      const leading = text.slice(0, offset).trim();
      const dates = en.GB.parse(leading);
      let remaining = leading;
      for (const date of [...dates].reverse()) remaining = remaining.slice(0, date.index) + remaining.slice(date.index + date.text.length);
      if (dates.length && /^(?:\s|[,;:]|\b(?:at|on|by)\b)*$/i.test(remaining)) {
        found = candidate;
        prefix = text.slice(0, offset);
        break;
      }
    }
  }
  if (!found) return { kind: "task", text: text.slice(0, MAX_TEXT) };

  const keyword = found[1].toLowerCase().replace("-", "");
  const rest = `${prefix}${text.slice(prefix.length + found[0].length)}`.trim();

  if (keyword === "meeting") return { kind: "meeting" };
  if (keyword === "document" || keyword === "file") return { kind: "open", href: "/documents", label: "Files" };

  const kind = keyword === "todo" ? "task" : (keyword as "note" | "project" | "task");
  if (!rest) return { kind: "open", ...PAGE[kind] };
  return { kind, text: rest.slice(0, kind === "note" ? MAX_NOTE : MAX_TEXT) };
}

// Where each kind is saved. Tasks are kept as "I owe" items, which the Tasks page lists.
export function createRequest(intent: CreateIntent): { url: string; body: Record<string, string> } | null {
  if (intent.kind === "task") {
    return {
      url: "/api/commitments",
      body: { description: intent.text, direction: "i_owe" },
    };
  }
  if (intent.kind === "note") return { url: "/api/notes", body: { body: intent.text } };
  if (intent.kind === "project") return { url: "/api/projects", body: { name: intent.text } };
  return null;
}

// Shown under the bar while typing, so you know what Create will do before pressing it.
export function createHint(intent: CreateIntent | null): string {
  if (!intent) return "Type a task, or start with “note”, “project” or “meeting”.";
  switch (intent.kind) {
    case "task":
      return `Adds a task: “${intent.text}”`;
    case "note":
      return `Saves a note: “${intent.text}”`;
    case "project":
      return `Makes a project: “${intent.text}”`;
    case "meeting":
      return "Opens the meeting page";
    case "open":
      return `Opens ${intent.label}`;
  }
}
