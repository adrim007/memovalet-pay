"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gif, PaperPlaneRight, Smiley, X } from "@phosphor-icons/react";
import { safeGifUrl, type ChatDraft, type ChatMessage } from "@/lib/meeting-chat";
import { searchEmoji } from "@/lib/chat-emoji";
import { ALL_GIFS, isBuiltInGif, searchGifs } from "@/lib/chat-gifs";
import { MIN_QUERY, type TenorGif } from "@/lib/tenor";

function GifAttachment({ url }: { url: string }) {
  // One from the picker plays at once, the way it would in Teams. Anything
  // else still waits to be asked for, since loading it tells a third party
  // the viewer is there.
  const builtIn = isBuiltInGif(url);
  const [playing, setPlaying] = useState(builtIn);
  const [failed, setFailed] = useState(false);
  if (builtIn) {
    return failed ? <p className="mt-2 text-xs text-red-700">This GIF could not be loaded.</p> : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="GIF" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className="mt-2 max-h-40 max-w-full rounded-lg" />
    );
  }
  return <div className="mt-2">
    {playing && !failed && (
      // External media is loaded only after the recipient chooses to play it.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="Shared GIF" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className="mb-2 h-40 max-w-full rounded-lg object-contain" />
    )}
    {failed ? <p className="text-xs text-red-700">This GIF could not be loaded.</p> :
      <button type="button" onClick={() => setPlaying(value => !value)} className="inline-flex items-center gap-2 text-xs font-medium text-indigo-700 underline underline-offset-4"><Gif size={18} />{playing ? "Stop GIF" : "Play GIF"}</button>}
  </div>;
}

export default function LiveMeetingChat({ messages, selfId, onSend, active, sessionId, callPass }: {
  messages: ChatMessage[]; selfId: string; onSend: (draft: ChatDraft) => Promise<void>; active: boolean;
  /** The call this chat belongs to, and its pass — what GIF search is asked with. */
  sessionId?: string; callPass?: string | null;
}) {
  const [text, setText] = useState("");
  const [gif, setGif] = useState("");
  const [picker, setPicker] = useState<"emoji" | "gif" | null>(null);
  const [emojiQuery, setEmojiQuery] = useState("");
  const matchingEmoji = useMemo(() => searchEmoji(emojiQuery), [emojiQuery]);
  const [gifQuery, setGifQuery] = useState("");
  const matchingGifs = useMemo(() => searchGifs(gifQuery), [gifQuery]);
  // Typing searches Tenor's whole library as well as MemoValet's own set.
  // Ours come first: they are the ones that have been looked at.
  const [found, setFound] = useState<TenorGif[]>([]);
  const [searching, setSearching] = useState(false);
  const attachedGif = useMemo(() => ALL_GIFS.find((item) => item.url === gif), [gif]);
  useEffect(() => {
    const query = gifQuery.trim();
    const controller = new AbortController();
    if (picker !== "gif" || query.length < MIN_QUERY) {
      // Clearing on the next tick, so this stays out of the render itself.
      const clear = setTimeout(() => setFound([]), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/gifs/search?q=${encodeURIComponent(query)}${sessionId ? `&session=${encodeURIComponent(sessionId)}` : ""}`,
          { signal: controller.signal, headers: callPass ? { Authorization: `Bearer ${callPass}` } : {} }
        );
        const data = response.ok ? await response.json() : null;
        setFound(Array.isArray(data?.results) ? data.results : []);
      } catch {
        // Ours are still on screen; a failed search just adds nothing.
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [gifQuery, picker, sessionId, callPass]);

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => { if (active && follow.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages, active]);

  async function send() {
    if (busyRef.current || (!text.trim() && !gif.trim())) return;
    const gifUrl = gif.trim() ? safeGifUrl(gif.trim()) : undefined;
    if (gif.trim() && !gifUrl) { setError("Use a direct HTTPS .gif link from GIPHY or Tenor."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      await onSend({ text: text.trim(), gifUrl });
      setText(""); setGif(""); setPicker(null); follow.current = true;
    } catch { setError("Message not sent. Your draft is still here. Check the call connection and retry."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  // Fills whatever height it is given — the full side column next to the call,
  // or its own minimum when it is stacked under the video on a phone.
  return <section aria-label="Meeting chat" className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-semibold">Meeting chat</h2><span className="text-xs text-slate-500">Everyone · This call only</span>
    </div>
    <div ref={list} role="log" aria-label="Meeting messages" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = list.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="min-h-[4rem] flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">No messages yet</p>}
      {messages.map(message => <article key={`${message.senderId}:${message.id}`} className={`max-w-[90%] sm:max-w-[75%] ${message.senderId === selfId ? "ml-auto" : ""}`}>
        <div className="mb-1 flex flex-wrap gap-x-2 text-xs text-slate-500"><span className="font-semibold text-slate-700">{message.senderId === selfId ? "You" : message.senderName}</span><time>{new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
        <div className={`rounded-lg px-3 py-2 ${message.senderId === selfId ? "bg-indigo-50" : "bg-slate-50"}`}>
          {message.text && <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.text}</p>}
          {message.gifUrl && <GifAttachment url={message.gifUrl} />}
        </div>
      </article>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); void send(); }} className="relative shrink-0 border-t border-slate-200 p-3">
      {/* Floats above the message box rather than sitting in the column: inline,
          it made the whole chat taller than the window and the GIFs at the
          bottom were cut off by the edge of the screen. */}
      {picker && <div className="absolute inset-x-3 bottom-full z-20 mb-2 max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">{picker === "emoji" ? "Emoji" : "Add a GIF"}</span>
          <button type="button" aria-label="Close picker" onClick={() => setPicker(null)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70"><X size={15} /></button>
        </div>
        {picker === "emoji" ? <>
          <input
            type="search"
            aria-label="Search emoji"
            placeholder="Search for words such as “thanks” or “deadline”"
            value={emojiQuery}
            onChange={event => setEmojiQuery(event.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
          />
          <div className="max-h-[min(13rem,28vh)] overflow-y-auto overscroll-contain pr-1">
            {matchingEmoji.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Nothing matches that.</p>}
            {matchingEmoji.map(group => <div key={group.name} className="mb-2 last:mb-0">
              <p className="mb-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.name}</p>
              <div className="flex flex-wrap gap-0.5">
                {group.emoji.map(item => <button
                  type="button"
                  key={item.char}
                  title={item.name}
                  aria-label={item.name}
                  disabled={busy}
                  onClick={() => { setText(value => value.length + item.char.length <= 2000 ? value + item.char : value); input.current?.focus(); }}
                  className="size-9 rounded-lg text-xl leading-none transition hover:scale-110 hover:bg-white hover:shadow-sm"
                >{item.char}</button>)}
              </div>
            </div>)}
          </div>
        </> : <>
          <input
            type="search"
            aria-label="Search GIFs"
            placeholder="Search for words such as “thanks” or “clap”"
            value={gifQuery}
            onChange={event => setGifQuery(event.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
          />
          <div className="max-h-[min(15rem,34vh)] overflow-y-auto overscroll-contain pr-1">
            {matchingGifs.length === 0 && found.length === 0 && !searching &&
              <p className="py-6 text-center text-xs text-slate-500">Nothing matches that.</p>}
            {matchingGifs.map(group => <div key={group.name} className="mb-2 last:mb-0">
              <p className="mb-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.name}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {group.gifs.map(item => <button
                  type="button"
                  key={item.key}
                  title={item.label}
                  aria-label={`Attach GIF: ${item.label}`}
                  aria-pressed={gif === item.url}
                  disabled={busy}
                  onClick={() => { setGif(item.url); setPicker(null); setGifQuery(""); input.current?.focus(); }}
                  className={`relative aspect-square overflow-hidden rounded-lg bg-slate-200 transition hover:ring-2 hover:ring-indigo-400 ${gif === item.url ? "ring-2 ring-indigo-600" : ""}`}
                >
                  {/* The light animated preview; the full .gif is what gets sent. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                </button>)}
              </div>
            </div>)}
            {(found.length > 0 || searching) && <div className="mb-2 last:mb-0">
              <p className="mb-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                More from Tenor{searching && !found.length ? "…" : ""}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {found.map(item => <button
                  type="button"
                  key={item.key}
                  title={item.label}
                  aria-label={`Attach GIF: ${item.label}`}
                  aria-pressed={gif === item.url}
                  disabled={busy}
                  onClick={() => { setGif(item.url); setPicker(null); setGifQuery(""); input.current?.focus(); }}
                  className={`relative aspect-square overflow-hidden rounded-lg bg-slate-200 transition hover:ring-2 hover:ring-indigo-400 ${gif === item.url ? "ring-2 ring-indigo-600" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                </button>)}
              </div>
            </div>}
          </div>
          <p className="mt-2 text-right text-[10px] text-slate-400">GIFs via Tenor · family-friendly results only</p>
        </>}
      </div>}
      {gif && <div className="mb-2 flex items-start gap-2">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachedGif?.preview ?? gif} alt={attachedGif ? `Attached GIF: ${attachedGif.label}` : "Attached GIF"} referrerPolicy="no-referrer" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
          <button type="button" aria-label="Remove GIF" disabled={busy} onClick={() => setGif("")} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-slate-900 text-white shadow ring-2 ring-white hover:bg-slate-700"><X size={12} weight="bold" /></button>
        </div>
        <p className="pt-1 text-xs text-slate-500">Send this with a message or on its own.</p>
      </div>}
      <textarea ref={input} aria-label="Message everyone" placeholder="Message everyone" dir="auto" rows={2} maxLength={2000} value={text} disabled={busy} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className="block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          aria-label="Choose emoji"
          title="Emoji"
          aria-expanded={picker === "emoji"}
          onClick={() => setPicker(value => value === "emoji" ? null : "emoji")}
          className={`grid size-10 place-items-center rounded-full border transition ${picker === "emoji"
            ? "border-indigo-200 bg-indigo-50 text-indigo-600"
            : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"}`}
        ><Smiley size={21} weight={picker === "emoji" ? "fill" : "regular"} /></button>
        <button
          type="button"
          aria-label="Attach GIF"
          title="Attach a GIF"
          aria-expanded={picker === "gif"}
          className={`inline-flex h-10 items-center gap-1 rounded-full border px-3 text-[11px] font-bold tracking-wide transition ${picker === "gif" || gif
            ? "border-indigo-200 bg-indigo-50 text-indigo-600"
            : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"}`}
          onClick={() => setPicker(value => value === "gif" ? null : "gif")}
        >GIF</button>
        <span className="ml-auto text-xs text-slate-400">{text.length}/2000</span>
        <button type="submit" aria-label="Send message" title="Send message" disabled={busy || (!text.trim() && !gif.trim())} className="ml-2 grid size-11 place-items-center rounded-lg bg-indigo-600 text-white disabled:opacity-40"><PaperPlaneRight size={20} /></button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </form>
  </section>;
}
