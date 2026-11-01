"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { speakReply } from "@/lib/spokenReply";
import { spokenSummary } from "@/lib/spokenSummary";

type AskScope = "everything" | "meetings" | "tasks" | "projects" | "documents" | "people" | "notes";

interface QA {
  question: string;
  answer: string;
  sources: string[];
  sourceLinks: Record<string, string>;
}

const suggestions = [
  "What did we decide last time?",
  "What's overdue right now?",
  "What's coming up this week?",
];

const SCOPES: { id: AskScope; label: string }[] = [
  { id: "everything", label: "Everything" },
  { id: "meetings", label: "Meetings" },
  { id: "tasks", label: "Tasks & promises" },
  { id: "projects", label: "Projects" },
  { id: "documents", label: "Documents" },
  { id: "notes", label: "Notes" },
  { id: "people", label: "People" },
];

export default function AskClient({ sampleMemory = false }: { sampleMemory?: boolean }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<QA[]>([]);
  const [meetingsSearched, setMeetingsSearched] = useState<number | null>(null);
  const [itemsSearched, setItemsSearched] = useState<number | null>(null);
  const [scope, setScope] = useState<AskScope>(sampleMemory ? "meetings" : "everything");

  // spoken: the question was asked by voice on the dashboard, so the gist of the answer is read out.
  const ask = async (q: string, spoken = false) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");

    try {
      const data = sampleMemory ? await (await import("@/lib/hackathon/ask-memory")).askSampleMemory(trimmed) : await (async () => {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, scope }),
          signal: AbortSignal.timeout(45000),
        });

        if (!response.ok) throw new Error("failed");

        return response.json();
      })();
      setHistory((prev) => [
        {
          question: trimmed,
          answer: data.answer,
          sources: data.sources || [],
          sourceLinks: data.sourceLinks || {},
        },
        ...prev,
      ]);
      if (spoken) void speakReply(spokenSummary(data.answer), sampleMemory ? "/api/hackathon/speak" : "/api/speak");
      setMeetingsSearched(typeof data.meetingsSearched === "number" ? data.meetingsSearched : null);
      setItemsSearched(typeof data.itemsSearched === "number" ? data.itemsSearched : null);
      setQuestion("");
    } catch {
      setError("Something went wrong answering that. Mind trying again?");
      if (spoken) void speakReply("Something went wrong answering that. Mind trying again?", sampleMemory ? "/api/hackathon/speak" : "/api/speak");
    } finally {
      setLoading(false);
    }
  };

  // The dashboard search bar hands its question over as ?q= (and &voice=1 when it was spoken), and
  // it is asked once on arrival so the user lands on an answer, not an empty box.
  const searchParams = useSearchParams();
  const autoAsked = useRef(false);
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoAsked.current) {
      autoAsked.current = true;
      setQuestion(q);
      void ask(q, searchParams.get("voice") === "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1">Ask</h1>
      <p className="text-[var(--muted)] mb-5 text-base">
        Ask anything about your meetings and work. Answers link back to the source.
        {itemsSearched !== null && (
          <span className="text-xs text-[var(--muted)]">
            {" "}
            ({itemsSearched} items searched{meetingsSearched ? ` across ${meetingsSearched} meetings` : ""})
          </span>
        )}
      </p>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Ask scope">
        {(sampleMemory ? SCOPES.filter(item => item.id === "meetings") : SCOPES).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scope === item.id}
            onClick={() => setScope(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              scope === item.id
                ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                : "border-[var(--surface-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="surface-card rounded-2xl p-4 flex gap-2 mb-4"
      >
        <input
          aria-label="Ask MemoValet"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a decision, task, or meeting"
          className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="brand-gradient-bg text-white font-medium px-5 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shrink-0"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {history.length === 0 && !loading && (
        <div className="surface-card mb-6 rounded-2xl p-5">
          <p className="text-sm font-semibold">Try asking a useful question</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            MemoValet searches the scope you chose and shows which saved items support its answer.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(sampleMemory ? ["What did we decide about the launch?", "Why did we choose a smaller pilot?", "What is still open?"] : suggestions).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--surface-border)] text-[var(--muted)] hover:border-indigo-400/40 hover:bg-indigo-400/5 hover:text-[var(--foreground)] transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      {loading && (
        <div className="surface-card rounded-2xl p-6 mb-4 animate-pulse space-y-2">
          <div className="h-3 w-2/3 rounded bg-[var(--surface-border)]" />
          <div className="h-3 w-full rounded bg-[var(--surface-border)]" />
          <div className="h-3 w-1/2 rounded bg-[var(--surface-border)]" />
        </div>
      )}

      <div className="space-y-4">
        {history.map((qa, i) => (
          <div key={i} className="surface-card rounded-2xl p-6">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
              {qa.question}
            </p>
            <p className="text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-line">
              {qa.answer}
            </p>
            {qa.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {qa.sources.map((s, j) =>
                  qa.sourceLinks[s] ? (
                    <Link
                      key={`${s}-${j}`}
                      href={qa.sourceLinks[s]}
                      className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-400/20 dark:text-indigo-300"
                    >
                      {s} →
                    </Link>
                  ) : (
                    <span
                      key={`${s}-${j}`}
                      className="text-xs px-2.5 py-1 rounded-full bg-indigo-400/10 text-[var(--muted)]"
                    >
                      {s}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
