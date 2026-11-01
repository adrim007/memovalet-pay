"use client";

import { useState } from "react";

interface Board {
  id: string;
  name: string;
  lists: { id: string; name: string }[];
}

// Where new Trello cards go. Boards load only when asked for, so Settings
// doesn't call Trello on every visit.
export default function TrelloListPicker({ current }: { current: string }) {
  const [label, setLabel] = useState(current);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadBoards = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/trello/lists");
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Couldn't load your Trello boards.");
        return;
      }
      setBoards(data.boards || []);
      if (!data.boards?.length) setMessage("No open lists found in your Trello. Create a board with a list, then try again.");
    } catch {
      setMessage("Couldn't load your Trello boards.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!choice || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/trello/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: choice }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Couldn't save that list.");
        return;
      }
      setLabel(`${data.boardName ? data.boardName + " › " : ""}${data.listName}`);
      setBoards(null);
      setChoice("");
    } catch {
      setMessage("Couldn't save that list.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      {label && !boards && <p className="text-xs">Cards go to <span className="font-medium">{label}</span></p>}
      {!label && !boards && <p className="text-xs text-amber-700 dark:text-amber-400">Choose the list new cards go into.</p>}

      {boards ? (
        boards.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Trello list for new cards"
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              className="min-w-0 max-w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
            >
              <option value="">Choose a list…</option>
              {boards.map((board) => (
                <optgroup key={board.id} label={board.name}>
                  {board.lists.map((list) => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={save} disabled={!choice || busy} className="text-xs font-semibold text-violet-600 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        )
      ) : (
        <button type="button" onClick={loadBoards} disabled={busy} className="mt-1 text-xs font-semibold text-violet-600 disabled:opacity-50">
          {busy ? "Loading…" : label ? "Change list" : "Choose list"}
        </button>
      )}
      {message && <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-400">{message}</p>}
    </div>
  );
}
