"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { DotsSixVertical, Translate, X } from "@phosphor-icons/react";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";
import type { LiveRoomCaption } from "@/components/LiveMeetingRoom";
import { speakerRuns } from "@/lib/caption-groups";

interface Props {
  captions: LiveRoomCaption[];
  language: string;
  onLanguageChange: (code: string) => void;
  /** Translation is running — it is switched on by the Translate button or tab, and stays on. */
  enabled: boolean;
  mode: "translation" | "original";
  onModeChange: (mode: "translation" | "original") => void;
  onClose: () => void;
  /** What captions are doing: listening, waiting for a microphone, stopped. */
  status?: string;
}

const PLACE_KEY = "memovalet.translation-panel";
/** Lines shown until someone asks for the rest of the meeting. */
const RECENT_LINES = 150;

export default function LiveTranslationPanel({ captions, language, onLanguageChange, enabled, mode, onModeChange, onClose, status }: Props) {
  // The whole meeting is there to scroll back through; only the recent part is
  // drawn until asked, so a long call doesn't redraw a thousand lines a second.
  const [showEarlier, setShowEarlier] = useState(false);
  const shown = showEarlier ? captions : captions.slice(-RECENT_LINES);
  const earlier = captions.length - shown.length;
  const starts = speakerRuns(shown);
  const reading = SPEECH_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label ?? "";
  // Translation is on, but everyone is speaking the language being read.
  const nothingToTranslate =
    mode === "translation" && captions.length > 0 && captions.every((caption) => caption.langLabel === reading);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Where you put it. Null means the bottom-right corner it starts in.
  const panelRef = useRef<HTMLElement>(null);
  const [place, setPlace] = useState<{ x: number; y: number } | null>(null);
  const grabOffset = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Keeps the whole panel on screen, whatever the window does afterwards. */
  const onScreen = useCallback((x: number, y: number) => {
    const box = panelRef.current?.getBoundingClientRect();
    const width = box?.width ?? 420;
    const height = box?.height ?? 320;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - height - 8)),
    };
  }, []);

  // Read after mount, never during render: the server has no window to measure
  // against, and storage can be unavailable or hold nonsense.
  const restorePlace = useEffectEvent(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLACE_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        setPlace(onScreen(saved.x, saved.y));
      }
    } catch { /* No remembered spot; the corner is a fine place to start. */ }
  });
  useEffect(() => {
    const timer = setTimeout(() => restorePlace(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const grab = grabOffset.current;
      if (!grab) return;
      event.preventDefault();
      setPlace(onScreen(event.clientX - grab.x, event.clientY - grab.y));
    };
    const drop = () => setDragging(false);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [dragging, onScreen]);

  // Remember the spot once the drag ends, and pull it back into view if the
  // window is resized to somewhere smaller than where you left it.
  useEffect(() => {
    if (dragging || !place) return;
    try { localStorage.setItem(PLACE_KEY, JSON.stringify(place)); } catch { /* fine without */ }
    const settle = () => setPlace((current) => (current ? onScreen(current.x, current.y) : current));
    window.addEventListener("resize", settle);
    return () => window.removeEventListener("resize", settle);
  }, [dragging, place, onScreen]);
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (follow.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [captions, mode]);

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="Live translation"
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      }}
      // Once you have moved it, top/left take over from the starting corner.
      style={place ? { left: place.x, top: place.y, right: "auto", bottom: "auto" } : undefined}
      className={`fixed z-40 flex max-h-[75dvh] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl sm:w-[420px] ${
        place ? "" : "bottom-3 right-3 sm:bottom-5 sm:right-5"
      } ${dragging ? "select-none" : ""}`}
    >
      <header
        onPointerDown={(event) => {
          // The close button lives here too; a click on it is not a drag.
          if ((event.target as HTMLElement).closest("button")) return;
          const box = panelRef.current?.getBoundingClientRect();
          if (!box) return;
          grabOffset.current = { x: event.clientX - box.left, y: event.clientY - box.top };
          setDragging(true);
        }}
        title="Drag to move this panel"
        className={`flex shrink-0 touch-none items-center gap-2 border-b border-slate-200 px-4 py-3 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <DotsSixVertical size={18} weight="bold" className="shrink-0 text-slate-400" aria-hidden="true" />
        <Translate size={20} className="shrink-0 text-indigo-600" />
        <h2 className="flex-1 text-sm font-semibold">Live translation</h2>
        {place && (
          <button
            type="button"
            onClick={() => {
              setPlace(null);
              try { localStorage.removeItem(PLACE_KEY); } catch { /* fine without */ }
            }}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            Reset
          </button>
        )}
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close live translation" title="Close live translation" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={19} /></button>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-600">
          <span>Translate to</span>
          <select aria-label="Translation language" value={language} onChange={event => onLanguageChange(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900">
            {SPEECH_LANGUAGE_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid shrink-0 grid-cols-2 border-b border-slate-100 px-3" aria-label="Caption view">
        {(["translation", "original"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)} className={`min-h-11 border-b-2 text-xs font-medium ${mode === value ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>{value === "translation" ? "Translation" : "Original"}</button>)}
      </div>
      <div ref={listRef} role="log" aria-label="Live captions" aria-live="off" onScroll={() => {
        const list = listRef.current;
        if (list) follow.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:max-h-80">
        {earlier > 0 && (
          <button type="button" onClick={() => setShowEarlier(true)} className="my-2 w-full rounded-lg py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
            Show {earlier} earlier line{earlier === 1 ? "" : "s"}
          </button>
        )}
        {captions.length === 0 ? <p className="px-6 py-14 text-center text-sm leading-relaxed text-slate-500">{status || "Waiting for speech…"}</p> : shown.map((caption, index) => <article key={caption.id} className={`border-slate-100 ${starts[index] ? "border-b py-3 first:pt-0 last:border-0" : "border-b pb-3 last:border-0"}`}>
          {/* One name over a run of lines from the same person, the way any
              messaging app does it — the words are what people came to read. */}
          {starts[index]
            ? <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span className="font-medium text-slate-800">{caption.speakerName}</span><span>{caption.langLabel}</span><time className="ml-auto tabular-nums">{caption.time}</time></div>
            : <div className="sr-only">{caption.speakerName}, {caption.time}</div>}
          {mode === "translation" && enabled && caption.translating && <p className="mb-1 text-xs italic text-slate-500">Translating…</p>}
          <p dir="auto" className="text-sm leading-relaxed text-slate-900 [overflow-wrap:anywhere]">{mode === "original" || !enabled ? caption.original : caption.translated}</p>
          {mode === "translation" && enabled && caption.original !== caption.translated && <p dir="auto" className="mt-1 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]">{caption.original}</p>}
        </article>)}
      </div>
      <footer className="shrink-0 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        {nothingToTranslate
          ? `Everything so far is already in ${reading}. Choose the language you want to read in above.`
          : [mode === "translation" && enabled ? `Translating into ${reading}` : "Original captions", captions.length ? status : ""].filter(Boolean).join(" · ")}
      </footer>
    </section>
  );
}
