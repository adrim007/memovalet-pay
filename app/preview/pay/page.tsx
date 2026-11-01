"use client";

import { useRef, useState, type FormEvent } from "react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type Draft = { payerEmail: string; currency: string; dueDate: string; items: { name: string; quantity: number; unitAmount: string }[] };
type Proposal = { proposalId: string; payerName: string; total: string; draft: Draft; source: { meeting: string; quote: string }; meeting: { title: string; transcriptExcerpt: string[] } };
type Invoice = { id: string; status: string; amount?: { currency_code: string; value: string }; dueDate?: string; href?: string };
type Reminder = { status: "draft"; to?: string; subject: string; body: string } | { status: "not_needed"; reason: string };
type Step = "start" | "proposed" | "sent";
type Card = { tool: string; data: Record<string, unknown> };
type Turn = { conversationId: string; reply: string; cards: Card[] };
type Line = { who: "you" | "ai" | "note"; text: string };

const SUGGESTION = "Bill Harbour Bakery for the deposit we agreed";

// Without an AI key the page is an MCP client of MemoValet Pay's own server, the same way the assistant is.
async function callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = new Client({ name: "memovalet-pay-screen", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/api/paypal/mcp", window.location.origin)));
  try {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text?: string }[])?.[0]?.text ?? "";
    if (result.isError) throw new Error(text || "The tool refused.");
    return (result.structuredContent ?? JSON.parse(text)) as T;
  } finally {
    await client.close();
  }
}

// Asks the AI assistant. Returns null when no AI key is set, so the page can call the tools itself.
async function askAssistant(text: string, conversationId: string, approvalToken?: string): Promise<Turn | null> {
  const res = await fetch("/api/paypal/assistant", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, conversationId: conversationId || undefined, approvalToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503 && data.noAi) return null;
  if (!res.ok) throw new Error(data.error ?? "The assistant couldn't answer.");
  return data as Turn;
}

export default function PayPreview() {
  const [step, setStep] = useState<Step>("start");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [approvedAt, setApprovedAt] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [aiOff, setAiOff] = useState(false);
  const [request, setRequest] = useState(SUGGESTION);
  const statusRef = useRef<HTMLDivElement>(null);

  const say = (who: Line["who"], text: string) => setLines(current => [...current, { who, text }]);

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label); setError("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(""); }
  }

  function showSent(sent: { invoice: Invoice; approvedAt: string }) {
    setInvoice(sent.invoice); setApprovedAt(sent.approvedAt); setStep("sent");
    setTimeout(() => statusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  // The cards come from the tools the assistant called, so the screen shows exactly what MemoValet returned.
  function show(cards: Card[]) {
    for (const { tool, data } of cards) {
      if (tool === "propose_invoice") { setProposal(data as unknown as Proposal); setStep("proposed"); }
      if (tool === "send_invoice") showSent(data as unknown as { invoice: Invoice; approvedAt: string });
      if (tool === "invoice_status") setInvoice((data as { invoice: Invoice }).invoice);
      if (tool === "draft_payment_reminder") setReminder((data as { reminder: Reminder }).reminder);
    }
  }

  async function converse(text: string, direct: () => Promise<void>, approvalToken?: string) {
    say("you", text);
    const turn = aiOff ? null : await askAssistant(text, conversationId, approvalToken);
    if (turn) {
      setConversationId(turn.conversationId); show(turn.cards); say("ai", turn.reply);
      return;
    }
    if (!aiOff) {
      setAiOff(true);
      say("note", "No AI key is set, so this page is calling the MemoValet tools itself. Add GEMINI_API_KEY to .env.local to let the assistant do it.");
    }
    await direct();
  }

  const proposeDirect = async () => {
    setProposal(await callTool<Proposal>("propose_invoice")); setStep("proposed");
  };

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const text = request.trim();
    if (text) run("Reading the meeting", () => converse(text, proposeDirect));
  };

  const approveAndSend = () => run("Sending in the PayPal sandbox", async () => {
    if (!proposal) return;
    const res = await fetch("/api/paypal/approve", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.proposalId, total: proposal.total, payerEmail: proposal.draft.payerEmail }),
    });
    const approval = await res.json();
    if (!res.ok) throw new Error(approval.error ?? "Approval failed.");
    await converse("I've approved the invoice on the card. Please send it.", async () => {
      showSent(await callTool<{ invoice: Invoice; approvedAt: string }>("send_invoice", { proposalId: proposal.proposalId, approvalToken: approval.approvalToken }));
    }, approval.approvalToken);
  });

  const refresh = () => run("Checking PayPal", () => invoice ? converse(`Has invoice ${invoice.id} been paid?`, async () => {
    setInvoice((await callTool<{ invoice: Invoice }>("invoice_status", { invoiceId: invoice.id })).invoice);
  }) : Promise.resolve());

  const remind = () => run("Writing a reminder", () => invoice ? converse(`Draft a payment reminder for invoice ${invoice.id}.`, async () => {
    setReminder((await callTool<{ reminder: Reminder }>("draft_payment_reminder", { invoiceId: invoice.id })).reminder);
  }) : Promise.resolve());

  const money = (value: string, currency: string) => `${currency} ${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
  const paid = invoice?.status === "PAID" || invoice?.status === "MARKED_AS_PAID";

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-[var(--muted)]">MemoValet Pay · PayPal sandbox, test money only · fictional sample</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight">Turn what was agreed in a meeting into a paid invoice</h1>
          <p className="text-[var(--muted)]">The AI assistant finds the payment you agreed, drafts the invoice and waits. Nothing is sent until you approve the exact amount and payer.</p>
        </header>

        <section aria-label="Assistant" className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          {lines.length > 0 && (
            <ol aria-live="polite" className="mb-4 space-y-3 text-sm">
              {lines.map((line, index) => (
                <li key={index} className={line.who === "you" ? "text-right" : ""}>
                  <span className="block text-xs font-semibold text-[var(--muted)]">{line.who === "you" ? "You" : line.who === "ai" ? "MemoValet assistant (AI)" : "Note"}</span>
                  <span className={`mt-1 inline-block rounded-2xl px-4 py-2 ${line.who === "you" ? "bg-[var(--foreground)] text-[var(--background)]" : line.who === "ai" ? "bg-[var(--background)]" : "bg-amber-50 text-amber-900"}`}>{line.text}</span>
                </li>
              ))}
            </ol>
          )}
          {step === "start" && (
            <form onSubmit={ask} className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="pay-request" className="sr-only">Ask the assistant</label>
              <input id="pay-request" value={request} onChange={event => setRequest(event.target.value)} maxLength={500} disabled={!!busy}
                className="min-w-0 flex-1 rounded-full border border-[var(--surface-border)] bg-[var(--background)] px-5 py-3" />
              <button type="submit" disabled={!!busy || !request.trim()}
                className="rounded-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-5 py-3 font-semibold text-white disabled:opacity-60">
                {busy || "Ask"}
              </button>
            </form>
          )}
        </section>

        {proposal && (
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">{proposal.meeting.title}</h2>
            <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
              {proposal.meeting.transcriptExcerpt.map(line => (
                <li key={line} className={line === proposal.source.quote ? "font-semibold text-[var(--foreground)]" : ""}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        {proposal && (
          <section aria-labelledby="card-title" className="rounded-2xl border-2 border-[var(--accent-from)] bg-[var(--surface)] p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="card-title" className="text-lg font-bold">Invoice to approve</h2>
              <span className="text-2xl font-extrabold tabular-nums">{money(proposal.total, proposal.draft.currency)}</span>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[var(--muted)]">To</dt><dd>{proposal.payerName}, {proposal.draft.payerEmail}</dd>
              {proposal.draft.items.map(item => (
                <div key={item.name} className="contents"><dt className="text-[var(--muted)]">For</dt><dd>{item.quantity} × {item.name}, {money(item.unitAmount, proposal.draft.currency)}</dd></div>
              ))}
              <dt className="text-[var(--muted)]">Due</dt><dd>{new Date(proposal.draft.dueDate + "T00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</dd>
              <dt className="text-[var(--muted)]">From</dt><dd>&ldquo;{proposal.source.quote}&rdquo;</dd>
            </dl>
            {step === "proposed" && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={approveAndSend} disabled={!!busy}
                  className="rounded-full bg-[var(--foreground)] px-5 py-3 font-semibold text-[var(--background)] disabled:opacity-60">
                  {busy || "Approve and send"}
                </button>
                <button type="button" onClick={() => { setProposal(null); setStep("start"); }} disabled={!!busy}
                  className="rounded-full border border-[var(--surface-border)] px-5 py-3 font-semibold">Not now</button>
              </div>
            )}
            {approvedAt && <p className="mt-4 text-sm text-[var(--muted)]">Approved by you at {new Date(approvedAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}. The approval covered this exact amount, payer and due date.</p>}
          </section>
        )}

        {invoice && (
          <section ref={statusRef} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">PayPal sandbox invoice {invoice.id}</h2>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${paid ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{invoice.status}</span>
            </div>
            {invoice.href && <p className="mt-2 text-sm"><a className="underline" href={invoice.href} target="_blank" rel="noreferrer">Open the invoice as the buyer sees it</a></p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={refresh} disabled={!!busy} className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold">{busy === "Checking PayPal" ? busy : "Check if it's paid"}</button>
              {!paid && <button type="button" onClick={remind} disabled={!!busy} className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold">{busy === "Writing a reminder" ? busy : "Draft a reminder"}</button>}
            </div>
            {reminder && (reminder.status === "draft" ? (
              <div className="mt-4 rounded-xl bg-[var(--background)] p-4 text-sm">
                <p className="font-semibold">Draft only, not sent: {reminder.subject}</p>
                <p className="mt-2 whitespace-pre-line text-[var(--muted)]">{reminder.body}</p>
              </div>
            ) : <p className="mt-4 text-sm text-[var(--muted)]">No reminder needed. {reminder.reason}</p>)}
          </section>
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
      </div>
    </main>
  );
}
