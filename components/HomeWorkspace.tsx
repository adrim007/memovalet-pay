"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowUpLeft,
  ArrowUpRight,
  BookmarkSimple,
  CalendarBlank,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  Copy,
  FileAudio,
  FileDoc,
  FileImage,
  FilePdf,
  FilePpt,
  FileText,
  FileVideo,
  FileXls,
  FileZip,
  GlobeHemisphereWest,
  LinkSimple,
  MagnifyingGlass,
  MapPin,
  Microphone,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  ShareNetwork,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
  VideoCamera,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { getSpeechRecognitionConstructor, readSpeechResult, type SpeechRecognitionInstance } from "@/lib/speechRecognition";
import { hushReply, setSpokenReplies, speakReply, spokenRepliesOn, subscribeSpokenReplies } from "@/lib/spokenReply";
import TodayTimeline from "@/components/TodayTimeline";
import HomeCustomiser from "@/components/HomeCustomiser";
import { cardWidths, homeLayout, type HomeCardId, type HomeLayout } from "@/lib/home-layout";
import { createClient } from "@/lib/supabase/client";
import WeatherChip from "@/components/WeatherChip";
import {
  highlightParts,
  searchOptions,
  websiteFromQuery,
  type SavedLink,
  type SearchMatch,
  type SearchOption,
} from "@/lib/searchMenu";
import {
  clearRecentSearches,
  forgetSearch,
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  rememberSearch,
  subscribeRecentSearches,
} from "@/lib/recentSearches";
import { parseSchedule } from "@/lib/schedule-text";
import { createHint, createIntent, createRequest } from "@/lib/createIntent";
import { handleMapsClick, mapsUrl } from "@/lib/maps";
import type { AccountType, AttentionType } from "@/lib/types";
import type { Project, TaskAssignment, UpcomingCalendarEvent, UserDocument } from "@/lib/types";
import OnboardingTour, { type OnboardingTourProps } from "./OnboardingTour";

type SearchScope = "MemoValet" | "Web" | "Create";

export interface HomeWorkspaceProps {
  firstName: string;
  accountType?: AccountType;
  totalMeetings: number;
  meetingsThisWeek: number;
  totalActionItems: number;
  totalTasksSent: number;
  previewMode?: boolean;
  askPath?: string;
  onSampleSchedule?: (title: string, start: string) => void;
  priorities?: Array<{ title: string; description?: string | null; href?: string; reminderId?: string; type?: AttentionType }>;
  recentDocuments?: UserDocument[];
  activeProject?: Project | null;
  activeTask?: TaskAssignment | null;
  scheduleEvents?: UpcomingCalendarEvent[];
  calendarHref?: string;
  /** What this person chose to show, and in what order (user_metadata.home_layout). */
  savedLayout?: unknown;
  onboarding?: Pick<OnboardingTourProps, "userId" | "showInitially" | "replayRequested" | "preview">;
}

// Written out whole so Tailwind keeps every width a card can have.
const CARD_SPAN: Record<number, string> = {
  1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4",
  5: "lg:col-span-5", 6: "lg:col-span-6", 7: "lg:col-span-7", 8: "lg:col-span-8",
  9: "lg:col-span-9", 10: "lg:col-span-10", 11: "lg:col-span-11", 12: "lg:col-span-12",
};


function subscribeNoop() {
  return () => {};
}

// Sentence case, the way people write it. Before five in the morning it is
// "Hello": "Good night" is what you say when you leave.
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Hello";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getGreetingServer() {
  return "Welcome";
}

// Sits inside the "At a glance" card, so it carries no card styling of its own.
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-3 py-1">
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">{label}</p>
    </div>
  );
}

function ModeButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: SearchScope;
  icon: typeof Sparkle;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-[var(--muted)] hover:bg-indigo-500/5 hover:text-[var(--foreground)]"
      }`}
    >
      <Icon size={17} weight={active ? "fill" : "regular"} />
      {label}
    </button>
  );
}

// Example matches for /preview, where there's no account to search.
const PREVIEW_MATCHES: SearchMatch[] = [
  { id: "preview-m1", kind: "Meeting", title: "Client sync: Orion", href: "#" },
  { id: "preview-d1", kind: "Document", title: "Orion project proposal.pdf", href: "#" },
  { id: "preview-n1", kind: "Note", title: "Interview notes: Priya", href: "#" },
  { id: "preview-m2", kind: "Meeting", title: "Kitchen renovation walkthrough", href: "#" },
  { id: "preview-d2", kind: "Document", title: "Budget tracker.xlsx", href: "#" },
];

const MATCH_ICON: Record<string, typeof Sparkle> = { Meeting: VideoCamera, Document: FileText, Note: NotePencil };

// Live matches from your own meetings, files and notes while typing in MemoValet mode.
function useSearchMatches(query: string, enabled: boolean, previewMode: boolean) {
  const [state, setState] = useState<{ query: string; matches: SearchMatch[]; error: string }>({
    query: "",
    matches: [],
    error: "",
  });
  const q = query.trim();
  const active = enabled && q.length >= 2;

  useEffect(() => {
    if (!active || previewMode) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Search is unavailable right now.");
        if (!controller.signal.aborted) setState({ query: q, matches: data.results || [], error: "" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ query: q, matches: [], error: error instanceof Error ? error.message : "Search is unavailable right now." });
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, previewMode, q]);

  if (!active) return { matches: [] as SearchMatch[], loading: false, error: "" };
  if (previewMode) {
    const lower = q.toLowerCase();
    return { matches: PREVIEW_MATCHES.filter((match) => match.title.toLowerCase().includes(lower)), loading: false, error: "" };
  }
  const fresh = state.query === q;
  return { matches: fresh ? state.matches : [], loading: !fresh, error: fresh ? state.error : "" };
}

// Example saved links and suggestions for /preview.
const PREVIEW_LINKS: SavedLink[] = [
  { id: "preview-l1", title: "Bathroom tile samples", url: "https://tiles.example.com/samples" },
  { id: "preview-l2", title: "Orion brand guidelines", url: "https://orion.example.com/brand" },
];
const PREVIEW_SUGGESTION_ENDINGS = [" near me", " melbourne", " reviews", " opening hours", " prices"];

function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Suggestions already fetched this visit, so retyping the same words costs nothing.
const suggestionCache = new Map<string, string[]>();
// Set once the server says suggestions aren't set up, so typing stops asking.
let webSuggestionsOff = false;

// Web mode: search suggestions as you type, like Google's.
function useWebSuggestions(query: string, enabled: boolean, previewMode: boolean): string[] {
  const [latest, setLatest] = useState<{ key: string; suggestions: string[] }>({ key: "", suggestions: [] });
  const q = query.trim();
  const key = q.toLowerCase();
  const active = enabled && !previewMode && q.length >= 2 && q.length <= 100;

  useEffect(() => {
    if (!active || webSuggestionsOff || suggestionCache.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await response.json();
        if (data.enabled === false) webSuggestionsOff = true;
        if (!response.ok) return;
        const suggestions: string[] = Array.isArray(data.suggestions)
          ? data.suggestions.filter((item: unknown): item is string => typeof item === "string")
          : [];
        suggestionCache.set(key, suggestions);
        setLatest({ key, suggestions });
      } catch {
        // Suggestions are extra; the Google row still works without them.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, key, q]);

  if (enabled && previewMode && q.length >= 2) return PREVIEW_SUGGESTION_ENDINGS.map((ending) => key + ending);
  if (!active) return [];
  // While the next ones load, keep the last ones if you're still typing the same words.
  return suggestionCache.get(key) ?? (latest.key && key.startsWith(latest.key) ? latest.suggestions : []);
}

// Web mode: links kept with the Save button, loaded the first time the dropdown needs them.
function useSavedLinks(enabled: boolean, previewMode: boolean) {
  const [wanted, setWanted] = useState(0);
  const [loaded, setLoaded] = useState<{ version: number; links: SavedLink[] }>({ version: -1, links: [] });

  useEffect(() => {
    if (!enabled || previewMode || loaded.version === wanted) return;
    const controller = new AbortController();
    fetch("/api/bookmarks", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.bookmarks)) return;
        setLoaded({
          version: wanted,
          links: data.bookmarks.map((item: SavedLink) => ({ id: item.id, title: item.title, url: item.url })),
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [enabled, previewMode, loaded.version, wanted]);

  return { links: previewMode ? PREVIEW_LINKS : loaded.links, reload: () => setWanted((current) => current + 1) };
}

// Cycles through the options and back to the box itself (-1), like a browser's address bar.
function stepIndex(current: number, step: number, count: number) {
  const slots = count + 1;
  return (((current + 1 + step) % slots) + slots) % slots - 1;
}

function UniversalBar({ onResults, previewMode = false, onSampleSchedule }: { onResults: (query: string, spoken?: boolean) => void; previewMode?: boolean; onSampleSchedule?: (title: string, start: string) => void }) {
  const router = useRouter();
  const [scope, setScope] = useState<SearchScope>("MemoValet");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [created, setCreated] = useState<{ status: "idle" | "saving" | "saved" | "failed"; message: string; href?: string }>({
    status: "idle",
    message: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);
  // Voice: speak instead of typing. When the request was spoken, the reply is spoken too.
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceOn = useSyncExternalStore(subscribeSpokenReplies, spokenRepliesOn, () => true);
  const voiceEndpoint = previewMode ? "/api/hackathon/speak" : "/api/speak";
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const recents = useSyncExternalStore(subscribeRecentSearches, getRecentSearchesSnapshot, getRecentSearchesServerSnapshot);
  const { matches, loading, error } = useSearchMatches(query, scope === "MemoValet", previewMode);
  const suggestions = useWebSuggestions(query, scope === "Web", previewMode);
  const { links, reload: reloadLinks } = useSavedLinks(scope === "Web" && open, previewMode);

  const trimmed = query.trim();
  const options = searchOptions({ query, scope, recents, matches, suggestions, links });
  const showStatus = scope === "MemoValet" && trimmed.length >= 2 && (loading || !!error || matches.length === 0);
  const menuVisible = open && scope !== "Create" && (options.length > 0 || showStatus);
  const currentCreateIntent = scope === "Create" ? createIntent(query) : null;
  let scheduleHint = "";
  if (currentCreateIntent && currentCreateIntent.kind !== "note" && currentCreateIntent.kind !== "open") {
    try {
      const schedule = parseSchedule(query, Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (schedule) scheduleHint = `${currentCreateIntent.kind === "meeting" ? "Meeting" : currentCreateIntent.kind === "project" ? "Project deadline" : "Task"}: ${schedule.label}`;
    } catch (error) { scheduleHint = error instanceof Error ? error.message : "Please check the date and time."; }
  }

  // ⌘K / Ctrl+K from anywhere on the page opens search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Web" mode: keep a search you'll want again (saved under Notes → Saved links).
  const saveSearch = async () => {
    const clean = query.trim();
    if (!clean || saveState === "saving") return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: clean,
          url: `https://www.google.com/search?q=${encodeURIComponent(clean)}`,
        }),
      });
      setSaveState(response.ok ? "saved" : "failed");
      if (response.ok) reloadLinks();
    } catch {
      setSaveState("failed");
    }
    setTimeout(() => setSaveState("idle"), 2500);
  };

  const placeholder =
    scope === "Web"
      ? "Search the web or type a website…"
      : scope === "Create"
        ? "Create a task, note, project, or meeting…"
        : "Ask, search, or get something done…";

  // "Create" mode: saves what you typed straight away. lib/createIntent.ts decides what it becomes.
  // spoken: the request came from the microphone, so the result is said out loud as well.
  const createFromBar = async (text: string, spoken = false) => {
    const report = (next: typeof created) => {
      setCreated(next);
      // Bracketed details such as the time zone stay on screen; they sound clumsy read aloud.
      if (spoken) void speakReply(next.message.replace(/\s*\([^)]*\)/g, ""), voiceEndpoint);
    };
    const intent = createIntent(text);
    if (!intent) {
      inputRef.current?.focus();
      return;
    }
    if (intent.kind === "open") {
      router.push(intent.href);
      return;
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let schedule;
    try { schedule = intent.kind === "note" ? null : parseSchedule(text, timeZone); }
    catch (error) { report({ status: "failed", message: error instanceof Error ? error.message : "Please check the date and time." }); return; }
    if (intent.kind === "meeting" && !schedule) { router.push("/meeting"); return; }
    if (intent.kind === "meeting" && !schedule?.at) { report({ status: "failed", message: "Please include a meeting time, such as tomorrow at 1pm." }); return; }
    const request = intent.kind === "meeting"
      ? { url: "/api/live", body: { title: text, naturalText: text, timeZone } }
      : createRequest(intent);
    if (!request || created.status === "saving") return;
    const done = intent.kind === "task" ? "Task added" : intent.kind === "note" ? "Note saved" : intent.kind === "meeting" ? "Meeting scheduled" : "Project created";
    if (previewMode) {
      if (intent.kind === "meeting" && schedule?.at && onSampleSchedule) {
        try {
          onSampleSchedule(text, schedule.at);
          setQuery("");
          report({ status: "saved", message: `Meeting scheduled in this sample workspace. ${schedule.label}` });
        } catch {
          report({ status: "failed", message: "The browser could not save the sample meeting. Please try again." });
        }
        return;
      }
      setQuery("");
      report({ status: "saved", message: `${done}${schedule ? `. ${schedule.label}` : ""} (preview: nothing is saved)` });
      return;
    }
    setCreated({ status: "saving", message: "Saving…" });
    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request.body, timeZone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't save that. Try again.");
      const href =
        intent.kind === "task" ? "/tasks" : schedule ? `/calendar?date=${data.schedule?.date || schedule.date}` : intent.kind === "note" ? "/notes" : data.project?.id ? `/projects/${data.project.id}` : "/projects";
      setQuery("");
      report({ status: "saved", message: `${done}${data.schedule?.label ? `. ${data.schedule.label}` : schedule ? `. ${schedule.label}` : ""}`, href });
      router.refresh();
    } catch (error) {
      report({ status: "failed", message: error instanceof Error ? error.message : "Couldn't save that. Try again." });
    }
  };

  // googleOnly: the "Search Google" row, even when the words look like a web address.
  const runSearch = (text: string, searchScope: SearchScope, googleOnly = false, spoken = false) => {
    const clean = text.trim();
    if (!clean) {
      inputRef.current?.focus();
      return;
    }
    setOpen(false);
    setActiveIndex(-1);
    if (searchScope === "Web") {
      rememberSearch(clean, "Web");
      // Like a browser's address bar: a web address opens the site itself.
      const site = googleOnly ? null : websiteFromQuery(clean);
      window.open(site ?? `https://www.google.com/search?q=${encodeURIComponent(clean)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (searchScope === "Create") {
      void createFromBar(clean, spoken);
      return;
    }
    rememberSearch(clean, "MemoValet");
    onResults(clean, spoken);
  };

  // Tap to speak. Words appear as they are heard, and the request goes when you stop talking. Web
  // searches open a new tab, which browsers only allow from a click, so those wait for Go.
  const listen = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setVoiceNote("Speaking needs Chrome, Edge or Safari. You can type instead.");
      return;
    }
    hushReply();
    const heard = new Recognition();
    heard.lang = navigator.language || "en-AU";
    heard.continuous = false;
    heard.interimResults = true;
    let said = "";
    heard.onresult = (event) => {
      const { finalText, interimText } = readSpeechResult(event);
      if (finalText) said = `${said} ${finalText}`.trim();
      setQuery(`${said} ${interimText}`.trim());
    };
    heard.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setVoiceNote("Allow the microphone for this site to speak your request.");
      else if (event.error !== "no-speech" && event.error !== "aborted") setVoiceNote("Sorry, I didn't catch that. Try again, or type instead.");
    };
    heard.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (!said) return;
      setQuery(said);
      if (scope === "Web") {
        setOpen(true);
        inputRef.current?.focus();
        return;
      }
      runSearch(said, scope, false, true);
    };
    recognitionRef.current = heard;
    setVoiceNote("");
    setOpen(false);
    setListening(true);
    heard.start();
  };

  const choose = (option: SearchOption) => {
    if (option.type === "site") {
      runSearch(trimmed, "Web");
    } else if (option.type === "action") {
      runSearch(option.query, option.scope, true);
    } else if (option.type === "recent") {
      setScope(option.recent.scope);
      setQuery(option.recent.query);
      runSearch(option.recent.query, option.recent.scope);
    } else if (option.type === "suggestion") {
      setQuery(option.query);
      runSearch(option.query, "Web");
    } else if (option.type === "link") {
      setOpen(false);
      if (/^https?:\/\//i.test(option.link.url)) window.open(option.link.url, "_blank", "noopener,noreferrer");
    } else {
      rememberSearch(trimmed, "MemoValet");
      setOpen(false);
      router.push(option.match.href);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const option = menuVisible && activeIndex >= 0 ? options[activeIndex] : undefined;
    if (option) choose(option);
    else runSearch(query, scope);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!menuVisible) {
        setOpen(true);
        return;
      }
      if (options.length) setActiveIndex((current) => stepIndex(current, event.key === "ArrowDown" ? 1 : -1, options.length));
    } else if (event.key === "Escape" && menuVisible) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const changeScope = (next: SearchScope) => {
    setScope(next);
    setActiveIndex(-1);
    if (created.status !== "saving") setCreated({ status: "idle", message: "" });
  };

  const highlight = (text: string) =>
    highlightParts(text, trimmed).map((part, index) =>
      part.match ? (
        <mark key={index} className="rounded bg-indigo-500/15 px-0.5 font-semibold text-inherit">
          {part.text}
        </mark>
      ) : (
        <span key={index}>{part.text}</span>
      )
    );

  return (
    <div className="relative rounded-[24px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 p-[1.5px] shadow-sm transition-shadow focus-within:shadow-[0_0_0_5px_rgba(139,92,246,0.18)]">
      <section data-tour="search-control" className="rounded-[22px] bg-[var(--surface)] p-5 sm:p-6" aria-label="Search and create">
        <form onSubmit={submit}>
          <div className="flex items-center gap-3">
            <MagnifyingGlass size={24} className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={menuVisible}
              aria-controls={menuVisible ? "universal-search-options" : undefined}
              aria-autocomplete="list"
              aria-activedescendant={menuVisible && activeIndex >= 0 ? `universal-search-option-${activeIndex}` : undefined}
              value={query}
              onChange={(event) => {
                hushReply();
                setQuery(event.target.value);
                setActiveIndex(-1);
                setOpen(true);
                if (created.status === "saved" || created.status === "failed") setCreated({ status: "idle", message: "" });
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
              placeholder={listening ? "Listening…" : placeholder}
              aria-label={placeholder}
              className="memo-bar-input min-w-0 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              onClick={() => setSpokenReplies(!voiceOn)}
              aria-pressed={voiceOn}
              aria-label={voiceOn ? "Spoken replies on" : "Spoken replies off"}
              title={voiceOn ? "Spoken replies are on. Click to turn them off." : "Spoken replies are off. Click to turn them on."}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              {voiceOn ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}
            </button>
            <button
              type="button"
              onClick={listen}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Speak instead of typing"}
              title={listening ? "Stop listening" : "Speak instead of typing"}
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                listening ? "animate-pulse bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow" : "border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <Microphone size={22} weight={listening ? "fill" : "regular"} />
            </button>
            <span className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-400 sm:inline">⌘ K</span>
          </div>
          {/* Switching mode keeps the box focused, so the dropdown follows along. */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5" onMouseDown={(event) => event.preventDefault()}>
            <ModeButton active={scope === "MemoValet"} label="MemoValet" icon={Sparkle} onClick={() => changeScope("MemoValet")} />
            <ModeButton active={scope === "Web"} label="Web" icon={GlobeHemisphereWest} onClick={() => changeScope("Web")} />
            <ModeButton active={scope === "Create"} label="Create" icon={Plus} onClick={() => changeScope("Create")} />
            {scope === "Web" && query.trim() && (
              <button
                type="button"
                onClick={saveSearch}
                disabled={saveState === "saving"}
                className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                <BookmarkSimple size={16} weight={saveState === "saved" ? "fill" : "regular"} />
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "failed" ? "Couldn't save" : "Save"}
              </button>
            )}
            <button type="submit" disabled={created.status === "saving"} className={`${scope === "Web" && query.trim() ? "" : "ml-auto "}inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60`}>
              {scope === "Create" ? (created.status === "saving" ? "Saving…" : "Create") : "Go"}
              <ArrowRight size={15} weight="bold" />
            </button>
          </div>
          {voiceNote && (
            <p role="status" className="mt-3 text-sm text-slate-500">{voiceNote}</p>
          )}
          {/* Create mode says what will happen before you press it, then what happened. */}
          {scope === "Create" && (
            <p
              role="status"
              className={`mt-3 flex flex-wrap items-center gap-1.5 text-sm ${
                created.status === "failed" ? "text-red-600" : created.status === "saved" ? "text-emerald-700" : "text-slate-500"
              }`}
            >
              {created.status === "saved" && <CheckCircle size={16} weight="fill" />}
              {created.status === "idle" ? scheduleHint || createHint(currentCreateIntent) : created.message}
              {created.status === "saved" && created.href && (
                <Link href={created.href} className="font-semibold underline underline-offset-2">
                  Open
                </Link>
              )}
            </p>
          )}
        </form>
      </section>

      {menuVisible && (
        // Mouse-down inside the menu must not blur the box, or the menu closes before the click lands.
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-[var(--surface)] p-1.5 shadow-2xl shadow-indigo-500/15 ring-1 ring-[var(--surface-border)]"
        >
          {!trimmed && (
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Recent searches</span>
              <button
                type="button"
                onClick={() => clearRecentSearches(scope)}
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Clear
              </button>
            </div>
          )}
          <ul id="universal-search-options" role="listbox" aria-label={trimmed ? "Search suggestions" : "Recent searches"}>
            {options.map((option, index) => {
              const active = index === activeIndex;
              const row = `flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-indigo-500/10" : "hover:bg-indigo-500/5"}`;
              const common = {
                id: `universal-search-option-${index}`,
                role: "option" as const,
                "aria-selected": active,
                onClick: () => choose(option),
                onMouseEnter: () => setActiveIndex(index),
              };

              if (option.type === "site" || option.type === "action") {
                const LeadIcon = option.type === "site" ? GlobeHemisphereWest : option.scope === "Web" ? MagnifyingGlass : Sparkle;
                return (
                  <li key={option.key} {...common} className={row}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                      <LeadIcon size={16} weight={option.type === "action" && option.scope === "MemoValet" ? "fill" : "regular"} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{option.label}</span>
                    {index === 0 && (
                      <kbd className="hidden rounded-md border border-[var(--surface-border)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--muted)] sm:inline">
                        Enter
                      </kbd>
                    )}
                  </li>
                );
              }

              if (option.type === "recent") {
                return (
                  <li key={option.key} {...common} className={`group ${row}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]">
                      <ClockCounterClockwise size={17} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{highlight(option.recent.query)}</span>
                    <button
                      type="button"
                      aria-label={`Remove “${option.recent.query}” from recent searches`}
                      onClick={(event) => {
                        event.stopPropagation();
                        forgetSearch(option.recent.query, option.recent.scope);
                      }}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 ${
                        active ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      }`}
                    >
                      <X size={13} />
                    </button>
                  </li>
                );
              }

              if (option.type === "suggestion") {
                return (
                  <li key={option.key} {...common} className={row}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]">
                      <MagnifyingGlass size={16} />
                    </span>
                    {/* Like Google: the words you typed stay plain, the rest is bold. */}
                    <span className="min-w-0 flex-1 truncate">
                      {highlightParts(option.query, trimmed).map((part, partIndex) => (
                        <span key={partIndex} className={part.match ? "" : "font-semibold"}>
                          {part.text}
                        </span>
                      ))}
                    </span>
                    <button
                      type="button"
                      title="Fill in"
                      aria-label={`Put “${option.query}” in the search box`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setQuery(option.query);
                        setActiveIndex(-1);
                      }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-indigo-500/10 hover:text-[var(--foreground)]"
                    >
                      <ArrowUpLeft size={14} />
                    </button>
                  </li>
                );
              }

              if (option.type === "link") {
                return (
                  <li key={option.key} {...common} className={row}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--background)] text-[var(--muted)]">
                      <LinkSimple size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{highlight(option.link.title)}</span>
                    <span className="max-w-[40%] shrink-0 truncate text-xs text-[var(--muted)]">{linkHost(option.link.url) || "Saved link"}</span>
                    <ArrowSquareOut size={14} className="shrink-0 text-[var(--muted)]" />
                  </li>
                );
              }

              const Icon = MATCH_ICON[option.match.kind] ?? FileText;
              return (
                <li key={option.key} {...common} className={row}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--background)] text-[var(--muted)]">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{highlight(option.match.title)}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{option.match.kind === "Document" ? "File" : option.match.kind}</span>
                  <ArrowUpRight size={14} className="shrink-0 text-[var(--muted)]" />
                </li>
              );
            })}
          </ul>
          {showStatus && (
            <p role="status" className="px-3 pb-2 pt-1.5 text-xs text-[var(--muted)]">
              {loading ? "Searching your meetings, files and notes…" : error || "No saved items match. Press Enter to ask MemoValet."}
            </p>
          )}
          {options.length > 0 && (
            <div className="mt-1 hidden items-center gap-3 border-t border-[var(--surface-border)] px-3 pb-1 pt-2 text-[11px] text-[var(--muted)] sm:flex">
              <span>↑↓ to move</span>
              <span>Enter to choose</span>
              <span>Esc to close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shares the active piece of work for real: a task link works for anyone
// (the recipient page is public), a project link opens only for teammates.
// Sends through /api/share and reports honestly whether the email went out.
function ShareDialog({
  onClose,
  project,
  task,
}: {
  onClose: () => void;
  project?: Project | null;
  task?: TaskAssignment | null;
}) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const title = project?.name || task?.title || "";
  const path = project ? `/projects/${project.id}` : task ? `/assigned/${task.id}` : "";

  const copy = async () => {
    if (!path) return;
    setCopied(false);
    setResult(null);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
    } catch {
      setResult({ ok: false, message: "Could not copy the link. Please try again or share by email." });
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !path || sending) return;
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), path, title }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult({ ok: false, message: data.error || "Couldn't share that." });
      } else if (data.emailed) {
        setResult({ ok: true, message: `Sent to ${email.trim()}.` });
        setEmail("");
      } else {
        setResult({ ok: false, message: "The email didn't go out. Copy the link below and send it yourself." });
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong. Try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="mf-card w-full max-w-md rounded-3xl bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Share</p>
            <h2 id="share-title" className="mt-1 text-xl font-bold">{title ? `Share ${title}` : "Nothing to share yet"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share window" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        {!path ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Create a project or send a task first, then share it from here.</p>
        ) : (
          <>
            <form onSubmit={send}>
              <label className="mt-5 block text-sm font-semibold" htmlFor="share-email">Email address</label>
              <div className="mt-2 flex gap-2">
                <input id="share-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500" />
                <button type="submit" disabled={sending || !email.trim()} className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60">
                  <PaperPlaneTilt size={17} /> {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {project ? "Project links open for people on your team." : "Anyone with the task link can respond without an account."}
            </p>
            {result && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`} role="status">
                {result.message}
              </p>
            )}
            <button type="button" onClick={copy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] py-2.5 text-sm font-semibold hover:bg-indigo-500/5">
              {copied ? <Check size={17} weight="bold" /> : <Copy size={17} />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}



function formatShortDate(value: string | null | undefined) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-AU", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function SuggestedCommands({ onSelect, accountType = "personal" }: { onSelect: (query: string) => void; accountType?: AccountType }) {
  const suggestions =
    accountType === "business"
      ? [
          { label: "Summarize my meetings from yesterday", icon: Sparkle },
          { label: "Which jobs are still waiting on someone?", icon: CheckCircle },
          { label: "What’s on my agenda tomorrow?", icon: CalendarBlank },
        ]
      : [
          { label: "What did I promise to do this week?", icon: Sparkle },
          { label: "Remind me about my appointments", icon: CheckCircle },
          { label: "What’s on my agenda tomorrow?", icon: CalendarBlank },
        ];

  return (
    <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer rounded-lg px-2 py-2 font-medium text-[var(--muted)] hover:text-[var(--foreground)]">Try asking MemoValet</summary>
      <div className="mt-2 flex flex-wrap gap-2">
      {suggestions.map(({ label, icon: Icon }) => (
        <button key={label} type="button" onClick={() => onSelect(label)} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-left text-sm transition hover:border-indigo-300">
          <Icon size={22} weight="duotone" className="shrink-0 text-indigo-600" />
          <span>{label}</span>
        </button>
      ))}
      </div>
    </details>
  );
}

// The hero card: whatever is actually in front of you right now, plus the
// rest of today underneath it.
function UpNextCard({ project, task, onShare, scheduleEvents, calendarHref }: { project?: Project | null; task?: TaskAssignment | null; onShare: () => void; scheduleEvents?: UpcomingCalendarEvent[]; calendarHref?: string }) {
  // Show one source at a time; a task may belong to a different project.
  const displayedTask = project ? null : task;
  task = displayedTask;
  const title = project?.name || task?.title;
  const href = project ? `/projects/${project.id}` : "/tasks";

  return (
    <section
      className="mf-card flex h-full flex-col rounded-3xl bg-gradient-to-b from-indigo-50/70 to-transparent p-6"
      aria-labelledby="active-work-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-100">
          <Wrench size={14} weight="duotone" />
          Up next
        </span>
        <Link href="/tasks" className="text-xs font-semibold text-[var(--muted)] hover:text-current">Open work</Link>
      </div>

      <h2 id="active-work-heading" className="sr-only">Active work</h2>

      {!title ? (
        <div className="mt-4">
          <p className="text-xl font-bold tracking-tight">Nothing active yet</p>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
            Send someone a job or start a project, and its progress shows up here.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/projects" className="brand-gradient-bg inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white">Start a project</Link>
            <Link href="/notes" className="inline-flex rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-semibold">Write a note</Link>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-xl font-bold tracking-tight">{title}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${task?.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
              {task?.status === "done" ? "Done" : "In progress"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[var(--muted)]">{task ? `Assigned to ${task.recipient_email}` : project?.client_name || "Active project"}</p>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
            {task?.due_date && <span className="inline-flex items-center gap-1.5"><CalendarBlank size={16} />Due {formatShortDate(task.due_date)}</span>}
            {task?.location && <span className="inline-flex items-center gap-1.5"><MapPin size={16} />{task.location}</span>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {task?.location ? (
              <a href={mapsUrl(task.location)} onClick={handleMapsClick(task.location)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--surface-border)]">Open in Maps <ArrowSquareOut size={15} /></a>
            ) : (
              <Link href={href} className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--surface-border)]">Open work <ArrowRight size={15} /></Link>
            )}
            <button type="button" onClick={onShare} className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"><ShareNetwork size={16} />Share</button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--surface-border)] pt-5">
        <TodayTimeline eventsOverride={scheduleEvents} calendarHref={calendarHref} />
      </div>
    </section>
  );
}

// A file's own colour, borrowed from the conventions people already know from
// Office and Drive — red for PDFs, green for spreadsheets, and so on. Matched
// against the mime type, the filename and the title together, because an
// uploaded file may carry any one of the three and not the others.
const FILE_KINDS: { pattern: RegExp; icon: typeof FileText; tint: string }[] = [
  { pattern: /pdf/, icon: FilePdf, tint: "bg-red-50 text-red-600" },
  { pattern: /sheet|excel|\.(xlsx?|csv|numbers)\b/, icon: FileXls, tint: "bg-emerald-50 text-emerald-600" },
  { pattern: /presentation|powerpoint|slide|deck|\.(pptx?|key)\b/, icon: FilePpt, tint: "bg-amber-50 text-amber-600" },
  { pattern: /image\/|\.(png|jpe?g|gif|webp|heic|svg)\b/, icon: FileImage, tint: "bg-violet-50 text-violet-600" },
  { pattern: /video\/|\.(mp4|mov|webm|m4v)\b/, icon: FileVideo, tint: "bg-rose-50 text-rose-600" },
  { pattern: /audio\/|\.(mp3|wav|m4a|aac)\b/, icon: FileAudio, tint: "bg-teal-50 text-teal-600" },
  { pattern: /zip|compress|\.(zip|tar|gz|rar|7z)\b/, icon: FileZip, tint: "bg-slate-100 text-slate-600" },
  { pattern: /word|wordprocessing|\.(docx?|rtf|txt|md)\b/, icon: FileDoc, tint: "bg-blue-50 text-blue-600" },
];

function fileKind(document: UserDocument) {
  const hint = `${document.mime_type || ""} ${document.title || ""} ${document.file_path || ""}`.toLowerCase();
  return (
    FILE_KINDS.find((kind) => kind.pattern.test(hint)) || {
      icon: FileText,
      tint: "bg-indigo-50 text-indigo-600",
    }
  );
}

function RecentlyShared({ documents }: { documents: UserDocument[] }) {
  return (
    <section className="mf-card h-full rounded-3xl p-6" aria-labelledby="recently-shared-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recently-shared-heading" className="text-lg font-bold">Recent files</h2>
        <Link href="/documents" className="text-xs font-semibold text-[var(--muted)] hover:text-current">See all files</Link>
      </div>
      {documents.length ? (
        <div className="mt-3 divide-y divide-[var(--surface-border)]">
          {documents.slice(0, 2).map((document) => {
            const { icon: KindIcon, tint } = fileKind(document);
            return (
            <Link href={`/documents?document=${encodeURIComponent(document.id)}`} key={document.id} className="flex items-center gap-3 rounded-xl py-3 transition hover:bg-indigo-500/5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tint}`}><KindIcon size={19} weight="fill" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{document.title}</span><span className="block text-xs text-[var(--muted)]">{formatShortDate(document.created_at)}</span></span>
              <ArrowRight size={15} className="shrink-0 text-[var(--muted)]" />
            </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Add a document, photo or plan to Files. Your latest uploads will appear here.</p>
      )}
    </section>
  );
}

// Keep sharing close by without competing with today's work.
/**
 * The things people come to Home to do, one click each. This row used to be
 * "Your workspace: Tasks, Projects, Meetings, Calendar" — the sidebar again.
 * The ways to send work to someone, which hid behind a "Share work with
 * someone" disclosure, are here now too.
 *
 * All four carry the same weight. MemoValet is a personal assistant, not a
 * meeting app: the Ask bar above is the main way in, and a meeting is one
 * thing among several you might do next.
 */
function QuickActions({ previewMode }: { previewMode: boolean }) {
  const to = (path: string) => (previewMode ? `/preview${path}` : path);
  const actions = [
    { label: "Send a task", path: "/tasks", icon: PaperPlaneTilt },
    { label: "Write a note", path: "/notes", icon: NotePencil },
    { label: "Start a meeting", path: "/meeting", icon: VideoCamera },
    { label: "Share a file", path: "/documents", icon: FileText },
  ];
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2.5">
      {actions.map(({ label, path, icon: Icon }) => (
        <Link
          key={path}
          href={to(path)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--surface)] px-4 text-sm font-semibold ring-1 ring-[var(--surface-border)] transition hover:-translate-y-0.5 hover:ring-indigo-300"
        >
          <Icon size={17} weight="duotone" className="text-indigo-600" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

// The dot repeats in colour what the line underneath already says in words:
// red for something already late, amber for today, calmer colours for the rest.
// Colour is reinforcement here, never the only signal.
const ATTENTION_DOT: Record<AttentionType, string> = {
  commitment_overdue_they_owe: "bg-red-500",
  task_overdue: "bg-red-500",
  commitment_due_i_owe: "bg-amber-500",
  task_due_today: "bg-amber-500",
  reminder_due: "bg-violet-500",
  meeting_today: "bg-sky-500",
};

export default function HomeWorkspace({ firstName, accountType = "personal", totalMeetings, meetingsThisWeek, totalActionItems, totalTasksSent, previewMode = false, askPath = "/ask", onSampleSchedule, priorities = [], recentDocuments = [], activeProject, activeTask, scheduleEvents, calendarHref, savedLayout, onboarding }: HomeWorkspaceProps) {
  // Questions from the search bar go to the real Ask page, which answers from
  // the user's actual meetings, tasks, and documents with sources — the old
  // in-place "results" were a hardcoded demo.
  const router = useRouter();
  const askFromBar = (q: string, spoken = false) =>
    router.push(`${askPath}${askPath.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}${spoken ? "&voice=1" : ""}`);
  const [shareOpen, setShareOpen] = useState(false);
  const [reminderError, setReminderError] = useState("");
  const [pendingReminder, setPendingReminder] = useState<string | null>(null);
  const reminderLock = useRef(false);
  const completeReminder = async (id: string) => {
    if (reminderLock.current) return;
    reminderLock.current = true;
    setPendingReminder(id);
    setReminderError("");
    try {
      const response = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!response.ok) throw new Error("Reminder not saved");
      router.refresh();
    } catch {
      setReminderError("Couldn't complete that reminder. Please try again.");
    } finally {
      reminderLock.current = false;
      setPendingReminder(null);
    }
  };
  const greeting = useSyncExternalStore(subscribeNoop, getGreeting, getGreetingServer);

  // Shown at once; saved to the account behind it.
  const [layout, setLayout] = useState<HomeLayout>(() => homeLayout(savedLayout));
  const [layoutError, setLayoutError] = useState("");
  const changeLayout = (next: HomeLayout) => {
    setLayout(next);
    setLayoutError("");
    if (previewMode) return;
    void createClient()
      .auth.updateUser({ data: { home_layout: next } })
      .then(({ error }) => { if (error) setLayoutError("Couldn't save that. It will reset when you reload."); })
      .catch(() => setLayoutError("Couldn't save that. It will reset when you reload."));
  };

  const visiblePriorities: NonNullable<HomeWorkspaceProps["priorities"]> = priorities.length > 0
    // Five, now the card is as tall as the one beside it: more of what needs
    // you, instead of empty space under three.
    ? priorities.slice(0, 5)
    : previewMode
      ? [
          { title: "Sarah owes you: Signed contract", description: "2 days overdue", type: "commitment_overdue_they_owe" as const },
          { title: "You promised James: Send updated pricing", description: "Due today", type: "commitment_due_i_owe" as const },
          { title: "Team planning", description: "10:30 AM", type: "meeting_today" as const },
        ]
      : [];

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting}{firstName && <>{" "}<span className="brand-gradient-text capitalize">{firstName}</span></>}</h1>
          {/* The weather sits with the subtitle, clear of the notification bell in the top corner. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[var(--muted)]">{accountType === "personal" ? "Here’s what’s on your plate today." : "Here’s what needs your attention today."}</p>
            {!layout.hidden.includes("weather") && <WeatherChip previewMode={previewMode} />}
          </div>
        </div>
        {/* Left of the notification bell, which is fixed in the top corner on larger screens. */}
        <div className="flex items-center gap-2 md:mr-14">
          {/* The tour used to sit in a full-width banner under this header on
              every visit, for ever. New people still get it opened for them;
              everyone else has it one click away here. */}
          {onboarding && <OnboardingTour key={onboarding.userId} {...onboarding} firstName={firstName} personal={accountType === "personal"} />}
          <HomeCustomiser layout={layout} onChange={changeLayout} saveError={layoutError} />
        </div>
      </header>

      {/* Cards in the same row stretch to the same height, so a short card
          beside a tall one no longer leaves a hole underneath it. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        {cardWidths(layout).map(({ id, span }) => (
          <div key={id} data-tour={`home-${id}`} className={`min-w-0 ${CARD_SPAN[span]}`}>
            {renderCard(id)}
          </div>
        ))}
      </div>
      {shareOpen && <ShareDialog project={activeProject} task={activeTask} onClose={() => setShareOpen(false)} />}
    </div>
  );

  function renderCard(id: HomeCardId) {
    switch (id) {
      case "search":
        return (
          <>
            <UniversalBar onResults={askFromBar} previewMode={previewMode} onSampleSchedule={onSampleSchedule} />
            <SuggestedCommands onSelect={askFromBar} accountType={accountType} />
          </>
        );
      case "shortcuts":
        return <QuickActions previewMode={previewMode} />;
      case "up-next":
        return <UpNextCard project={activeProject} task={activeTask} onShare={() => setShareOpen(true)} scheduleEvents={scheduleEvents} calendarHref={calendarHref} />;
      case "needs-you":
        return (
        <section className="mf-card flex h-full flex-col rounded-3xl p-6" aria-labelledby="attention-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="attention-heading" className="text-lg font-bold">Needs you</h2>
            <Link href="/tasks" className="text-xs font-semibold text-[var(--muted)] hover:text-current">View all</Link>
          </div>
          {visiblePriorities.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {visiblePriorities.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--surface-border)]">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.type ? ATTENTION_DOT[item.type] : "bg-indigo-500"}`} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{item.description}</span></span>
                  {item.reminderId ? (
                    <button type="button" disabled={pendingReminder !== null} onClick={() => completeReminder(item.reminderId!)} className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold ring-1 ring-[var(--surface-border)] disabled:opacity-50">{pendingReminder === item.reminderId ? "Saving…" : "Mark done"}</button>
                  ) : <Link href={item.href || "/tasks"} className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold ring-1 ring-[var(--surface-border)]">Review</Link>}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl bg-indigo-500/5 p-5">
              <CheckCircle size={25} weight="duotone" className="mb-3 text-indigo-500" />
              <p className="font-semibold">You&apos;re all caught up</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Tasks, reminders and promises appear here when they need you.</p>
              <Link href="/tasks" className="mx-auto mt-4 inline-flex rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--surface-border)]">Open tasks</Link>
            </div>
          )}
          {reminderError && <p role="alert" className="mt-3 text-sm text-red-600">{reminderError}</p>}
        </section>
        );
      case "glance":
        return (
        <section className="mf-card flex h-full flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center" aria-labelledby="glance-heading">
          <h2 id="glance-heading" className="shrink-0 text-sm font-semibold text-[var(--muted)]">At a glance</h2>
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat value={totalMeetings} label="Meetings" />
            <Stat value={meetingsThisWeek} label="This week" />
            <Stat value={totalActionItems} label={accountType === "personal" ? "Tasks" : "Action items"} />
            <Stat value={totalTasksSent} label={accountType === "personal" ? "Sent to others" : "Tasks sent"} />
          </div>
        </section>
        );
      case "recent-files":
        return <RecentlyShared documents={recentDocuments} />;
    }
  }
}
