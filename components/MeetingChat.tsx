"use client";

import { useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function MeetingChat({ meetingId }: { meetingId: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/meetings/${meetingId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!response.ok) throw new Error("Failed to get an answer");

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
    } catch {
      setError("Couldn't get an answer. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card rounded-2xl p-6 md:p-7 space-y-4 shadow-xl shadow-indigo-500/5">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
        Ask About This Meeting
      </h2>

      {messages.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          Ask anything grounded in this meeting&apos;s transcript, like &quot;what did Marcus commit
          to?&quot;
        </p>
      )}

      {messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "text-sm rounded-xl px-3.5 py-2.5 brand-gradient-bg text-white ml-auto max-w-[85%] w-fit"
                  : "text-sm rounded-xl px-3.5 py-2.5 border border-[var(--surface-border)] max-w-[85%] w-fit whitespace-pre-line"
              }
            >
              {m.text}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-border)] border-t-indigo-400 animate-spin" />
          Thinking…
        </div>
      )}

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask a question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="brand-gradient-bg text-white font-medium px-4 py-2.5 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50 shrink-0"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
