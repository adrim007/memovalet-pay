"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowsOut,
  ArrowsIn,
  ChatCircle,
  CaretDown,
  CaretUp,
  ChartBar,
  CheckSquare,
  ClockCounterClockwise,
  ClosedCaptioning,
  Copy,
  DotsThree,
  DownloadSimple,
  FileText,
  Folder,
  Gear,
  House,
  Microphone,
  MicrophoneSlash,
  MonitorArrowUp,
  NotePencil,
  Record,
  PhoneDisconnect,
  Plus,
  Question,
  ShareNetwork,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  Translate,
  User,
  Users,
  VideoCamera,
  VideoCameraSlash,
  X,
} from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";
import LiveMeetingChat from "@/components/LiveMeetingChat";
import LiveTranslationPanel from "@/components/LiveTranslationPanel";
import { attachStream } from "@/lib/video-attach";
import type { ChatDraft, ChatMessage } from "@/lib/meeting-chat";

export interface LiveRoomParticipant {
  id: string;
  name: string;
  langLabel: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
  imageUrl?: string;
}

export interface LiveRoomCaption {
  id: string;
  speakerId: string;
  speakerName: string;
  langLabel: string;
  original: string;
  translated: string;
  time: string;
  live?: boolean;
  /** Waiting on its translation: shown as such, rather than as untranslated. */
  translating?: boolean;
}

export interface LiveRoomNotes {
  discussionPoints: string[];
  nextSteps: { id: string; text: string; done: boolean }[];
}

interface LiveMeetingRoomProps {
  title: string;
  elapsedLabel: string;
  participants: LiveRoomParticipant[];
  participantCount: number;
  /** Who LiveKit hears talking. Falls back to the last caption when absent. */
  activeSpeakerId?: string;
  /** Host only: switch someone's microphone off for the whole room. */
  onMuteForEveryone?: (identity: string) => Promise<void>;
  /** A screen someone is sharing. It takes the stage while it lasts. */
  screenShare?: { stream: MediaStream; name: string; isMine?: boolean };
  captions: LiveRoomCaption[];
  /** What captions are doing, shown in the translation panel. */
  captionStatus?: string;
  /** This call and its pass, for searching GIFs from the chat. */
  sessionId?: string;
  callPass?: string | null;
  myLangCode: string;
  speakingLangCode?: string;
  onSpeakingLanguageChange?: (code: string) => void;
  translationEnabled?: boolean;
  /** Translation on — from the Translate button or the panel's Translation tab. */
  onTranslate?: () => void;
  recording?: boolean;
  localRecording?: boolean;
  recordingBusy?: boolean;
  recordingReady?: boolean;
  recordingWarning?: string;
  onToggleRecording?: () => void;
  onDownloadRecording?: () => void;
  onToggleScreenSharing?: () => void;
  screenSharing?: boolean;
  canFinish?: boolean;
  endLabel?: string;
  finishMessage?: string;
  notes: LiveRoomNotes;
  micEnabled: boolean;
  cameraEnabled: boolean;
  deviceBusy?: boolean;
  saving?: boolean;
  statusMessage?: string;
  onLanguageChange: (code: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShare: () => void;
  onFinish: () => void;
  onLeave?: () => void;
  onNotesChange: (notes: LiveRoomNotes) => void;
  chatMessages?: ChatMessage[];
  selfId?: string;
  onSendChat?: (draft: ChatDraft) => Promise<void>;
}

const navItems = [
  { label: "Home", href: "/dashboard", icon: House },
  { label: "Meetings", href: "/meeting", icon: VideoCamera, active: true },
  { label: "Ask", href: "/ask", icon: Question },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Insights", href: "/insights", icon: ChartBar },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "People", href: "/people", icon: User },
  { label: "Library", href: "/history", icon: ClockCounterClockwise },
  { label: "Settings", href: "/settings", icon: Gear },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Tiles on screen at once. Everyone past this is heard, and one tap away. */
const MAX_TILES = 9;

function ParticipantVideo({
  participant,
  prominent,
  expanded,
  onEnlarge,
  onShowLarge,
  speaking,
  muted,
}: {
  participant: LiveRoomParticipant;
  prominent?: boolean;
  expanded?: boolean;
  onEnlarge?: () => void;
  /** Small tiles swap themselves into the big frame when clicked. */
  onShowLarge?: () => void;
  /** Ringed while they are the one talking. */
  speaking?: boolean;
  /** You have silenced them for yourself; say so, or it looks like a fault. */
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !participant.stream) return;
    // Keeps playing rather than playing once: a call that stalls for a moment
    // should come back on its own instead of sitting on a frozen frame.
    return attachStream(video, participant.stream);
  }, [participant.stream]);

  const hasVideo = !!participant.stream && participant.cameraEnabled !== false;
  const hasPreviewImage = !!participant.imageUrl && participant.cameraEnabled !== false;

  return (
    <div
      className={`relative overflow-hidden ${expanded ? "bg-slate-900" : "bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50"} ${
        expanded
          ? "h-full min-h-0 w-full rounded-lg"
          : prominent
            ? // The big frame takes the height the window has left over.
              "h-full w-full rounded-lg"
            : "aspect-video w-28 shrink-0 rounded-lg sm:w-36"
      } ${speaking ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#f6f7fb]" : ""}`}
    >
      {participant.stream && (
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          // Match Teams and other call apps: your self-view behaves like a
          // mirror, while everyone else is shown naturally. Mirroring remote
          // video reverses writing, gestures and which side of a room they are on.
          className={`h-full w-full ${participant.isLocal ? "-scale-x-100" : ""} ${expanded ? "object-contain" : "object-cover"} ${hasVideo ? "" : "hidden"}`}
        />
      )}
      {!hasVideo && (hasPreviewImage ? (
        <Image
          src={participant.imageUrl as string}
          alt=""
          fill
          sizes={prominent ? "(min-width: 1024px) 60vw, 100vw" : "10rem"}
          className={expanded ? "object-contain" : "object-cover"}
          priority={prominent}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span
            className={`grid place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-semibold text-white shadow-lg shadow-indigo-500/20 ${
              prominent ? "h-24 w-24 text-3xl" : "h-12 w-12 text-sm"
            }`}
          >
            {initials(participant.name)}
          </span>
          {/* Said on every tile, not just a spotlit one — in a gallery a silent
              circle of initials leaves you wondering if it's you or them. */}
          <span className={prominent ? "text-sm text-slate-500" : "text-[11px] text-slate-500"}>
            Camera is off
          </span>
        </div>
      ))}
      {onEnlarge && <button type="button" onClick={onEnlarge} aria-label={`Enlarge video for ${participant.name}`}
        className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-xl bg-slate-950/70 text-white hover:bg-slate-950 focus:ring-2 focus:ring-indigo-400"><ArrowsOut size={21} /></button>}

      {/* A small tile is a button: tap a face to put it in the big frame. */}
      {onShowLarge && (
        <button
          type="button"
          onClick={onShowLarge}
          aria-label={`Show ${participant.name} in the big view`}
          className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        />
      )}

      <div className={`pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-slate-950/65 py-1.5 text-xs font-medium text-white backdrop-blur-sm ${prominent ? "px-2.5" : "px-2"}`}>
        <span className="truncate">{participant.name}</span>
        {participant.isLocal && <span className="shrink-0 text-white/70">(You)</span>}
        {participant.micEnabled === false ? (
          <MicrophoneSlash size={13} weight="bold" className="shrink-0 text-rose-300" />
        ) : (
          <Microphone size={13} weight="bold" className="shrink-0 text-emerald-300" />
        )}
        {muted && <SpeakerSimpleSlash size={13} weight="bold" className="shrink-0 text-amber-300" aria-label="Muted for you" />}
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-slate-200/80 bg-white/70 px-5 py-6 backdrop-blur-xl xl:flex xl:flex-col">
      <Logo size="lg" href="/dashboard" />

      <nav className="mt-12 space-y-1.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                "active" in item && item.active
                  ? "bg-gradient-to-r from-indigo-600 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-600 hover:bg-indigo-50 hover:text-slate-950"
              }`}
            >
              <Icon size={18} weight={"active" in item && item.active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Workspace
        </p>
        <Link
          href="/dashboard"
          className="block rounded-xl bg-indigo-50 px-3.5 py-2.5 text-sm font-medium text-slate-900"
        >
          Personal
        </Link>
        <Link href="/people?view=groups" className="mt-1 block px-3.5 py-2 text-sm text-slate-600">
          + Manage groups
        </Link>
        <div className="mt-12 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-semibold text-white">
            A
          </span>
          <span className="text-sm font-medium">Maya</span>
        </div>
      </div>
    </aside>
  );
}

function ParticipantAudio({ participant, muted }: { participant: LiveRoomParticipant; muted?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !participant.stream) return;
    let active = true;
    audio.srcObject = participant.stream;
    audio.play().then(() => { if (active) setBlocked(false); }).catch(() => { if (active) setBlocked(true); });
    return () => { active = false; audio.srcObject = null; };
  }, [participant.stream]);
  // Silencing someone is yours alone: it stops you hearing them, and does
  // nothing to their microphone or to what anyone else hears.
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = Boolean(muted);
  }, [muted]);
  return <>
    <audio ref={audioRef} autoPlay muted={muted} />
    {blocked && !muted && <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      onClick={() => { void audioRef.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); }}>
      Play {participant.name}&apos;s audio
    </button>}
  </>;
}

/**
 * A shared screen on the stage. Never flipped and never cropped, whatever the
 * faces around it do: it is nearly always text, and text has to read the right
 * way round and stay inside the frame.
 */
function SharedScreen({ share }: { share: { stream: MediaStream; name: string; isMine?: boolean } }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return attachStream(video, share.stream);
  }, [share.stream]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-950">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Your own screen is played back silently, or you would hear yourself.
        muted={share.isMine}
        className="h-full w-full object-contain"
      />
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        <MonitorArrowUp size={14} weight="bold" />
        {share.isMine ? "You are sharing your screen" : `${share.name}'s screen`}
      </div>
    </div>
  );
}

/** Host only, and only while their microphone is actually live. */
function MuteForEveryone({ name, onMute }: { name: string; onMute: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      title={`Switch ${name}'s microphone off for everyone. They can turn it back on themselves.`}
      onClick={async () => {
        setBusy(true);
        setFailed(false);
        try {
          await onMute();
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
      className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
    >
      <MicrophoneSlash size={15} />
      {busy ? "Muting…" : failed ? "Try again" : "Mute for all"}
    </button>
  );
}

function ControlButton({
  label,
  active,
  danger,
  onClick,
  children,
  disabled,
  keepLabel,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Always show the word, however narrow the bar gets. */
  keepLabel?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition sm:px-3 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600"
          : active
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-700 hover:bg-slate-100"
      }`}
      aria-pressed={active}
    >
      {children}
      {/* Labels appear when the bar itself has room — not when the window does.
          With the chat docked beside the call the bar is narrow, so the rest of
          the buttons become icons with tooltips instead of wrapping onto a
          second row. Mic, camera and leave always say what they are. */}
      <span className={danger ? "inline" : keepLabel ? "hidden @2xl:inline" : "hidden @4xl:inline"}>{label}</span>
    </button>
  );
}

export default function LiveMeetingRoom({
  title,
  elapsedLabel,
  participants,
  participantCount,
  activeSpeakerId,
  onMuteForEveryone,
  screenShare,
  captions,
  captionStatus,
  sessionId,
  callPass,
  myLangCode,
  speakingLangCode,
  onSpeakingLanguageChange,
  translationEnabled = false,
  onTranslate,
  recording = false,
  localRecording = recording,
  recordingBusy = false,
  recordingReady = false,
  recordingWarning,
  onToggleRecording,
  onDownloadRecording,
  onToggleScreenSharing,
  screenSharing = false,
  canFinish = true,
  endLabel,
  finishMessage,
  notes,
  micEnabled,
  cameraEnabled,
  deviceBusy = false,
  saving,
  statusMessage,
  onLanguageChange,
  onToggleMic,
  onToggleCamera,
  onShare,
  onFinish,
  onLeave,
  onNotesChange,
  chatMessages = [],
  selfId = "",
  onSendChat,
}: LiveMeetingRoomProps) {
  const [roomPanel, setRoomPanel] = useState<"chat" | "notes">("chat");
  const [showTranslation, setShowTranslation] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [captionMode, setCaptionMode] = useState<"translation" | "original">("translation");
  const [newPoint, setNewPoint] = useState("");
  const [newStep, setNewStep] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showEndOptions, setShowEndOptions] = useState(false);
  const [showConversation, setShowConversation] = useState(true);
  const [mutedForMe, setMutedForMe] = useState<string[]>([]);
  const stageRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const endMenuRef = useRef<HTMLDivElement>(null);
  const endMenuButtonRef = useRef<HTMLButtonElement>(null);
  const nativeFullScreenRef = useRef(false);
  const exitExpanded = () => {
    setExpanded(false);
    setPinnedId(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    returnFocusRef.current?.focus();
  };
  const enlarge = (id?: string) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    if (id) setPinnedId(id);
    setExpanded(true);
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    setShowOptions(false);
    // iPhone Safari may not support element fullscreen. The fixed viewport
    // layout still expands the video and retains the call controls.
  };
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") exitExpanded();
      if (event.key === "Tab") {
        const buttons = Array.from(stageRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []).filter(button => button.getClientRects().length);
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const fullscreen = () => {
      if (document.fullscreenElement) nativeFullScreenRef.current = true;
      else if (nativeFullScreenRef.current) { nativeFullScreenRef.current = false; exitExpanded(); }
    };
    document.addEventListener("keydown", keyboard);
    document.addEventListener("fullscreenchange", fullscreen);
    stageRef.current?.querySelector<HTMLButtonElement>('[aria-label="Exit expanded view"]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [expanded]);

  useEffect(() => {
    if (!showEndOptions) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!endMenuRef.current?.contains(target) && !endMenuButtonRef.current?.contains(target)) {
        setShowEndOptions(false);
      }
    };
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowEndOptions(false);
      endMenuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [showEndOptions]);

  // Whoever is talking takes the big tile, unless you have pinned someone. The
  // caption fallback is only for the preview page, which has no live audio.
  const speakingId = activeSpeakerId ?? captions.at(-1)?.speakerId;
  const activeParticipant =
    participants.find((participant) => participant.id === pinnedId) ||
    participants.find((participant) => participant.id === speakingId) ||
    participants.find((participant) => !participant.isLocal) ||
    participants[0];

  // Everyone else runs along the bottom as small tiles you can click to swap in.
  // While a screen is being shared it holds the stage, so every face — the
  // talker included — belongs in the strip.
  const stripParticipants = useMemo(
    () =>
      participants
        .filter((participant) => screenShare || participant.id !== activeParticipant?.id)
        .slice(0, MAX_TILES),
    [activeParticipant?.id, participants, screenShare]
  );
  // Everyone is in the strip during a screen share, so nobody is on the stage
  // to discount.
  const overflowCount = Math.max(
    0,
    participantCount - stripParticipants.length - (screenShare ? 0 : 1)
  );

  const addPoint = () => {
    const value = newPoint.trim();
    if (!value) return;
    onNotesChange({ ...notes, discussionPoints: [...notes.discussionPoints, value] });
    setNewPoint("");
  };

  const addStep = () => {
    const value = newStep.trim();
    if (!value) return;
    onNotesChange({
      ...notes,
      nextSteps: [...notes.nextSteps, { id: crypto.randomUUID(), text: value, done: false }],
    });
    setNewStep("");
  };

  // From lg up the call owns the window: nothing scrolls, and the height left
  // over after the heading and the controls belongs to the tiles. Below that the
  // page scrolls normally, which is what a phone wants.
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#171722] lg:h-dvh lg:min-h-0 lg:overflow-hidden xl:flex">
      <Sidebar />

      <main className="min-w-0 flex-1 p-3 sm:p-5 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:p-6">
        {participants.filter(participant => !participant.isLocal && participant.stream).map(participant => (
          <ParticipantAudio
            key={participant.id}
            participant={participant}
            muted={mutedForMe.includes(participant.id)}
          />
        ))}
        <header className="mb-4 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">
          <div className="xl:hidden">
            <Logo size="md" href="/dashboard" />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users size={18} />
            <span>{participantCount}</span>
          </div>
          {/* Red means recording, everywhere, so it is only red when something
              is. It used to be red regardless — "Live call" in the recording
              colour — and whole meetings went by with everyone assuming they
              were being captured when nothing was. */}
          {recording ? (
            <div role="status" className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 ring-4 ring-red-500/15" />
              Recording {elapsedLabel}
            </div>
          ) : (
            <div role="status" className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              Live call {elapsedLabel}
              <span className="text-slate-400">· Not recording</span>
              {onToggleRecording && !recordingBusy && (
                <button
                  type="button"
                  onClick={onToggleRecording}
                  disabled={saving}
                  className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {recordingReady ? "Record again" : "Record"}
                </button>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {onSpeakingLanguageChange && <label className="hidden lg:block">
              <span className="sr-only">Language you speak</span>
              <select aria-label="Language you speak" value={speakingLangCode} onChange={e => onSpeakingLanguageChange(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                {SPEECH_LANGUAGE_OPTIONS.map(language => <option key={language.code} value={language.code}>I speak {language.label}</option>)}
              </select>
            </label>}
            <label className="relative hidden sm:block">
              <span className="sr-only">Language you receive captions in</span>
              <select
                value={myLangCode}
                onChange={(event) => onLanguageChange(event.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              >
                {SPEECH_LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.code} value={language.code}>
                    I receive captions in {language.label}
                  </option>
                ))}
              </select>
              <CaretDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowOptions(value => !value)}
              aria-expanded={showOptions}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-950"
              aria-label="More meeting options"
            >
              <DotsThree size={22} weight="bold" />
            </button>
          </div>
        </header>

        {statusMessage && (
          <div
            role="status"
            className="mb-4 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            {statusMessage}
          </div>
        )}
        {showOptions && <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3" aria-label="Meeting options">
          <button type="button" onClick={() => enlarge()} className="rounded-lg px-4 py-3 text-sm hover:bg-indigo-50">Expand meeting</button>
          <button type="button" onClick={() => { onShare(); setShowOptions(false); }} className="rounded-lg px-4 py-3 text-sm hover:bg-indigo-50">Copy invite link</button>
          {onDownloadRecording && <button type="button" onClick={() => { setShowOptions(false); onDownloadRecording(); }} className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm hover:bg-indigo-50"><DownloadSimple size={18} />Download recording backup</button>}
          {canFinish && <button type="button" onClick={() => { setShowOptions(false); onFinish(); }} className="rounded-lg px-4 py-3 text-sm text-red-700 hover:bg-red-50">End meeting for everyone</button>}
          {!canFinish && <span className="px-2 text-xs text-slate-500">The host finishes and saves the meeting.</span>}
        </div>}
        {/* Recording and screen share moved into the control bar with everything
            else. Only a line that needs reading stays up here — and only while
            it is true, rather than a permanent bar saying "Recording off". */}
        {(recordingBusy || recording || recordingReady) && (
          <p role="status" className="mb-3 shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
            {recordingBusy
              ? "Preparing recording…"
              : recording
                ? "Recording · keep this tab visible"
                : "Recording stopped · backup ready"}
          </p>
        )}
        {recordingWarning && <p role="alert" className="mb-3 shrink-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{recordingWarning}</p>}

        {/* Video on the left, conversation docked on the right — the shape every
            call app uses. Both columns stretch to the same height, so the chat
            is beside the call instead of below the fold. One column when the
            conversation is closed, and stacked on a phone. */}
        <div
          className={`grid gap-4 lg:min-h-0 lg:flex-1 ${
            showConversation
              ? "lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]"
              : ""
          }`}
        >
          <section ref={stageRef} aria-label="Meeting video" className={expanded ? "fixed inset-0 z-40 flex h-dvh min-w-0 flex-col bg-slate-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "flex min-w-0 flex-col lg:min-h-0"}>
            <div className={`mb-2 flex shrink-0 items-center justify-between gap-2 ${expanded ? "text-white" : "text-slate-600"}`}>
              <span className="text-sm">{expanded ? "Expanded view" : "Speaker view"}{recording ? " · Recording" : ""}</span>
              {expanded && canFullscreen && <button type="button" onClick={() => { void stageRef.current?.requestFullscreen().catch(() => {}); }} className="hidden min-h-11 rounded-lg px-3 text-sm hover:bg-indigo-500/10 md:block">Full screen</button>}
              <button type="button" aria-label={expanded ? "Exit expanded view" : "Expand meeting"} onClick={() => expanded ? exitExpanded() : enlarge()} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-indigo-500/10">
                {expanded ? <ArrowsIn size={20} /> : <ArrowsOut size={20} />}{expanded ? "Back to meeting" : "Expand"}
              </button>
            </div>
            {/* The talker fills the room and everyone else waits along the
                bottom, which is what Teams and Zoom do. Click a small tile to
                pin that person instead. */}
            <div className="min-h-[14rem] lg:min-h-0 lg:flex-1">
              {screenShare ? (
                <SharedScreen share={screenShare} />
              ) : activeParticipant ? (
                <ParticipantVideo
                  participant={activeParticipant}
                  prominent
                  expanded={expanded}
                  muted={mutedForMe.includes(activeParticipant.id)}
                  onEnlarge={expanded ? undefined : () => enlarge(activeParticipant.id)}
                />
              ) : (
                <div className={`grid h-full place-items-center rounded-2xl border border-dashed text-sm ${expanded ? "border-slate-700 text-slate-400" : "border-slate-300 bg-white text-slate-500"}`}>
                  Waiting for someone to join…
                </div>
              )}
            </div>

            {stripParticipants.length + (overflowCount > 0 ? 1 : 0) > 0 && (
              <div
                className={expanded ? "hidden" : "mt-2 flex shrink-0 gap-2 overflow-x-auto pb-1"}
                aria-label="Everyone else in this meeting"
              >
                {stripParticipants.map((participant) => (
                  <ParticipantVideo
                    key={participant.id}
                    participant={participant}
                    speaking={participant.id === speakingId}
                    muted={mutedForMe.includes(participant.id)}
                    onShowLarge={() => setPinnedId(participant.id)}
                  />
                ))}
                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowParticipants(true)}
                    className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 sm:w-36"
                  >
                    <Users size={22} />
                    <span className="text-xs font-medium">+{overflowCount} more</span>
                  </button>
                )}
              </div>
            )}

            {/* Anything the End button needs to say appears right beside it, not at the top of the room. */}
            {finishMessage && (
              <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {finishMessage}
              </p>
            )}
            <div className="@container sticky bottom-2 z-10 mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/30 sm:justify-between">
              {/* On a phone the controls get their own centred row so they don't
                  wrap into a ragged block beside Leave. */}
              <div className="flex w-full flex-wrap items-center justify-center gap-1 sm:w-auto sm:flex-1 sm:justify-start">
                <ControlButton label={micEnabled ? "Mute" : "Unmute"} onClick={onToggleMic} disabled={deviceBusy} keepLabel>
                  {micEnabled ? <Microphone size={21} /> : <MicrophoneSlash size={21} />}
                </ControlButton>
                <ControlButton
                  label={cameraEnabled ? "Stop camera" : "Start camera"}
                  onClick={onToggleCamera}
                  disabled={deviceBusy}
                  keepLabel
                >
                  {cameraEnabled ? <VideoCamera size={21} /> : <VideoCameraSlash size={21} />}
                </ControlButton>
                <ControlButton
                  label="Captions"
                  active={showTranslation}
                  onClick={() => { if (expanded) exitExpanded(); setShowTranslation(true); setCaptionMode("original"); }}
                >
                  <ClosedCaptioning size={22} />
                </ControlButton>
                <ControlButton
                  label="Translate"
                  active={showTranslation && captionMode === "translation"}
                  onClick={() => {
                    if (expanded) exitExpanded();
                    onTranslate?.();
                    setShowTranslation(true);
                    setCaptionMode("translation");
                  }}
                >
                  <Translate size={21} />
                </ControlButton>
                <ControlButton
                  label={`Participants ${participantCount}`}
                  onClick={() => { if (expanded) exitExpanded(); setShowParticipants(true); }}
                >
                  <Users size={21} />
                </ControlButton>
                {onToggleScreenSharing && (
                  <ControlButton
                    label={screenSharing ? "Stop share" : "Share screen"}
                    active={screenSharing}
                    onClick={onToggleScreenSharing}
                  >
                    <MonitorArrowUp size={21} />
                  </ControlButton>
                )}
                {onToggleRecording && (
                  <ControlButton
                    label={recordingBusy ? "Preparing…" : localRecording ? "Stop recording" : recordingReady ? "Record again" : "Record"}
                    active={localRecording}
                    disabled={recordingBusy || saving}
                    onClick={onToggleRecording}
                    keepLabel
                  >
                    <Record size={21} weight={localRecording ? "fill" : "regular"} />
                  </ControlButton>
                )}
                <ControlButton label="Invite" onClick={onShare}>
                  <ShareNetwork size={21} />
                </ControlButton>
                {onSendChat && <ControlButton label="Chat" active={showConversation && roomPanel === "chat"} onClick={() => { if (expanded) exitExpanded(); setRoomPanel("chat"); setShowConversation(value => !value); }}><ChatCircle size={21} /></ControlButton>}
              </div>
              <div className="relative flex shrink-0 items-center gap-1">
                <ControlButton label={endLabel ?? "Leave"} danger onClick={() => { setShowEndOptions(false); (onLeave ?? onFinish)(); }}>
                  <PhoneDisconnect size={21} weight="fill" />
                </ControlButton>
                {canFinish && (
                  <button
                    ref={endMenuButtonRef}
                    type="button"
                    aria-label="Leave and end meeting options"
                    aria-expanded={showEndOptions}
                    aria-controls="call-end-options"
                    onClick={() => setShowEndOptions((value) => !value)}
                    className="grid h-11 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    {showEndOptions ? <CaretUp size={18} /> : <CaretDown size={18} />}
                  </button>
                )}
                {showEndOptions && (
                  <div
                    ref={endMenuRef}
                    id="call-end-options"
                    role="menu"
                    aria-label="Leave and end meeting options"
                    className="absolute bottom-full right-0 z-30 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setShowEndOptions(false); (onLeave ?? onFinish)(); }}
                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium hover:bg-slate-50"
                    >
                      Leave meeting
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setShowEndOptions(false); onFinish(); }}
                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      End meeting for everyone
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* No display class on the aside itself: a class would outrank the
              hidden attribute, and hiding it is what collapses the second
              column. The flex column lives on the wrapper inside. */}
          <aside hidden={!showConversation} aria-label="Meeting conversation" className="min-w-0 lg:h-full lg:min-h-0">
            <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex shrink-0 flex-wrap gap-1 border-b border-slate-200" aria-label="Meeting panels">
              {([ ["chat", "Chat", ChatCircle], ["notes", "Shared notes", NotePencil] ] as const).filter(([key]) => key !== "chat" || onSendChat).map(([key, label, Icon]) => (
                <button key={key} type="button" aria-pressed={roomPanel === key} onClick={() => { setRoomPanel(key); if (key === "notes") setShowNotes(true); }} className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${roomPanel === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
                  <Icon size={18} />{label}{key === "chat" && chatMessages.length > 0 && <span className="text-xs tabular-nums">{chatMessages.length}</span>}
                </button>
              ))}
            </div>
            {onSendChat && <div hidden={roomPanel !== "chat"} className="min-h-0 flex-1"><LiveMeetingChat messages={chatMessages} selfId={selfId} onSend={onSendChat} active={roomPanel === "chat"} sessionId={sessionId} callPass={callPass} /></div>}
            <section hidden={roomPanel !== "notes"} className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex h-full min-h-0 flex-col">
              <button
                type="button"
                onClick={() => setShowNotes((value) => !value)}
                className="flex w-full shrink-0 items-center justify-between px-4 py-3.5 text-left"
                aria-expanded={showNotes}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <NotePencil size={19} />
                  Shared notes
                </span>
                {showNotes ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </button>

              {showNotes && (
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-4 pb-4 pt-3 lg:max-h-none max-h-[23rem]">
                  <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Shared with everyone</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-600">
                      {notes.nextSteps.length} next steps
                    </span>
                  </div>

                  <h3 className="mb-1.5 text-xs font-semibold text-slate-800">Discussion points</h3>
                  <ul className="space-y-1 text-xs leading-relaxed text-slate-600">
                    {notes.discussionPoints.map((point, index) => (
                      <li key={`${point}-${index}`} className="flex gap-2">
                        <span className="text-slate-400">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={newPoint}
                      onChange={(event) => setNewPoint(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addPoint();
                      }}
                      placeholder="Add a discussion point"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={addPoint}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      aria-label="Add discussion point"
                    >
                      <Plus size={15} weight="bold" />
                    </button>
                  </div>

                  <div className="my-3 border-t border-slate-100" />

                  <h3 className="mb-2 text-xs font-semibold text-slate-800">Next steps</h3>
                  <div className="space-y-2">
                    {notes.nextSteps.map((step) => (
                      <label key={step.id} className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={step.done}
                          onChange={() =>
                            onNotesChange({
                              ...notes,
                              nextSteps: notes.nextSteps.map((item) =>
                                item.id === step.id ? { ...item, done: !item.done } : item
                              ),
                            })
                          }
                          className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <span className={step.done ? "text-slate-400 line-through" : ""}>{step.text}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={newStep}
                      onChange={(event) => setNewStep(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addStep();
                      }}
                      placeholder="Add a next step"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={addStep}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      aria-label="Add next step"
                    >
                      <Plus size={15} weight="bold" />
                    </button>
                  </div>
                </div>
              )}
              </div>
            </section>
            </div>
          </aside>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 sm:hidden">
          <Translate size={16} />
          <select
            value={myLangCode}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
          >
            {SPEECH_LANGUAGE_OPTIONS.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={onShare} className="flex items-center gap-1 text-indigo-600">
            <Copy size={15} /> Copy invite
          </button>
        </div>

        {showTranslation && <LiveTranslationPanel
          captions={captions} language={myLangCode} onLanguageChange={onLanguageChange}
          enabled={translationEnabled}
          mode={captionMode}
          onModeChange={(mode) => {
            setCaptionMode(mode);
            // The Translation tab is as good as the Translate button.
            if (mode === "translation") onTranslate?.();
          }}
          onClose={() => setShowTranslation(false)}
          status={captionStatus}
        />}

        {showParticipants && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Meeting participants"
          >
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">People in this meeting</h2>
                  <p className="text-xs text-slate-500">{participantCount} participants</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParticipants(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Close participant list"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {participants.map((participant) => {
                  const silenced = mutedForMe.includes(participant.id);
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {initials(participant.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {participant.name} {participant.isLocal ? "(You)" : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {silenced
                            ? "Muted for you"
                            : participant.micEnabled === false
                              ? "Microphone off"
                              : `Speaks ${participant.langLabel}`}
                        </p>
                      </div>
                      {participant.micEnabled === false ? (
                        <MicrophoneSlash size={17} className="text-rose-500" />
                      ) : (
                        <Microphone size={17} className="text-emerald-600" />
                      )}
                      {/* Yours only — their microphone stays on for everyone else. */}
                      {!participant.isLocal && (
                        <button
                          type="button"
                          onClick={() =>
                            setMutedForMe((current) =>
                              silenced
                                ? current.filter((id) => id !== participant.id)
                                : [...current, participant.id]
                            )
                          }
                          aria-pressed={silenced}
                          className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
                            silenced
                              ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {silenced ? <SpeakerSimpleSlash size={15} /> : <SpeakerSimpleHigh size={15} />}
                          {silenced ? "Unmute" : "Mute for me"}
                        </button>
                      )}
                      {/* Their microphone, off for the whole room. Gone from the
                          row once it is off — only they can turn it back on. */}
                      {onMuteForEveryone && !participant.isLocal && participant.micEnabled !== false && (
                        <MuteForEveryone
                          name={participant.name}
                          onMute={() => onMuteForEveryone(participant.id)}
                        />
                      )}
                    </div>
                  );
                })}
                {overflowCount > 0 && (
                  <p className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
                    Plus {overflowCount} more people in the call
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
