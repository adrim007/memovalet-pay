"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCircle, LinkSimple, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";

type DemoKind = "launch" | "actions" | "context";
type Answer = { question: string; headline: string; body: string; source: string; sourceMeta: string };
type RpcReply = {
  result?: { content?: Array<{ type?: string; text?: string }>; tools?: unknown[]; isError?: boolean };
  error?: { message?: string };
};

const prompts: Array<{ kind: DemoKind; label: string }> = [
  { kind: "launch", label: "What did we decide about the launch?" },
  { kind: "actions", label: "What is still open?" },
  { kind: "context", label: "Why did we choose a smaller pilot?" },
];

async function request(method: string, params?: Record<string, unknown>): Promise<RpcReply> {
  const response = await fetch("/api/hackathon/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" },
    body: JSON.stringify({ jsonrpc: "2.0", ...(method.startsWith("notifications/") ? {} : { id: Date.now() }), method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("MCP request failed");
  if (response.status === 202) return {};
  const reply: RpcReply = await response.json();
  if (reply.error || reply.result?.isError) throw new Error("MCP returned an error");
  return reply;
}

function readToolPayload(reply: RpcReply): Record<string, unknown> {
  const text = reply.result?.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("The MCP tool returned no readable content");
  return JSON.parse(text) as Record<string, unknown>;
}

function buildAnswer(kind: DemoKind, payload: Record<string, unknown>): Answer {
  if (kind === "actions") {
    const items = Array.isArray(payload.actionItems) ? payload.actionItems as Array<Record<string, string>> : [];
    const body = items.length
      ? items.map((item) => `${item.owner}: ${item.task} Due ${new Date(`${item.due}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}.`).join("\n")
      : "There are no open action items in this demo workspace.";
    return {
      question: "What is still open?",
      headline: `${items.length} action items are still open`,
      body,
      source: "Acme launch planning",
      sourceMeta: "Meeting · 14 Oct 2026",
    };
  }

  if (kind === "context") {
    return {
      question: "Why did we choose a smaller pilot?",
      headline: String(payload.decision ?? "The team chose a smaller pilot."),
      body: String(payload.context ?? "The source meeting contains the supporting context."),
      source: String(payload.meeting ?? "Acme launch planning"),
      sourceMeta: "Decision · 14 Oct 2026",
    };
  }

  const results = Array.isArray(payload.results) ? payload.results as Array<Record<string, string>> : [];
  const first = results[0];
  return {
    question: "What did we decide about the launch?",
    headline: first?.decision ?? "No launch decision was found.",
    body: "MemoValet found this in the launch-planning meeting and linked the answer back to the original decision.",
    source: first?.meeting ?? "Acme launch planning",
    sourceMeta: "Decision · 14 Oct 2026",
  };
}

export default function HackathonMcpDemo() {
  const started = useRef(false);
  const [connected, setConnected] = useState(false);
  const [toolCount, setToolCount] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(true);
  const [source, setSource] = useState<{ meeting: string; date: string; decision: string; context: string; relatedOpenActions: Array<{ owner: string; task: string; due: string }> } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("What did we decide about the launch?");

  async function run(kind: DemoKind) {
    setAnswer(null);
    setSource(null);
    setBusy(true);
    setError("");
    try {
      const reply = kind === "launch"
        ? await request("tools/call", { name: "search_meeting_memory", arguments: { query: "launch" } })
        : kind === "actions"
          ? await request("tools/call", { name: "list_open_action_items", arguments: {} })
          : await request("tools/call", { name: "get_decision_context", arguments: { decisionId: "launch-date" } });
      setAnswer(buildAnswer(kind, readToolPayload(reply)));
      setQuestion(prompts.find((item) => item.kind === kind)?.label ?? "");
    } catch {
      setConnected(false);
      setError("Meeting memory is unavailable. Reload to reconnect and try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        await request("initialize", {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "MemoValet browser demo", version: "1.0.0" },
        });
        await request("notifications/initialized");
        const tools = await request("tools/list");
        setConnected(true);
        setToolCount(tools.result?.tools?.length ?? 0);
        setBusy(false);
      } catch {
        setConnected(false);
        setBusy(false);
        setError("MemoValet could not reach the local MCP demo. Start the app and try again.");
      }
    })();
  }, []);

  function submitQuestion() {
    const normalized = question.toLowerCase();
    if (normalized.includes("open") || normalized.includes("action")) void run("actions");
    else if (normalized.includes("why") || normalized.includes("smaller")) void run("context");
    else if (normalized.includes("launch") || normalized.includes("pilot")) void run("launch");
    else { setAnswer(null); setError("This guided demo covers the launch decision, its context and open actions. Try one of the three example questions."); }
  }

  async function openSource() {
    if (!connected || sourceLoading) return;
    setSourceLoading(true);
    setError("");
    try {
      const reply = await request("tools/call", { name: "get_decision_context", arguments: { decisionId: "launch-date" } });
      const payload = readToolPayload(reply);
      if (typeof payload.meeting !== "string" || typeof payload.context !== "string" || !Array.isArray(payload.relatedOpenActions)) throw new Error("Missing source");
      setSource(payload as NonNullable<typeof source>);
      sourceDialog.current?.showModal();
    } catch {
      setError("The source could not be loaded. Please try again.");
    } finally {
      setSourceLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
            <Sparkle size={15} weight="fill" /> Meeting memory · fictional demo
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Ask your meetings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
            A decision, its context, and the work still to do. All in one place.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {connected ? "Meeting memory connected" : error ? "Connection unavailable" : "Connecting meeting memory"}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Search scope">
            <span className="shrink-0 rounded-full border border-indigo-400/50 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Meetings</span>
            <span className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">Decisions</span>
            <span className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">Tasks &amp; promises</span>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); submitQuestion(); }} className="surface-card mb-5 flex items-center gap-3 rounded-2xl p-3 shadow-xl shadow-indigo-500/5">
            <MagnifyingGlass className="ml-2 shrink-0 text-[var(--muted)]" size={20} />
            <input
              aria-label="Ask MemoValet"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm font-medium outline-none placeholder:text-[var(--muted)]"
              placeholder="Ask about a decision, action or meeting"
            />
            <button type="submit" aria-label="Ask" disabled={busy || !connected || !question.trim()} className="brand-gradient-bg grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50">
              <ArrowUp size={18} weight="bold" />
            </button>
          </form>

          <div className="mb-5 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button key={prompt.kind} type="button" onClick={() => void run(prompt.kind)} disabled={busy || !connected} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-indigo-400/40 hover:text-[var(--foreground)] disabled:opacity-50">
                {prompt.label}
              </button>
            ))}
          </div>

          {error && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-600 dark:text-red-300">{error}</div>}

          <p className="mb-4 text-xs text-[var(--muted)]">Guided demo · three example questions · no AI model connected</p>

          {busy && !answer ? (
            <div className="surface-card animate-pulse space-y-4 rounded-3xl p-6 md:p-8">
              <div className="h-3 w-1/3 rounded-full bg-[var(--surface-border)]" />
              <div className="h-6 w-5/6 rounded-full bg-[var(--surface-border)]" />
              <div className="h-3 w-full rounded-full bg-[var(--surface-border)]" />
              <div className="h-16 rounded-2xl bg-[var(--surface-border)]" />
            </div>
          ) : answer ? (
            <article aria-live="polite" className="surface-card overflow-hidden rounded-3xl shadow-xl shadow-indigo-500/5">
              <div className="border-b border-[var(--surface-border)] p-6 md:p-8">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
                  <span className="brand-gradient-bg grid h-7 w-7 place-items-center rounded-lg text-white"><Sparkle size={14} weight="fill" /></span>
                  MemoValet answer
                </div>
                <p className="mb-3 text-sm font-semibold text-[var(--muted)]">{answer.question}</p>
                <h2 className="text-xl font-bold leading-snug tracking-tight md:text-2xl">{answer.headline}</h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--muted)]">{answer.body}</p>
              </div>
              <div className="bg-indigo-500/[0.035] p-5 md:px-8">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Source</p>
                <button type="button" onClick={() => void openSource()} disabled={sourceLoading || !connected} aria-haspopup="dialog" className="group flex w-full items-center gap-3 rounded-2xl border border-indigo-400/20 bg-[var(--surface)] p-4 text-left transition hover:border-indigo-400/50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><LinkSimple size={19} weight="bold" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{answer.source}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{answer.sourceMeta}</span>
                  </span>
                  <span className="text-sm font-bold text-indigo-600 transition group-hover:translate-x-0.5 dark:text-indigo-300">{sourceLoading ? "Loading source…" : "View source →"}</span>
                </button>
              </div>
            </article>
          ) : <div className="surface-card rounded-3xl p-8 md:p-10"><Sparkle size={30} className="mb-5 text-indigo-500" /><h2 className="text-xl font-bold">Pick up where the meeting left off.</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">Ask about the launch, see the decision, then open the meeting record that supports it.</p></div>}
        </section>

        <aside className="space-y-4">
          <div className="surface-card rounded-3xl p-5 shadow-xl shadow-indigo-500/5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><p className="text-sm font-bold">MCP connection</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Live proof for the hackathon demo</p></div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{connected ? "Connected" : "Pending"}</span>
            </div>
            <div className="space-y-3">
              {[
                ["Local server connected", connected],
                [`${toolCount} tools discovered`, toolCount > 0],
                ["Source returned", Boolean(answer)],
              ].map(([label, done]) => (
                <div key={String(label)} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle size={18} weight="fill" className={done ? "text-emerald-500" : "text-[var(--surface-border)]"} />
                  <span className={done ? "font-medium" : "text-[var(--muted)]"}>{String(label)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-indigo-500/[0.035] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Protocol</p>
              <p className="mt-1 text-xs font-semibold">MCP 2025-11-25</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Streamable HTTP · local demo data</p>
            </div>
          </div>

          <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-xl shadow-indigo-500/20">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-100">Why it matters</p>
            <p className="mt-3 text-lg font-bold leading-snug">Go from “what did we agree?” to the next step.</p>
            <p className="mt-3 text-xs leading-5 text-indigo-100">This workspace uses fictional meetings. Every answer shown here is retrieved from the local demo server.</p>
          </div>
        </aside>
      </div>
      <dialog ref={sourceDialog} aria-labelledby="source-title" className="m-auto w-[min(680px,calc(100%-32px))] rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-slate-950/40">
        <div className="p-7 md:p-9">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Source meeting · fictional data</p><h2 id="source-title" className="mt-3 text-2xl font-bold">{source?.meeting}</h2><p className="mt-2 text-sm text-[var(--muted)]">{source?.date}</p></div><button autoFocus onClick={() => sourceDialog.current?.close()} className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm font-semibold">Close</button></div>
          <div className="mt-7 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-slate-900"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-600">Recorded decision</p><p className="text-lg font-semibold leading-7">{source?.decision}</p></div>
          <h3 className="mt-6 font-bold">Why the team chose this</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{source?.context}</p>
          <h3 className="mt-6 font-bold">Related open actions</h3><ul className="mt-3 space-y-3">{source?.relatedOpenActions.map((action) => <li key={action.task} className="rounded-xl border border-[var(--surface-border)] p-3 text-sm"><span className="font-bold">{action.owner}</span><span className="float-right text-xs text-[var(--muted)]">Due {action.due}</span><p className="mt-1 text-[var(--muted)]">{action.task}</p></li>)}</ul>
        </div>
      </dialog>
    </div>
  );
}
