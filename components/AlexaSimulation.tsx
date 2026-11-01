"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { saveSampleMeeting } from "@/components/HackathonHomeFlow";

// A simulated Alexa+ smart display for the hackathon sample workspace. The assistant behind it
// is an AI model (Gemini by default), acting through MemoValet's MCP server (see /api/hackathon/assistant).

// Replies are spoken aloud like Alexa's: in Gemini's natural voice when it answers within
// VOICE_WAIT_MS, otherwise in the browser's own voice (Australian English when it has one).
const VOICE_WAIT_MS = 8000;
let playing: HTMLAudioElement | null = null;
let pending: AbortController | null = null;

function browserVoice(text: string) {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-AU";
  utterance.voice = voices.find(voice => voice.lang === "en-AU") ?? voices.find(voice => voice.lang.startsWith("en")) ?? null;
  window.speechSynthesis.speak(utterance);
}
async function speak(text: string) {
  hush();
  const controller = new AbortController();
  pending = controller;
  const timer = setTimeout(() => controller.abort(), VOICE_WAIT_MS);
  try {
    const response = await fetch("/api/hackathon/speak", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: controller.signal,
    });
    if (!response.ok) throw new Error("Voice unavailable");
    const url = URL.createObjectURL(await response.blob());
    if (pending !== controller) { URL.revokeObjectURL(url); return; } // a newer reply or the microphone took over
    playing = new Audio(url);
    playing.onended = () => URL.revokeObjectURL(url);
    await playing.play();
  } catch {
    if (pending === controller) browserVoice(text);
  } finally {
    clearTimeout(timer);
    if (pending === controller) pending = null;
  }
}
function hush() {
  const waiting = pending;
  pending = null;
  waiting?.abort();
  playing?.pause();
  playing = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

type Card = { tool: string; data: Record<string, unknown> };
type Turn = { user: string; reply: string; cards: Card[] };
type Task = { task: string; owner: string | null; due_date?: string | null; due?: string };
type Slot = { start: string; label: string };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; start: () => void; stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

const SUGGESTIONS = ["What's left from the launch meeting?", "Set up a follow up for the launch meeting"];
const STEP_LABELS: Record<string, string> = {
  search_meeting_memory: "Searched your meetings",
  list_open_action_items: "Read open tasks",
  get_decision_context: "Read the decision",
  prepare_follow_through: "Prepared the follow up plan",
  find_follow_up_times: "Found times that work",
  book_follow_up: "Booked the follow up",
  draft_task_reminders: "Drafted reminders",
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Sample dates arrive as YYYY MM DD; on screen they always read as words.
function inWords(date?: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "No date yet";
  const day = new Date(`${date}T12:00:00Z`);
  return `${DAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
}

function Initial({ name }: { name?: string | null }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-sm font-semibold text-white">
      {(name || "?").slice(0, 1)}
    </span>
  );
}

function Panel({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`rounded-3xl border p-5 ${accent ? "border-emerald-300/40 bg-emerald-400/10" : "border-white/10 bg-white/[0.06]"}`}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">{title}</h3>
      {children}
    </section>
  );
}

function CardView({ card, booked, busy, onPick }: { card: Card; booked: string | null; busy: boolean; onPick: (slot: Slot) => void }) {
  const data = card.data;
  if (card.tool === "prepare_follow_through") {
    const tasks = (data.openTasks as Task[]) ?? [];
    const source = data.source as { title?: string; href?: string } | undefined;
    const followUp = data.followUp as { title?: string; durationMinutes?: number } | undefined;
    return (
      <Panel title={`From ${source?.title ?? "your meeting"}`}>
        <ul className="space-y-3">
          {tasks.map(task => (
            <li key={task.task} className="flex items-center gap-3">
              <Initial name={task.owner} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-white">{task.task}</p>
                <p className="text-sm text-white/60">{task.owner ?? "Owner needed"} · due {inWords(task.due_date)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm text-white/70">
          <span>Suggested: {followUp?.title} · {followUp?.durationMinutes} minutes</span>
          {source?.href && <Link href={source.href} className="shrink-0 font-medium text-cyan-300 hover:text-cyan-200">Open meeting</Link>}
        </div>
      </Panel>
    );
  }
  if (card.tool === "find_follow_up_times") {
    const slots = (data.slots as Slot[]) ?? [];
    return (
      <Panel title="Pick a time">
        <p className="mb-3 text-sm text-white/70">{String(data.reason ?? "")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {slots.map(slot => {
            const chosen = booked === slot.start;
            const [day, time] = slot.label.split(" at ");
            return (
              <button
                key={slot.start} type="button" aria-label={slot.label} disabled={busy || Boolean(booked)} onClick={() => onPick(slot)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${chosen ? "border-emerald-300 bg-emerald-400/20 text-white" : "border-white/15 bg-white/[0.04] text-white hover:border-cyan-300/70 hover:bg-cyan-300/10 disabled:opacity-50"}`}
              >
                <span className="block text-sm text-white/70">{day}</span>
                <span className="block text-2xl font-semibold">{time}</span>
                <span className="mt-1 block text-xs text-white/55">{chosen ? "Booked" : "30 minutes"}</span>
              </button>
            );
          })}
        </div>
      </Panel>
    );
  }
  if (card.tool === "book_follow_up") {
    const booking = data.booking as { title: string; label: string; attendees: string[] };
    return (
      <Panel title="Booked" accent>
        <p className="text-lg font-semibold text-white">{booking.title}</p>
        <p className="mt-1 text-white/80">{booking.label}, Melbourne time · {booking.attendees.join(", ")}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/70">
          <span>Saved to the sample calendar in this browser. No invitations sent.</span>
          <Link href="/preview/calendar?scenario=launch" className="shrink-0 font-medium text-cyan-300 hover:text-cyan-200">View in MemoValet</Link>
        </div>
      </Panel>
    );
  }
  if (card.tool === "draft_task_reminders") {
    const drafts = (data.drafts as { to: string; message: string }[]) ?? [];
    return (
      <Panel title="Reminders drafted, not sent">
        <ul className="space-y-3">
          {drafts.map(draft => (
            <li key={draft.to} className="flex gap-3">
              <Initial name={draft.to} />
              <p className="text-sm leading-relaxed text-white/85"><span className="font-semibold text-white">To {draft.to}: </span>{draft.message}</p>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }
  if (card.tool === "list_open_action_items") {
    const items = (data.actionItems as Task[]) ?? [];
    return (
      <Panel title="Open tasks">
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.task} className="flex items-center gap-3">
              <Initial name={item.owner} />
              <p className="text-[15px] text-white">{item.task} <span className="text-white/60">· {item.owner} · due {inWords(item.due)}</span></p>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }
  if (card.tool === "get_decision_context") {
    return (
      <Panel title={`Decision from ${String(data.meeting ?? "")}`}>
        <p className="text-[15px] font-medium text-white">{String(data.decision ?? "")}</p>
        <p className="mt-2 text-sm text-white/70">{String(data.context ?? "")}</p>
      </Panel>
    );
  }
  if (card.tool === "search_meeting_memory") {
    const results = (data.results as { meeting: string; decision: string }[]) ?? [];
    return (
      <Panel title="Found in your meetings">
        <ul className="space-y-2">{results.map(result => <li key={result.decision} className="text-sm text-white/85"><span className="font-semibold text-white">{result.meeting}: </span>{result.decision}</li>)}</ul>
      </Panel>
    );
  }
  return null;
}

export default function AlexaSimulation() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const latest = turns.at(-1);

  useEffect(() => () => { recognition.current?.stop(); hush(); }, []);

  async function ask(text: string, confirmStart?: string) {
    const said = text.trim();
    if (!said || busy) return;
    hush(); setBusy(true); setError(""); setDraft("");
    setTurns(previous => [...previous, { user: said, reply: "", cards: [] }]);
    try {
      const response = await fetch("/api/hackathon/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text: said, confirmStart }),
      });
      const turn = await response.json();
      if (!response.ok) throw new Error(turn.error || "The assistant couldn't answer just now.");
      setConversationId(turn.conversationId);
      for (const card of turn.cards as Card[]) {
        if (card.tool !== "book_follow_up") continue;
        const booking = card.data.booking as { title: string; start: string };
        saveSampleMeeting(booking.title, booking.start);
        setBooked(booking.start);
      }
      setTurns(previous => [...previous.slice(0, -1), { user: said, reply: turn.reply, cards: turn.cards }]);
      void speak(turn.reply);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      setTurns(previous => previous.slice(0, -1));
    } finally { setBusy(false); }
  }

  function listen() {
    const Recognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Recognition) { setError("Voice input needs Chrome or Edge. You can type instead."); return; }
    if (listening) { recognition.current?.stop(); return; }
    hush(); // so the microphone doesn't hear the last reply
    const heard = new Recognition();
    heard.lang = "en-AU"; heard.interimResults = true;
    let finalText = "";
    heard.onresult = event => {
      finalText = Array.from(event.results).map(result => result[0].transcript).join(" ");
      setDraft(finalText);
    };
    heard.onend = () => { setListening(false); if (finalText.trim()) void ask(finalText); };
    heard.onerror = () => setListening(false);
    recognition.current = heard; setListening(true); setError(""); heard.start();
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(draft); }

  const steps = latest?.cards.map(card => STEP_LABELS[card.tool]).filter(Boolean) ?? [];
  const state = listening ? "Listening" : busy ? "Working on it" : latest?.reply ? "MemoValet" : "Ready";

  return (
    <main className="min-h-screen bg-[#06060c] bg-[radial-gradient(900px_520px_at_15%_0%,rgba(99,102,241,0.22),transparent_60%),radial-gradient(800px_520px_at_95%_100%,rgba(217,70,239,0.16),transparent_60%)] px-4 py-6 text-white sm:px-8">
      <style>{`@keyframes orbPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.08);opacity:1}}@keyframes orbSpin{to{transform:rotate(360deg)}}`}</style>
      <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-white/55">
        <span>Simulated Alexa+ experience · MemoValet skill · fictional sample workspace</span>
        <Link href="/preview?scenario=launch" className="text-white/70 hover:text-white">Open MemoValet</Link>
      </div>

      <div className="mx-auto max-w-6xl rounded-[40px] border border-white/10 bg-[#0c0d18] p-3 shadow-2xl shadow-indigo-950/60">
        <div className="flex min-h-[640px] flex-col rounded-[30px] bg-gradient-to-b from-[#121428] to-[#0b0c17] p-6 sm:p-8">
          <header className="mb-6 flex items-center justify-between text-sm text-white/60">
            <span className="rounded-full border border-white/10 px-3 py-1 font-medium text-white/80">Alexa+</span>
            <span>Saturday 17 October · 9:00 am</span>
            <span className="font-medium text-white/80">MemoValet</span>
          </header>

          <div className="grid flex-1 gap-8 lg:grid-cols-[5fr_7fr]">
            <div className="flex flex-col">
              <div className="relative mb-6 h-20 w-20">
                <span className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#6366f1,#d946ef,#22d3ee)] ${busy ? "" : "opacity-80"}`}
                  style={{ animation: busy ? "orbSpin 1.4s linear infinite" : listening ? "orbPulse 1s ease-in-out infinite" : undefined }} />
                <span className="absolute inset-[6px] rounded-full bg-[#0f1122]" />
                <span className="absolute inset-[18px] rounded-full bg-gradient-to-br from-cyan-300 to-indigo-500 opacity-80" style={{ animation: listening || busy ? "orbPulse 1.2s ease-in-out infinite" : undefined }} />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/80">{state}</p>
              {latest ? (
                <>
                  <p className="mb-4 text-lg text-white/60">&ldquo;{latest.user}&rdquo;</p>
                  {latest.reply && <p className={`${latest.reply.length > 150 ? "text-[22px]" : "text-[28px]"} font-semibold leading-snug tracking-tight text-white`}>{latest.reply}</p>}
                  {steps.length > 0 && (
                    <ul className="mt-6 flex flex-wrap gap-2" aria-label="What the assistant did in MemoValet">
                      {steps.map(step => <li key={step} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/70">✓ {step}</li>)}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-[28px] font-semibold leading-snug tracking-tight text-white">Ask about your meetings. I can prepare a follow up, find a time and book it for you.</p>
              )}
              {error && <p className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{error}</p>}
            </div>

            <div className="space-y-4">
              {latest?.cards.map((card, index) => (
                <CardView key={`${card.tool}${index}`} card={card} booked={booked} busy={busy}
                  onPick={slot => void ask(`Book ${slot.label}`, slot.start)} />
              ))}
              {!latest && (
                <div className="grid gap-3">
                  {SUGGESTIONS.map(suggestion => (
                    <button key={suggestion} type="button" onClick={() => void ask(suggestion)}
                      className="rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-4 text-left text-lg text-white/85 transition hover:border-cyan-300/60 hover:bg-cyan-300/10">
                      &ldquo;{suggestion}&rdquo;
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="mt-8 flex items-center gap-3">
            <button type="button" onClick={listen} aria-label={listening ? "Stop listening" : "Speak to the assistant"}
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border transition ${listening ? "border-cyan-300 bg-cyan-300/20" : "border-white/15 bg-white/[0.06] hover:border-cyan-300/60"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>
            <label htmlFor="alexa-input" className="sr-only">Ask MemoValet</label>
            <input id="alexa-input" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy}
              placeholder="Ask MemoValet anything about your meetings"
              className="h-14 flex-1 rounded-full border border-white/15 bg-white/[0.05] px-6 text-lg text-white placeholder:text-white/40 focus:border-cyan-300/70 focus:outline-none" />
            <button type="submit" disabled={busy || !draft.trim()} className="brand-gradient-bg h-14 shrink-0 rounded-full px-7 font-semibold text-white disabled:opacity-40">Ask</button>
          </form>
        </div>
      </div>
    </main>
  );
}
