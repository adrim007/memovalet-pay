"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RealtimeChannel } from "@supabase/supabase-js";
import { ConnectionState, Room, RoomEvent, Track, TrackEvent, createLocalTracks, type LocalTrack } from "livekit-client";
import { Check } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import LiveMeetingRoom, {
  type LiveRoomCaption,
  type LiveRoomNotes,
  type LiveRoomParticipant,
} from "@/components/LiveMeetingRoom";
import {
  AUTO_LANGUAGE,
  browserCaptionLanguage,
  getSpeechRecognitionConstructor,
  readSpeechResult,
  SpeechRecognitionInstance,
  SPEECH_LANGUAGE_OPTIONS,
} from "@/lib/speechRecognition";
import { MeetingType } from "@/lib/types";
import { startRoomRecording } from "@/lib/room-recorder";
import { PRIVATE_RECORDING_PREFIX } from "@/lib/recording-path";
import { containerOf, extensionFor } from "@/lib/recording-format";
import { withCallTimeout } from "@/lib/call-timeout";
import { beginCallExit } from "@/lib/call-exit";
import { useWakeLock } from "@/lib/use-wake-lock";
import { LatestRequests } from "@/lib/latest-requests";
import { callDeviceError, setCallDevice } from "@/lib/call-media";
import { appendChat, CHAT_TOPIC, parseChatPacket, type ChatDraft, type ChatMessage } from "@/lib/meeting-chat";
import { nextActiveSpeaker, NO_SPEAKER } from "@/lib/active-speaker";
import { shouldListen } from "@/lib/captions-listening";
import { isWorthSaving, nothingSavedReason, secondsSince } from "@/lib/meeting-worth-saving";
import { withTrack } from "@/lib/video-attach";
import { MAX_CLIP_BYTES, MAX_RECORDING_CLIPS, uploadedClipUrls, type RecordingClip } from "@/lib/recording-limits";
import { canListenToMicrophone, listenToMicrophone, type MicrophoneListener } from "@/lib/server-captions";
import { interimTranslationDue, needsTranslation } from "@/lib/caption-translation";
import { backfillBatches } from "@/lib/translation-batch";
import { passNeedsRenewing } from "@/lib/call-pass";
import { tidyCaption } from "@/lib/caption-text";
import { captionEngineFor } from "@/lib/caption-engine";
import { camerasToTakeIn } from "@/lib/large-call";
import { languageToSwitchTo, shouldDetectLanguage } from "@/lib/language-detection";
import { NO_FOOTING, nextFooting, readRegister } from "@/lib/register";
import type { Register } from "@/lib/register-guide";

/** Batches of the meeting so far being translated at once, beside the live lines. */
const BACKFILL_AT_ONCE = 2;
/** Tries at a batch before its lines are left in the original language. */
const BACKFILL_TRIES = 3;
/** This much speech with no words from the browser's recognition, and it isn't working. */
const SPEECH_WITHOUT_WORDS_MS = 8000;
/** How long closing the call waits for the last sentence to be written down. */
const LAST_WORDS_WAIT_MS = 10000;

interface Utterance {
  id: string;
  speakerId: string;
  speakerName: string;
  langCode: string;
  langLabel: string;
  text: string;
  ts: number;
}

interface PresenceInfo {
  name: string;
  langLabel: string;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
  recording?: boolean;
}

interface InterimCaption {
  speakerName: string;
  langLabel: string;
  text: string;
}

const PREVIEW_PARTICIPANTS: LiveRoomParticipant[] = [
  { id: "sofia", name: "Sofia Rossi", langLabel: "Spanish", cameraEnabled: true, micEnabled: true, imageUrl: "/avatars/maria.jpg" },
  { id: "maya", name: "Maya", langLabel: "English", isLocal: true, cameraEnabled: true, micEnabled: true, imageUrl: "/avatars/alex.jpg" },
  { id: "marco", name: "Marco Bianchi", langLabel: "German", cameraEnabled: true, micEnabled: true, imageUrl: "/avatars/mike.jpg" },
  { id: "hana", name: "Hana Tanaka", langLabel: "Japanese", cameraEnabled: true, micEnabled: false, imageUrl: "/avatars/wei.jpg" },
  { id: "james", name: "James Wilson", langLabel: "English", cameraEnabled: true, micEnabled: true, imageUrl: "/avatars/david.jpg" },
  { id: "camille", name: "Camille Dubois", langLabel: "French", cameraEnabled: true, micEnabled: true, imageUrl: "/avatars/sarah.jpg" },
];

const PREVIEW_CAPTIONS: LiveRoomCaption[] = [
  {
    id: "preview-caption-1",
    speakerId: "sofia",
    speakerName: "Sofia Rossi",
    langLabel: "Spanish",
    original: "El diseño estará listo mañana.",
    translated: "Il design sarà pronto domani.",
    time: "18:39",
  },
  {
    id: "preview-caption-2",
    speakerId: "marco",
    speakerName: "Marco Bianchi",
    langLabel: "German",
    original: "Können wir das Budget noch einmal prüfen?",
    translated: "Possiamo rivedere il budget ancora una volta?",
    time: "18:41",
  },
  {
    id: "preview-caption-3",
    speakerId: "camille",
    speakerName: "Camille Dubois",
    langLabel: "French",
    original: "Oui, commençons par le calendrier.",
    translated: "Sì, iniziamo dal calendario.",
    time: "18:42",
    live: true,
  },
];

function formatClock(totalSeconds: number) {
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  const core = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return totalSeconds < 0 ? `+${core}` : core;
}

// A remote participant's video and audio arrive as two separate
// TrackSubscribed events; retain both for independent playback and recording.

interface LiveSessionClientProps {
  sessionId: string;
  title: string;
  meetingType: MeetingType;
  initialStatus: "active" | "ended";
  scheduledDurationMinutes?: number | null;
  embedded?: boolean;
  shareUrl?: string;
  onClose?: () => void;
  initialLangCode?: string;
  // Set when the signed-in host opens their own meeting, so the join form can
  // be skipped entirely. Guests on the share link have no name yet.
  initialName?: string;
  // True when the signed-in host opens their own meeting, worked out on the
  // server, so the End button is right from the first moment.
  initialCanManage?: boolean;
  previewMode?: boolean;
}

export default function LiveSessionClient({
  sessionId,
  title,
  meetingType,
  initialStatus,
  scheduledDurationMinutes,
  embedded,
  shareUrl,
  onClose,
  initialLangCode,
  initialName,
  initialCanManage = false,
  previewMode = false,
}: LiveSessionClientProps) {
  const router = useRouter();
  const [linkCopied, setLinkCopied] = useState(false);

  const copyShareLink = async () => {
    const link = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const hasScheduledDuration = !!scheduledDurationMinutes && scheduledDurationMinutes > 0;

  const [joined, setJoined] = useState(previewMode);
  const [name, setName] = useState(previewMode ? "Maya" : initialName || "");
  const [langCode, setLangCode] = useState(initialLangCode || SPEECH_LANGUAGE_OPTIONS[0].code);
  const [captionLangCode, setCaptionLangCode] = useState(initialLangCode || SPEECH_LANGUAGE_OPTIONS[0].code);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const translationEnabledRef = useRef(false);
  const [durationMinutes] = useState(scheduledDurationMinutes || 60);
  const [ended, setEnded] = useState(initialStatus === "ended");

  const [participants, setParticipants] = useState<Record<string, PresenceInfo>>({});
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  // Lines translation was tried for and couldn't do: shown in the original,
  // rather than saying "Translating…" for ever.
  const [untranslated, setUntranslated] = useState<Record<string, true>>({});
  const [interimBySpeaker, setInterimBySpeaker] = useState<Record<string, InterimCaption>>({});
  const [interimTranslations, setInterimTranslations] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [finishError, setFinishError] = useState("");
  const [endPrompt, setEndPrompt] = useState(false);
  const [left, setLeft] = useState(false);
  const [callClosed, setCallClosed] = useState(false);
  const [exitMode, setExitMode] = useState<"leave" | "end">("leave");
  const [roomEnded, setRoomEnded] = useState(false);
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);
  const [clipCount, setClipCount] = useState(0);
  // At least one part of the recording reached storage with the meeting.
  const [recordingSaved, setRecordingSaved] = useState(false);
  const [finishStage, setFinishStage] = useState("");
  const finishBusyRef = useRef(false);
  const exitModeRef = useRef<"leave" | "end">("leave");
  const callClosedRef = useRef(false);
  const roomEndedRef = useRef(false);
  const recordingStopRef = useRef<Promise<void> | null>(null);
  const recordingBusyRef = useRef(false);
  const uploadPromiseRef = useRef<Promise<string | null> | null>(null);
  const [recordingWarning, setRecordingWarning] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [clientId] = useState(() => crypto.randomUUID());
  const [canManage, setCanManage] = useState(initialCanManage);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [recordingReady, setRecordingReady] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  // Consent is asked for here, at the moment recording would actually start,
  // rather than on the setup screen before the meeting even exists.
  const [consentPromptOpen, setConsentPromptOpen] = useState(false);
  const [consentTicked, setConsentTicked] = useState(false);
  const [videoElapsed, setVideoElapsed] = useState(previewMode ? 18 * 60 + 42 : 0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  // Kept apart from the camera. Both arrive as video tracks from the same
  // person, and a <video> element plays only the first one it is given — so
  // merging them meant a shared screen was never the one you saw.
  const [screenShares, setScreenShares] = useState<Record<string, MediaStream>>({});
  // Who the big tile shows. LiveKit works this out from how loud each person
  // is, so it follows the conversation even with captions switched off.
  const [activeSpeaker, setActiveSpeaker] = useState(NO_SPEAKER);
  // Read when choosing which cameras to take in, outside of rendering.
  const activeSpeakerIdRef = useRef<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const deviceBusyRef = useRef(false);
  const [sharedNotes, setSharedNotes] = useState<LiveRoomNotes>(
    previewMode
      ? {
          discussionPoints: ["Delivery timeline", "Scope of phase 2", "Budget review", "Next steps"],
          nextSteps: [
            { id: "preview-step-1", text: "Maya to send updated plan", done: false },
            { id: "preview-step-2", text: "Camille to review by Wednesday", done: false },
            { id: "preview-step-3", text: "Next call scheduled for next week", done: false },
          ],
        }
      : { discussionPoints: [], nextSteps: [] }
  );

  const channelRef = useRef<RealtimeChannel | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const capturedTracksRef = useRef<LocalTrack[]>([]);
  const trackListenersRef = useRef(new Map<LocalTrack, () => void>());
  const mediaGenerationRef = useRef(0);
  // Bumped whenever recording is stopped. A part that was still starting when
  // Stop was pressed sees the change and throws itself away, so a hand-over
  // between parts can never carry recording on past the host's Stop.
  const recordingRunRef = useRef(0);
  // The next part while it is still starting up. Starting takes a moment (the
  // audio has to wake), and the part before it can finish in that moment; it
  // waits for this so it doesn't switch the recording light off in between.
  const clipHandoverRef = useRef<Promise<void> | null>(null);
  const roomRecorderRef = useRef<Awaited<ReturnType<typeof startRoomRecording>> | null>(null);
  const uploadedRecordingRef = useRef<string | null>(null);
  const savedMeetingRef = useRef<string | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);
  const recordingClipsRef = useRef<RecordingClip[]>([]);
  // One upload per part, shared by whoever asks first, so a part finished
  // mid-call and the save at the end never upload the same file twice.
  const clipUploadsRef = useRef(new Map<RecordingClip, Promise<string>>());
  const clipSequenceRef = useRef(0);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recordingActiveRef = useRef(false);
  // Captions come from the browser's own speech recognition where it works,
  // and from MemoValet's transcription of this call's microphone where it
  // doesn't (see lib/speech-segments). Once switched, it stays switched.
  const captionEngineRef = useRef<"browser" | "memovalet">("browser");
  const [captionEngine, setCaptionEngine] = useState<"browser" | "memovalet">("browser");
  // The microphone listener: transcribing, or watching that the browser's
  // recognition actually hears the speech it should.
  const microphoneListenerRef = useRef<MicrophoneListener | null>(null);
  // Speech heard since the browser's recognition last produced anything.
  const heardWithoutWordsRef = useRef(0);
  // Set once someone picks their language by hand. Until then MemoValet works
  // out what is being spoken and the picker follows along.
  const languagePinnedRef = useRef(Boolean(initialLangCode));
  const languageDetectedRef = useRef(false);
  // Whether anything at all has been captured this call.
  const heardAnythingRef = useRef(false);
  // The browser's own recognition has already failed or heard nothing here, so
  // captions stay with MemoValet even if translation is switched off again.
  const browserCaptionsFailedRef = useRef(false);

  /** The browser's own recognition, or MemoValet's (see lib/caption-engine). */
  const engineToUse = (): "browser" | "memovalet" =>
    captionEngineFor({
      browserRecognition: Boolean(getSpeechRecognitionConstructor()),
      browserFailed: browserCaptionsFailedRef.current,
      translationOn: translationEnabledRef.current,
      canListen: Boolean(callMicrophone()) && canListenToMicrophone(),
    });
  // Breadcrumbs raised before the call's pass arrived.
  const pendingCaptionEventsRef = useRef<Array<{ event: string; detail: string }>>([]);
  // The last words still being written down as the call closes.
  const lastWordsRef = useRef<Promise<void> | null>(null);
  // The call's pass, which is also what lets this device's speech be transcribed.
  const livekitTokenRef = useRef<string | null>(null);
  // The same pass, for the parts of the room that render with it (GIF search).
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [captionNotice, setCaptionNotice] = useState("");

  // The call recorder runs in this tab; if the device sleeps, it stops.
  const wakeWarning = useWakeLock(isRecordingVideo || isRecording);

  const langCodeRef = useRef(langCode);
  const captionLangCodeRef = useRef(captionLangCode);
  const translationGenerationRef = useRef(0);
  const [translationRequests] = useState(() => new LatestRequests());
  const nameRef = useRef(name);
  const utterancesRef = useRef<Utterance[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const interimDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const interimRequestIdRef = useRef<Record<string, number>>({});
  const interimLastFiredRef = useRef<Record<string, number>>({});
  const livekitRoomRef = useRef<Room | null>(null);
  const sharedNotesRef = useRef(sharedNotes);

  useEffect(() => {
    activeSpeakerIdRef.current = activeSpeaker.id;
  }, [activeSpeaker]);

  useEffect(() => {
    langCodeRef.current = langCode;
  }, [langCode]);

  // Nobody should have to find their own language in a list before captions
  // are any use, so both start from the device's own language. Only until
  // either is chosen: after that the choice stands.
  const languagesChosenRef = useRef(Boolean(initialLangCode));
  const pickDeviceLanguages = useEffectEvent(() => {
    const fromDevice = browserCaptionLanguage(navigator.languages ?? [navigator.language]);
    if (!fromDevice || languagesChosenRef.current) return;
    languagesChosenRef.current = true;
    langCodeRef.current = fromDevice;
    captionLangCodeRef.current = fromDevice;
    setLangCode(fromDevice);
    setCaptionLangCode(fromDevice);
  });
  useEffect(() => {
    if (languagesChosenRef.current || previewMode) return;
    const timer = setTimeout(() => pickDeviceLanguages(), 0);
    return () => clearTimeout(timer);
  }, [previewMode]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    utterancesRef.current = utterances;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [utterances]);

  useEffect(() => {
    sharedNotesRef.current = sharedNotes;
  }, [sharedNotes]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!savedMeetingRef.current && (roomRecorderRef.current || videoBlobRef.current || utterancesRef.current.length)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
    if (!previewMode) fetch(`/api/live/${sessionId}`).then(response => response.json()).then(data => { if (typeof data?.canManage === "boolean") setCanManage(data.canManage); }).catch(() => {});
  }, [sessionId, previewMode]);

  useEffect(() => {
    if (!joined || ended) return;
    if (sessionStartRef.current === null) sessionStartRef.current = Date.now();
    const totalSeconds = durationMinutes * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - (sessionStartRef.current as number)) / 1000);
      setRemainingSeconds(totalSeconds - elapsed);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [joined, ended, durationMinutes]);

  const recordingSupported =
    typeof window !== "undefined" && (!!getSpeechRecognitionConstructor() || canListenToMicrophone());
  const videoSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  function formatElapsed(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const watchLocalTrack = (track: LocalTrack) => {
    if (trackListenersRef.current.has(track)) return;
    const sync = () => {
      // Only what is still live: a camera that ended — unplugged, taken by
      // another app, dropped by the OS — would otherwise stay in the stream and
      // show as a black rectangle.
      const stream = new MediaStream(
        capturedTracksRef.current
          .map(item => item.mediaStreamTrack)
          .filter(track => track.readyState === "live")
      );
      videoStreamRef.current = stream;
      setLocalStream(stream);
      const active = (kind: string) => capturedTracksRef.current.some(item =>
        item.kind === kind && !item.isMuted && item.mediaStreamTrack.readyState === "live" && item.mediaStreamTrack.enabled);
      setCameraEnabled(active("video"));
      setMicEnabled(active("audio"));
    };
    trackListenersRef.current.set(track, sync);
    for (const event of [TrackEvent.Restarted, TrackEvent.Muted, TrackEvent.Unmuted, TrackEvent.Ended] as const) track.on(event, sync);
  };

  const releaseLocalTracks = () => {
    for (const [track, listener] of trackListenersRef.current) {
      for (const event of [TrackEvent.Restarted, TrackEvent.Muted, TrackEvent.Unmuted, TrackEvent.Ended] as const) track.off(event, listener);
    }
    trackListenersRef.current.clear();
    capturedTracksRef.current.forEach(track => track.stop());
    capturedTracksRef.current = [];
    videoStreamRef.current?.getTracks().forEach(track => track.stop());
    videoStreamRef.current = null;
  };

  const startVideoCapture = async (generation: number) => {
    setVideoError("");

    try {
      const tracks = await createLocalTracks({ video: true, audio: true });
      if (generation !== mediaGenerationRef.current) {
        tracks.forEach(track => track.stop());
        return;
      }
      capturedTracksRef.current = tracks;
      tracks.forEach(watchLocalTrack);
      const stream = new MediaStream(tracks.map(track => track.mediaStreamTrack));
      videoStreamRef.current = stream;
      setLocalStream(stream);
      setCameraEnabled(stream.getVideoTracks().some((track) => track.enabled));
      setMicEnabled(stream.getAudioTracks().some((track) => track.enabled));

    } catch (error) {
      if (generation !== mediaGenerationRef.current) return;
      setCameraEnabled(false);
      setMicEnabled(false);
      setVideoError(callDeviceError(error, "camera or microphone"));
    }
  };

  // MediaRecorder.stop() is async, the blob isn't ready until "stop" fires,
  // so callers that need the finished video (handleFinish) must await this
  // rather than reading videoBlobRef right after calling stop().
  const stopVideoCapture = async () => {
    recordingRunRef.current += 1;
    if (recordingStopRef.current) return recordingStopRef.current;
    const recorder = roomRecorderRef.current;
    if (!recorder) return;
    // Stop indicates capture is off immediately; finalizing must not lock Leave.
    setIsRecordingVideo(false);
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    recordingStopRef.current = (async () => {
      try {
        const result = await recorder.stop();
        videoBlobRef.current = result.blob;
        setRecordingReady(true);
        setRecordingWarning(result.warning || "");
      } finally {
        if (roomRecorderRef.current === recorder) roomRecorderRef.current = null;
        recordingStopRef.current = null;
      }
    })();
    return recordingStopRef.current;
  };

  // Stopping happens straight away; starting asks for consent first.
  const toggleRecording = async () => {
    if (!canManage || recordingBusyRef.current || callClosedRef.current) return;

    if (roomRecorderRef.current) {
      setRecordingBusy(true);
      recordingBusyRef.current = true;
      try { await stopVideoCapture(); setVideoError("Recording stopped. Finish and save to keep it in history."); }
      catch (error) { setVideoError(error instanceof Error ? error.message : "Couldn't stop the recording."); }
      finally { recordingBusyRef.current = false; setRecordingBusy(false); }
      return;
    }

    if (recordingClipsRef.current.length >= MAX_RECORDING_CLIPS) { setVideoError("This recording has reached its length limit. Finish and save this meeting to keep it."); return; }
    const room = livekitRoomRef.current;
    if (!room || room.state !== "connected") { setVideoError("Connect to the call before recording."); return; }

    setConsentTicked(false);
    setConsentPromptOpen(true);
  };

  // Records one part of the call. A part stops by itself before it outgrows
  // what storage will accept, and the next one starts straight away — consent
  // was given for the recording, not for a single file — so a long meeting is
  // kept whole in pieces instead of failing to upload at the end.
  const startClip = async (): Promise<void> => {
    const room = livekitRoomRef.current;
    if (!room || room.state !== "connected") throw new Error("Connect to the call before recording.");
    if (recordingClipsRef.current.length >= MAX_RECORDING_CLIPS) {
      throw new Error("This recording has reached its length limit. Finish and save this meeting to keep it.");
    }
    const generation = mediaGenerationRef.current;
    const run = recordingRunRef.current;
    const order = clipSequenceRef.current++;
    const recorder = await startRoomRecording(room, rollIntoNextClip, MAX_CLIP_BYTES);
    if (generation !== mediaGenerationRef.current || run !== recordingRunRef.current || callClosedRef.current) {
      recorder.dispose();
      return;
    }
    roomRecorderRef.current = recorder;
    void recorder.finished.then(result => {
      const clip: RecordingClip = { blob: result.blob, order };
      recordingClipsRef.current.push(clip);
      setClipCount(recordingClipsRef.current.length);
      videoBlobRef.current = result.blob;
      setRecordingReady(true);
      setRecordingWarning(result.warning || "");
      // Into storage now, while the call carries on, rather than all at once
      // when it ends. A failure here is retried when the meeting is saved.
      void uploadClip(clip).catch(() => {});
    }).catch(error => {
      console.warn("[call-recording] finalization_failed");
      setRecordingWarning(error instanceof Error ? error.message : "Recording could not be finalized.");
      setVideoError(error instanceof Error ? error.message : "Recording could not be finalized.");
    }).finally(async () => {
      // Only the part still running speaks for the recording. After a roll-over
      // the finished part must not switch the recording light off — everyone
      // on the call has to be able to see it is still recording.
      const handover = clipHandoverRef.current;
      if (handover) await handover.catch(() => {});
      if (roomRecorderRef.current !== recorder) return;
      roomRecorderRef.current = null;
      setIsRecordingVideo(false);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    });
  };

  // A part filled up. It has already stopped itself; carry on in a new one.
  const rollIntoNextClip = () => {
    if (callClosedRef.current) return;
    if (recordingClipsRef.current.length + 1 >= MAX_RECORDING_CLIPS) {
      setVideoError("This recording has reached its length limit. Finish and save this meeting to keep it.");
      return;
    }
    const next = startClip();
    clipHandoverRef.current = next;
    void next.catch(error => {
      setVideoError(error instanceof Error ? error.message : "The recording couldn't continue. What was recorded so far is kept.");
    }).finally(() => {
      if (clipHandoverRef.current === next) clipHandoverRef.current = null;
    });
  };

  const startRecordingWithConsent = async () => {
    if (!consentTicked || recordingBusyRef.current || callClosedRef.current) return;
    recordingBusyRef.current = true;
    setConsentPromptOpen(false);
    setRecordingBusy(true);
    try {
      await startClip();
      if (!roomRecorderRef.current) return;
      setIsRecordingVideo(true);
      setVideoError("");
      setVideoElapsed(0);
      videoTimerRef.current = setInterval(() => setVideoElapsed(previous => previous + 1), 1000);
    } catch (error) { setVideoError(error instanceof Error ? error.message : "Couldn't record this call."); }
    finally { recordingBusyRef.current = false; setRecordingBusy(false); }
  };

  const toggleScreenSharing = async () => {
    try {
      const room = livekitRoomRef.current;
      if (!room) throw new Error("Connect to the call first.");
      await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled, { audio: true });
      setScreenSharing(room.localParticipant.isScreenShareEnabled);
    } catch { setVideoError("Screen sharing wasn't started. You can try again."); }
  };

  // Puts one finished part into storage and remembers where. Asked twice — once
  // when the part finishes mid-call, again when the meeting is saved — it
  // uploads once. A failure is forgotten so the next ask can try again.
  const uploadClip = (clip: RecordingClip): Promise<string> => {
    if (clip.url) return Promise.resolve(clip.url);
    const running = clipUploadsRef.current.get(clip);
    if (running) return running;
    const upload = (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again before saving your recording.");
      const extension = extensionFor(clip.blob.type);
      if (!extension) throw new Error("This browser recorded in a format we can't store. Try desktop Chrome or Edge.");

      const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("meeting-recordings").upload(storagePath, clip.blob, {
        // The bucket allows "video/webm", not "video/webm;codecs=…". The recorder
        // already builds the file without the suffix; this keeps it that way if
        // that ever changes, the same as the meeting-page recorder does.
        contentType: containerOf(clip.blob.type),
      });
      if (error) {
        console.error(error);
        throw new Error("Part of the recording didn't upload.");
      }
      clip.url = PRIVATE_RECORDING_PREFIX + storagePath;
      return clip.url;
    })();
    clipUploadsRef.current.set(clip, upload);
    upload.catch(() => clipUploadsRef.current.delete(clip));
    return upload;
  };

  // Everything recorded, in storage — as far as it will go. Never throws: a
  // part that won't upload is left out and kept as a download on this page,
  // and the meeting is saved with the rest. Losing the whole meeting over one
  // part of its recording is the failure this exists to prevent.
  const uploadRecordedVideo = async (): Promise<string | null> => {
    await Promise.allSettled(recordingClipsRef.current.map(uploadClip));
    const urls = uploadedClipUrls(recordingClipsRef.current);
    uploadedRecordingRef.current = urls[0] ?? null;
    return uploadedRecordingRef.current;
  };

  const myLangLabel = SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === captionLangCode)?.label || "English";
  const spokenLangLabel = SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === langCode)?.label || "English";
  const currentLangLabel = () =>
    SPEECH_LANGUAGE_OPTIONS.find((option) => option.code === captionLangCodeRef.current)?.label ||
    "English";

  const translateForMe = async (utterance: Utterance) => {
    const generation = translationGenerationRef.current;
    const targetLanguage = currentLangLabel();
    if (!needsTranslation({
      enabled: translationEnabledRef.current,
      spokenLanguage: utterance.langLabel,
      readingLanguage: targetLanguage,
    })) return;
    // Hold on to what was already being read while this sentence was spoken,
    // so the line doesn't flick back to the original language for the second
    // or two its own translation takes.
    const live = liveTranslationRef.current[utterance.speakerId];
    if (live) {
      delete liveTranslationRef.current[utterance.speakerId];
      setTranslations((prev) => (prev[utterance.id] ? prev : { ...prev, [utterance.id]: live }));
    }
    const request = translationRequests.begin(`final:${utterance.id}`);
    try {
      const response = await fetch("/api/translate-chunk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(livekitTokenRef.current ? { Authorization: `Bearer ${livekitTokenRef.current}` } : {}),
        },
        body: JSON.stringify({
          text: utterance.text, targetLanguage, sessionId,
          sourceLanguage: utterance.langLabel,
          register: footingFor(utterance.speakerId, utterance.text, utterance.langLabel),
        }),
        signal: request.signal,
      });
      const data = await response.json();
      if (!request.isCurrent() || generation !== translationGenerationRef.current) return;
      if (!response.ok) {
        setUntranslated((prev) => ({ ...prev, [utterance.id]: true }));
        setError(
          data?.error ||
            "Live translation is temporarily unavailable. Original captions will continue."
        );
        return;
      }
      if (typeof data.translation === "string" && data.translation.trim()) {
        setTranslations((prev) => ({ ...prev, [utterance.id]: data.translation }));
      }
    } catch {
      if (request.isCurrent() && generation === translationGenerationRef.current) {
        setUntranslated((prev) => ({ ...prev, [utterance.id]: true }));
        setError("Live translation is temporarily unavailable. Original captions will continue.");
      }
    } finally {
      request.finish();
    }
  };

  /**
   * One batch of what was said before translation was on (or before the
   * language changed). A busy translator is given a moment and asked again;
   * lines it still can't do stay in the original rather than "Translating…".
   */
  const translateBatch = async (batch: Utterance[], targetLanguage: string, generation: number) => {
    for (let attempt = 1; attempt <= BACKFILL_TRIES; attempt += 1) {
      if (generation !== translationGenerationRef.current) return;
      const request = translationRequests.begin(`batch:${batch[0].id}`, 60000);
      try {
        const response = await fetch("/api/translate-chunk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(livekitTokenRef.current ? { Authorization: `Bearer ${livekitTokenRef.current}` } : {}),
          },
          body: JSON.stringify({
            sessionId,
            targetLanguage,
            lines: batch.map((utterance) => ({
              text: utterance.text,
              sourceLanguage: utterance.langLabel,
              register: footingRef.current[utterance.speakerId]?.register ?? null,
            })),
          }),
          signal: request.signal,
        });
        const data = await response.json().catch(() => null);
        if (!request.isCurrent() || generation !== translationGenerationRef.current) return;
        if (response.ok) {
          const done: Record<string, string> = {};
          const missed: Record<string, true> = {};
          batch.forEach((utterance, index) => {
            const translated = Array.isArray(data?.translations) ? data.translations[index] : null;
            if (typeof translated === "string" && translated.trim()) done[utterance.id] = translated;
            else missed[utterance.id] = true;
          });
          // A line translated live in the meantime keeps that translation.
          setTranslations((prev) => ({ ...done, ...prev }));
          if (Object.keys(missed).length) setUntranslated((prev) => ({ ...prev, ...missed }));
          return;
        }
        if (response.status !== 429 && response.status < 500) break;
      } catch {
        // Cancelled because translation moved on: nothing more to do.
        if (!request.isCurrent() || generation !== translationGenerationRef.current) return;
      } finally {
        request.finish();
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
    if (generation !== translationGenerationRef.current) return;
    setUntranslated((prev) => ({ ...prev, ...Object.fromEntries(batch.map((utterance) => [utterance.id, true as const])) }));
  };

  /**
   * Everything said so far, into the language being read — the whole meeting,
   * however long, not only the last few lines. Newest first, since that is
   * what is on screen; see lib/translation-batch.
   */
  const translateMeetingSoFar = async () => {
    const generation = translationGenerationRef.current;
    const targetLanguage = currentLangLabel();
    const waiting = utterancesRef.current.filter((utterance) =>
      needsTranslation({
        enabled: translationEnabledRef.current,
        spokenLanguage: utterance.langLabel,
        readingLanguage: targetLanguage,
      })
    );
    const batches = backfillBatches(waiting);
    let next = 0;
    const work = async () => {
      while (next < batches.length && generation === translationGenerationRef.current) {
        const batch = batches[next];
        next += 1;
        await translateBatch(batch, targetLanguage, generation);
      }
    };
    await Promise.all(Array.from({ length: BACKFILL_AT_ONCE }, work));
  };

  // What was last sent for each speaker, so an unchanged sentence isn't
  // translated over and over.
  const interimSentRef = useRef<Record<string, string>>({});
  const interimLatestRef = useRef<Record<string, string>>({});
  // The last live translation seen for each speaker, kept so a finished
  // sentence doesn't drop back to the original language while its own
  // translation is on the way.
  const liveTranslationRef = useRef<Record<string, string>>({});
  // How each person is being taken — formal or casual — across the whole call.
  // People don't switch between tu and vous mid-meeting, and a translation
  // that does reads as a stranger walking in (see lib/register).
  const footingRef = useRef<Record<string, typeof NO_FOOTING>>({});

  const footingFor = (speakerId: string, text: string, language: string): Register | null => {
    const heard = readRegister(text, language).register;
    const footing = nextFooting(footingRef.current[speakerId] ?? NO_FOOTING, heard);
    footingRef.current[speakerId] = footing;
    return footing.register;
  };

  /**
   * Keeps the live half of the panel moving while someone talks — including
   * yourself, whose words used to wait for a full stop and then arrive in one
   * lump. Paced by interimTranslationDue so it stays live without a request a
   * second per speaker.
   */
  const scheduleInterimTranslation = (speakerId: string, text: string, langLabel: string) => {
    if (!needsTranslation({
      enabled: translationEnabledRef.current,
      spokenLanguage: langLabel,
      readingLanguage: currentLangLabel(),
    })) return;
    interimLatestRef.current[speakerId] = text;
    const send = () => {
      const latest = interimLatestRef.current[speakerId];
      if (!latest) return;
      interimSentRef.current[speakerId] = latest;
      void translateInterimForMe(speakerId, latest, langLabel);
    };
    if (interimDebounceRef.current[speakerId]) clearTimeout(interimDebounceRef.current[speakerId]);
    const due = interimTranslationDue({
      text,
      lastSentText: interimSentRef.current[speakerId] || "",
      lastSentAt: interimLastFiredRef.current[speakerId] || 0,
      // eslint-disable-next-line react-hooks/purity -- speech callbacks, never render.
      now: Date.now(),
    });
    if (due) send();
    // Not yet: try again shortly, in case they stop talking there.
    else interimDebounceRef.current[speakerId] = setTimeout(send, 600);
  };

  const translateInterimForMe = async (speakerId: string, text: string, spokenLanguage?: string) => {
    if (!translationEnabledRef.current) return;
    const generation = translationGenerationRef.current;
    const targetLanguage = currentLangLabel();
    // Tags this call with a sequence number so a slower, older request can't
    // clobber a newer one if responses arrive out of order.
    const requestId = (interimRequestIdRef.current[speakerId] || 0) + 1;
    interimRequestIdRef.current[speakerId] = requestId;
    // eslint-disable-next-line react-hooks/purity -- Only called by realtime/debounce callbacks, never during render.
    interimLastFiredRef.current[speakerId] = Date.now();
    const request = translationRequests.begin(`interim:${speakerId}`);
    try {
      const response = await fetch("/api/translate-chunk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(livekitTokenRef.current ? { Authorization: `Bearer ${livekitTokenRef.current}` } : {}),
        },
        body: JSON.stringify({
          text, targetLanguage, sessionId,
          sourceLanguage: spokenLanguage ?? null,
          // Half a sentence rarely shows formality; the call's footing carries it.
          register: spokenLanguage ? footingRef.current[speakerId]?.register ?? null : null,
        }),
        signal: request.signal,
      });
      const data = await response.json();
      if (!request.isCurrent() || generation !== translationGenerationRef.current) return;
      if (!response.ok) {
        setError(
          data?.error ||
            "Live translation is temporarily unavailable. Original captions will continue."
        );
        return;
      }
      if (typeof data.translation === "string" && data.translation.trim() && interimRequestIdRef.current[speakerId] === requestId) {
        liveTranslationRef.current[speakerId] = data.translation;
        setInterimTranslations((prev) => ({ ...prev, [speakerId]: data.translation }));
      }
    } catch {
      if (request.isCurrent() && generation === translationGenerationRef.current)
        setError("Live translation is temporarily unavailable. Original captions will continue.");
    } finally {
      request.finish();
    }
  };

  // Video/audio transport: LiveKit (an SFU) instead of a hand-rolled WebRTC
  // mesh. Each participant publishes one stream to LiveKit and subscribes to
  // everyone else's through it, rather than opening a direct connection to
  // every other participant — the mesh approach falls over past ~5-6 people
  // since each client would have to upload its own video that many times
  // simultaneously. Supabase Realtime still carries everything unrelated to
  // media (transcript, translations, shared notes, presence metadata).
  const connectLiveKit = async (sessionIdToJoin: string, generation: number) => {
    try {
      const res = await fetch(`/api/live/${sessionIdToJoin}/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameRef.current, identity: clientId }),
      });
      const data = await res.json();
      if (generation !== mediaGenerationRef.current) return;
      if (!res.ok || !data.token) {
        setVideoError(data.error || "Couldn't connect video for this meeting.");
        return;
      }
      takeCallPass(data.token);

      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!livekitUrl) {
        setVideoError("Video isn't configured for this meeting yet.");
        return;
      }

      const room = new Room({
        // Stop sending picture nobody is watching. Costs nothing in a small
        // call; in a big one it saves everyone's upload.
        dynacast: true,
      });
      livekitRoomRef.current = room;

      /**
       * In a big call, take in only the cameras on screen (see lib/large-call):
       * fifty video streams arriving at once is what actually breaks a large
       * meeting, and it breaks it in the browser, not on the server. Everyone
       * is still heard — audio is never dropped.
       */
      const chooseCameras = () => {
        const current = livekitRoomRef.current;
        if (current !== room) return;
        const others = [...room.remoteParticipants.values()];
        const wanted = camerasToTakeIn({
          others: others.map((person) => person.identity),
          activeSpeaker: activeSpeakerIdRef.current,
          peopleInCall: others.length + 1,
        });
        for (const person of others) {
          for (const publication of person.videoTrackPublications.values()) {
            // A shared screen is the point of the call when it is on.
            if (publication.source === Track.Source.ScreenShare) continue;
            const take = !wanted || wanted.has(person.identity);
            if (publication.isSubscribed !== take) publication.setSubscribed(take);
          }
        }
      };
      room.on(RoomEvent.ParticipantConnected, chooseCameras);
      room.on(RoomEvent.ParticipantDisconnected, chooseCameras);
      room.on(RoomEvent.TrackPublished, chooseCameras);
      room.on(RoomEvent.DataReceived, (bytes, sender, _kind, topic) => {
        if (topic !== CHAT_TOPIC || !sender) return;
        const message = parseChatPacket(bytes, sender.identity, sender.name || "Guest");
        if (message) setChatMessages(current => appendChat(current, message));
      });

      // The host can switch your microphone off from their side. Follow what
      // LiveKit says about our own track, so the mic button never claims to be
      // on while the room hears nothing.
      const syncLocalMic = (publication: { source: Track.Source; isMuted: boolean }, participant: { isLocal: boolean }) => {
        if (!participant.isLocal || publication.source !== Track.Source.Microphone) return;
        setMicEnabled(!publication.isMuted);
      };
      room.on(RoomEvent.TrackMuted, syncLocalMic);
      room.on(RoomEvent.TrackUnmuted, syncLocalMic);

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // Whoever is speaking is always worth seeing, even in a big call.
        setTimeout(chooseCameras, 0);
        setActiveSpeaker((current) =>
          nextActiveSpeaker(current, speakers.map((speaker) => speaker.identity), {
            selfId: clientId,
            now: Date.now(),
          })
        );
      });

      const isScreen = (publication: { source: Track.Source }) =>
        publication.source === Track.Source.ScreenShare ||
        publication.source === Track.Source.ScreenShareAudio;

      const addTrack = (
        set: typeof setRemoteStreams,
        identity: string,
        mediaTrack: MediaStreamTrack
      ) =>
        set((current) => ({ ...current, [identity]: withTrack(current[identity], mediaTrack) }));

      const dropTrack = (set: typeof setRemoteStreams, identity: string, mediaTrack: MediaStreamTrack) =>
        set((current) => {
          const existing = current[identity];
          if (!existing) return current;
          existing.removeTrack(mediaTrack);
          if (existing.getTracks().length > 0) return { ...current };
          const next = { ...current };
          delete next[identity];
          return next;
        });

      const forget = (set: typeof setRemoteStreams, identity: string) =>
        set((current) => {
          if (!current[identity]) return current;
          const next = { ...current };
          delete next[identity];
          return next;
        });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind !== "video" && track.kind !== "audio") return;
        // A shared screen carries its own audio, so both halves go to the same
        // stream and the screen's own player handles them together.
        const set = isScreen(publication) ? setScreenShares : setRemoteStreams;
        addTrack(set, participant.identity, track.mediaStreamTrack);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        dropTrack(isScreen(publication) ? setScreenShares : setRemoteStreams, participant.identity, track.mediaStreamTrack);
      });
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        forget(setRemoteStreams, participant.identity);
        forget(setScreenShares, participant.identity);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (callClosedRef.current) return;
        setScreenSharing(false);
        setVideoError((prev) => prev || "Video disconnected. Captions will still be recorded.");
      });
      const syncScreenSharing = () => setScreenSharing(room.localParticipant.isScreenShareEnabled);
      room.on(RoomEvent.LocalTrackPublished, publication => {
        const track = publication.track;
        if (!track || (publication.source !== Track.Source.Camera && publication.source !== Track.Source.Microphone)) return;
        if (generation !== mediaGenerationRef.current) { track.stop(); return; }
        if (!capturedTracksRef.current.includes(track)) capturedTracksRef.current.push(track);
        watchLocalTrack(track);
      });
      room.on(RoomEvent.LocalTrackPublished, syncScreenSharing);
      room.on(RoomEvent.LocalTrackUnpublished, syncScreenSharing);

      // Your own shared screen, so you can see what the room is being shown.
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        const mediaTrack = publication.track?.mediaStreamTrack;
        if (mediaTrack && isScreen(publication)) addTrack(setScreenShares, clientId, mediaTrack);
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        const mediaTrack = publication.track?.mediaStreamTrack;
        if (mediaTrack && isScreen(publication)) dropTrack(setScreenShares, clientId, mediaTrack);
      });

      await room.connect(livekitUrl, data.token);
      if (generation !== mediaGenerationRef.current) {
        await room.disconnect();
        return;
      }

      if (capturedTracksRef.current.length) {
        for (const track of capturedTracksRef.current) {
          if (generation !== mediaGenerationRef.current) break;
          await room.localParticipant.publishTrack(track, {
            source: track.kind === "video" ? Track.Source.Camera : Track.Source.Microphone,
          });
        }
      }
    } catch (connectError) {
      if (generation !== mediaGenerationRef.current) return;
      console.error("LiveKit connect failed", connectError);
      setVideoError("Couldn't connect video for this meeting. Captions will still be recorded.");
    }
  };

  /** Posts one breadcrumb. Declared here because taking the call's pass drains the queue. */
  const postCaptionEvent = (event: string, detail: string, token: string) => {
    void fetch(`/api/live/${sessionId}/caption-event`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event, detail }),
      keepalive: true,
    }).catch(() => {});
  };

  /** The call's pass has arrived: anything captions raised before now can go. */
  const takeCallPass = (token: string) => {
    livekitTokenRef.current = token;
    setLivekitToken(token);
    const waiting = pendingCaptionEventsRef.current;
    pendingCaptionEventsRef.current = [];
    for (const item of waiting) postCaptionEvent(item.event, item.detail, token);
  };

  // A meeting longer than the call's pass gets a fresh one in good time, so
  // captions and translation keep working however long it runs (see
  // lib/call-pass). Checked every few minutes, which also retries a miss.
  const renewCallPass = useEffectEvent(async (now: number) => {
    if (previewMode || !passNeedsRenewing(livekitTokenRef.current, now)) return;
    try {
      const response = await fetch(`/api/live/${sessionId}/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameRef.current, identity: clientId }),
      });
      const data = await response.json();
      if (response.ok && typeof data.token === "string") takeCallPass(data.token);
    } catch { /* Tried again at the next check. */ }
  });
  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(() => void renewCallPass(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [joined]);

  const disconnectLiveKit = () => {
    void livekitRoomRef.current?.disconnect().catch(() => { console.warn("[call-end] disconnect_failed"); });
    livekitRoomRef.current = null;
    setRemoteStreams({});
    setScreenShares({});
    setActiveSpeaker(NO_SPEAKER);
  };

  const handleJoin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;

    const generation = mediaGenerationRef.current;
    if (videoSupported) {
      await startVideoCapture(generation);
      if (generation !== mediaGenerationRef.current) return;
      void connectLiveKit(sessionId, generation);
    }

    const supabase = createClient();
    const channel = supabase.channel(`live-session-${sessionId}`, {
      config: { presence: { key: clientId } },
    });

    channel.on("broadcast", { event: "utterance" }, ({ payload }) => {
      const utterance = payload as Utterance;
      setUtterances((prev) =>
        prev.some((u) => u.id === utterance.id) ? prev : [...prev, utterance]
      );
      // Whoever said it. Your own words are translated too: the panel is set
      // to a language, and someone watching it expects to read that language,
      // not to have their own half of the conversation left in English.
      translateForMe(utterance);
    });

    channel.on("broadcast", { event: "interim" }, ({ payload }) => {
      const p = payload as {
        speakerId: string;
        speakerName: string;
        langLabel: string;
        text: string;
      };
      setInterimBySpeaker((prev) => {
        if (!p.text) {
          const next = { ...prev };
          delete next[p.speakerId];
          return next;
        }
        return {
          ...prev,
          [p.speakerId]: { speakerName: p.speakerName, langLabel: p.langLabel, text: p.text },
        };
      });

      if (!p.text) {
        translationRequests.cancel(`interim:${p.speakerId}`);
        setInterimTranslations((prev) => {
          const next = { ...prev };
          delete next[p.speakerId];
          return next;
        });
        if (interimDebounceRef.current[p.speakerId]) {
          clearTimeout(interimDebounceRef.current[p.speakerId]);
          delete interimDebounceRef.current[p.speakerId];
        }
        delete interimSentRef.current[p.speakerId];
        delete interimLatestRef.current[p.speakerId];
        return;
      }

      if (p.speakerId !== clientId) scheduleInterimTranslation(p.speakerId, p.text, p.langLabel);
    });

    channel.on("broadcast", { event: "shared-notes" }, ({ payload }) => {
      setSharedNotes(payload as LiveRoomNotes);
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceInfo>();
      const next: Record<string, PresenceInfo> = {};
      Object.entries(state).forEach(([key, presences]) => {
        if (presences[0]) next[key] = presences[0];
      });
      setParticipants(next);

      // Video membership is handled by LiveKit's own room events now — this
      // presence channel is only for the name/language metadata shown in the
      // UI, not for setting up media connections.
      const leaderId = [...Object.keys(next), clientId].sort()[0];
      if (leaderId === clientId) {
        void channel.send({
          type: "broadcast",
          event: "shared-notes",
          payload: sharedNotesRef.current,
        });
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          name: name.trim(),
          langLabel: spokenLangLabel,
          cameraEnabled,
          micEnabled,
        });
      }
    });

    channelRef.current = channel;
    setJoined(true);
  };

  // The host clicked "Start live meeting" a moment ago and we know who they
  // are, so join on their behalf rather than showing a form with their own
  // name already in it. The ref keeps this to one attempt.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current || joined || previewMode || !initialName) return;
    autoJoinedRef.current = true;
    void handleJoin();
  });

  useEffect(() => {
    const debounceTimers = interimDebounceRef.current;
    return () => {
      mediaGenerationRef.current += 1;
      autoJoinedRef.current = false;
      translationRequests.cancelAll();
      Object.values(debounceTimers).forEach(clearTimeout);
      recordingActiveRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* Already stopped. */ }
      channelRef.current?.unsubscribe();
      roomRecorderRef.current?.dispose();
      releaseLocalTracks();
      disconnectLiveKit();
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    };
  }, [translationRequests]);

  useEffect(() => {
    if (!joined || previewMode) return;
    channelRef.current?.track({
      name: nameRef.current.trim() || "Someone",
      langLabel: spokenLangLabel,
      cameraEnabled,
      micEnabled,
      recording: isRecordingVideo,
    });
  }, [cameraEnabled, joined, micEnabled, spokenLangLabel, previewMode, isRecordingVideo]);

  // Host only. The server checks that again — this just stops the button
  // appearing for people it would refuse.
  const muteForEveryone = async (identity: string) => {
    const response = await fetch(`/api/live/${sessionId}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity }),
    });
    if (!response.ok) throw new Error("Couldn't mute them");
  };

  const toggleDevice = async (kind: "audio" | "video") => {
    if (deviceBusyRef.current) return;
    const next = !(kind === "audio" ? micEnabled : cameraEnabled);
    if (previewMode) {
      if (kind === "audio") setMicEnabled(next);
      else setCameraEnabled(next);
      return;
    }
    const room = livekitRoomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      setVideoError("The call is not connected yet. Try the device control again once connected.");
      return;
    }
    deviceBusyRef.current = true;
    setDeviceBusy(true);
    try {
      if (kind === "audio" && !next) stopSpeaking();
      const stream = await setCallDevice(room.localParticipant, videoStreamRef.current, kind, next);
      if (livekitRoomRef.current !== room) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      if (room.state !== ConnectionState.Connected) return;
      videoStreamRef.current = stream;
      setLocalStream(stream);
      if (kind === "video") setCameraEnabled(next);
      else {
        setMicEnabled(next);
      }
      setVideoError("");
    } catch (error) {
      if (livekitRoomRef.current !== room) return;
      setVideoError(next ? callDeviceError(error, kind === "audio" ? "microphone" : "camera") : "Couldn't turn off the device. Try again.");
    } finally {
      deviceBusyRef.current = false;
      setDeviceBusy(false);
    }
  };

  const updateSharedNotes = (nextNotes: LiveRoomNotes) => {
    setSharedNotes(nextNotes);
    channelRef.current?.send({ type: "broadcast", event: "shared-notes", payload: nextNotes });
  };

  const sendChat = async (draft: ChatDraft) => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: crypto.randomUUID(), ...draft }));
    const message = parseChatPacket(bytes, clientId, nameRef.current.trim() || "You");
    if (!message) throw new Error("Invalid message");
    if (!previewMode) {
      const room = livekitRoomRef.current;
      if (!room || room.state !== ConnectionState.Connected) throw new Error("Call not connected");
      await room.localParticipant.publishData(bytes, { reliable: true, topic: CHAT_TOPIC });
    }
    setChatMessages(current => appendChat(current, message));
  };

  const changeCaptionLanguage = (code: string) => {
    translationRequests.cancelAll();
    Object.values(interimDebounceRef.current).forEach(clearTimeout);
    captionLangCodeRef.current = code;
    translationGenerationRef.current += 1;
    setCaptionLangCode(code);
    setTranslations({});
    setInterimTranslations({});
    setUntranslated({});
    // What has already been said is put into the new language too — all of
    // it. Without this, switching language part-way left everything above the
    // switch in the old one, which reads as translation simply not working.
    if (translationEnabledRef.current) void translateMeetingSoFar();
  };

  // Said out loud by the person: from here on it is their choice, not ours.
  const changeSpeakingLanguage = (code: string) => {
    reportCaptions("speaking-language-set", code);
    languagesChosenRef.current = true;
    languagePinnedRef.current = true;
    langCodeRef.current = code;
    setLangCode(code);
    setCaptionNotice("");
    if (recognitionRef.current) {
      recognitionRef.current.lang = code;
      recognitionRef.current.stop();
    }
  };

  // The microphone the call is actually using. Browser speech recognition
  // listens to the computer's default microphone instead, which is not always
  // the same one.
  const callMicrophone = () =>
    videoStreamRef.current?.getAudioTracks().find((track) => track.readyState === "live") ?? null;

  // One short piece of this person's speech, written down on our side, then
  // shared exactly like a caption from the browser.
  const transcribePiece = async (wav: Blob, startedAt: number) => {
    const token = livekitTokenRef.current;
    if (!token) return;
    // Unpinned means "work it out": no hint, and whatever is heard labels the
    // line and updates the picker.
    const code = languagePinnedRef.current ? langCodeRef.current : AUTO_LANGUAGE;
    const send = () =>
      fetch(`/api/live/${sessionId}/transcribe?lang=${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/wav" },
        body: wav,
        signal: AbortSignal.timeout(25000),
      }).catch(() => null);
    let response = await send();
    if (!response || response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      response = await send();
    }
    if (!response?.ok) {
      if (response?.status === 402) {
        const detail = await response.json().catch(() => null);
        setCaptionNotice(typeof detail?.error === "string" ? detail.error : "The host has no transcription minutes remaining. You can continue the call.");
      } else if (response?.status !== 410) setCaptionNotice("Some words may be missing from the transcript: transcription was busy for a moment.");
      return;
    }
    const data = (await response.json().catch(() => null)) as { text?: unknown; language?: unknown } | null;
    // Sound is getting through after all.
    setRecordingError("");
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) return;
    if (!heardAnythingRef.current) {
      heardAnythingRef.current = true;
      reportCaptions("first-words", "memovalet");
    }
    // What was actually spoken, when we could tell; otherwise what they chose.
    const heard = typeof data?.language === "string" ? data.language : "";
    const spokenLabel =
      heard ||
      SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === langCodeRef.current)?.label ||
      "English";
    // The picker follows what is actually being spoken, until someone sets it.
    const spokenCode = SPEECH_LANGUAGE_OPTIONS.find((o) => o.label === spokenLabel)?.code;
    if (heard && spokenCode && !languagePinnedRef.current && spokenCode !== langCodeRef.current) {
      languageDetectedRef.current = true;
      langCodeRef.current = spokenCode;
      setLangCode(spokenCode);
    }
    const utterance: Utterance = {
      id: crypto.randomUUID(),
      speakerId: clientId,
      speakerName: nameRef.current.trim() || "Someone",
      langCode: spokenCode || langCodeRef.current,
      langLabel: spokenLabel,
      text: tidyCaption(text),
      // When it was said, not when it came back, so the transcript keeps order.
      ts: startedAt,
    };
    // Straight into the ref as well: the call may be closing and about to read it.
    utterancesRef.current = [...utterancesRef.current, utterance];
    setUtterances((prev) => (prev.some((u) => u.id === utterance.id) ? prev : [...prev, utterance]));
    channelRef.current?.send({ type: "broadcast", event: "utterance", payload: utterance });
    // The channel never echoes our own messages back, so translate here.
    void translateForMe(utterance);
  };

  /**
   * A breadcrumb for what captions are doing, so a call where nothing was
   * captured can be looked into afterwards. One word from a fixed list; never
   * anything anybody said.
   */
  const reportCaptions = (event: string, detail = "") => {
    if (previewMode) return;
    const token = livekitTokenRef.current;
    if (!token) {
      // Captions start before the call's pass arrives, so the earliest
      // breadcrumbs — the ones that say why captions never started — were
      // being dropped. They wait here and go as soon as it lands.
      if (pendingCaptionEventsRef.current.length < 12) {
        pendingCaptionEventsRef.current.push({ event, detail });
      }
      return;
    }
    postCaptionEvent(event, detail, token);
  };

  /**
   * The language being spoken, worked out from a piece of real speech.
   *
   * The browser's own recognition has to be told a language and hears nothing
   * else, so a wrong guess produces nonsense or nothing at all. One short
   * sample sent to MemoValet's transcription at the start of a call settles
   * it, and captions carry on in whatever was actually spoken. Only the
   * language is taken from it: the words are already being captioned by the
   * browser, and are not repeated here.
   */
  const detectSpokenLanguage = async (wav: Blob, voicedMs: number) => {
    const token = livekitTokenRef.current;
    if (!shouldDetectLanguage({
      pinned: languagePinnedRef.current,
      alreadyDetected: languageDetectedRef.current,
      voicedMs,
      hasToken: Boolean(token),
    })) return;
    try {
      const response = await fetch(`/api/live/${sessionId}/transcribe?lang=${AUTO_LANGUAGE}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/wav" },
        body: wav,
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) return;
      const data = (await response.json().catch(() => null)) as { language?: unknown } | null;
      const heard = typeof data?.language === "string" ? data.language : "";
      const option = SPEECH_LANGUAGE_OPTIONS.find((item) => item.label === heard);
      languageDetectedRef.current = true;
      const switchTo = languageToSwitchTo({
        detected: option?.code ?? null,
        current: langCodeRef.current,
        pinned: languagePinnedRef.current,
      });
      if (!switchTo || !option) return;
      reportCaptions("language-detected", switchTo);
      langCodeRef.current = switchTo;
      setLangCode(switchTo);
      setCaptionNotice(`You're speaking ${option.label}, so captions have switched to it. Change it above if that's wrong.`);
      // Start hearing that language: the running recognition is tied to the old one.
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.lang = option.code;
        try { recognition.stop(); } catch { /* it restarts itself */ }
      }
    } catch {
      // No detection this time; captions carry on in the assumed language.
    }
  };

  const startMemoValetCaptions = () => {
    const track = callMicrophone();
    if (!track || !canListenToMicrophone()) {
      setRecordingError("Captions couldn't start: this call has no microphone to listen to.");
      setIsRecording(false);
      reportCaptions("no-microphone", track ? "no-audio-api" : "no-track");
      return false;
    }
    captionEngineRef.current = "memovalet";
    setCaptionEngine("memovalet");
    microphoneListenerRef.current?.stop();
    microphoneListenerRef.current = listenToMicrophone({
      track,
      mode: "transcribe",
      transcribe: transcribePiece,
      // Nothing at all coming through: say so, rather than looking like a room
      // where nobody spoke. A click on the page is usually all it takes.
      onSilentStart: () => {
        setRecordingError("Captions can't hear the microphone yet. Click anywhere in the call to start them.");
        reportCaptions("heard-nothing", "memovalet");
      },
    });
    recordingActiveRef.current = true;
    setRecordingError("");
    setIsRecording(true);
    reportCaptions("memovalet-captions-started");
    return true;
  };

  // The browser's recognition failed, or is hearing nothing while this person
  // talks: carry on with MemoValet's own, without anyone having to notice.
  const switchToMemoValetCaptions = () => {
    browserCaptionsFailedRef.current = true;
    if (captionEngineRef.current === "memovalet") return false;
    if (!callMicrophone() || !canListenToMicrophone()) return false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.stop(); } catch { /* already stopped */ }
    microphoneListenerRef.current?.stop();
    microphoneListenerRef.current = null;
    recordingActiveRef.current = false;
    setInterimBySpeaker((prev) => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
    if (!startMemoValetCaptions()) return false;
    reportCaptions("switched-to-memovalet");
    setCaptionNotice("Captions are now written by MemoValet. They appear a moment after each sentence.");
    return true;
  };

  const startSpeaking = () => {
    if (recordingActiveRef.current) return;
    if (!channelRef.current) return;
    const Ctor = getSpeechRecognitionConstructor();
    if (engineToUse() === "memovalet" || !Ctor) {
      startMemoValetCaptions();
      return;
    }

    setRecordingError("");
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langCodeRef.current;

    const clearInterim = () => {
      delete interimSentRef.current[clientId];
      delete interimLatestRef.current[clientId];
      if (interimDebounceRef.current[clientId]) {
        clearTimeout(interimDebounceRef.current[clientId]);
        delete interimDebounceRef.current[clientId];
      }
      setInterimBySpeaker((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      channelRef.current?.send({
        type: "broadcast",
        event: "interim",
        payload: { speakerId: clientId, speakerName: "", langLabel: "", text: "" },
      });
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition || !recordingActiveRef.current) return;
      if (!heardAnythingRef.current) {
        heardAnythingRef.current = true;
        reportCaptions("first-words", "browser");
      }
      heardWithoutWordsRef.current = 0;
      const { finalText, interimText } = readSpeechResult(event);

      const currentLangLabel =
        SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === langCodeRef.current)?.label || "English";
      const trimmedInterim = interimText.trim();
      if (trimmedInterim) {
        const interimPayload = {
          speakerId: clientId,
          speakerName: nameRef.current.trim() || "Someone",
          langLabel: currentLangLabel,
          text: trimmedInterim,
        };
        setInterimBySpeaker((prev) => ({ ...prev, [clientId]: interimPayload }));
        channelRef.current?.send({ type: "broadcast", event: "interim", payload: interimPayload });
        // Your own words never come back over the channel, so they were only
        // translated once you stopped talking — in one lump, well behind you.
        scheduleInterimTranslation(clientId, trimmedInterim, currentLangLabel);
      }

      const trimmed = finalText.trim();
      if (!trimmed) return;

      // A single event can finish one phrase and start the next.
      if (!trimmedInterim) clearInterim();

      const utterance: Utterance = {
        id: crypto.randomUUID(),
        speakerId: clientId,
        speakerName: nameRef.current.trim() || "Someone",
        langCode: langCodeRef.current,
        langLabel: currentLangLabel,
        // Speech recognition hands back bare words; a caption is writing.
        text: tidyCaption(trimmed),
        ts: Date.now(),
      };

      setUtterances((prev) => [...prev, utterance]);
      channelRef.current?.send({ type: "broadcast", event: "utterance", payload: utterance });
      // Our own words don't come back over the channel; translate them here.
      void translateForMe(utterance);
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error !== "no-speech" && event.error !== "aborted") {
        reportCaptions("browser-captions-error", event.error);
        // Brave, Arc and Opera report "network"; Safari "service-not-allowed".
        // Whatever the reason, the call's own microphone still works.
        if (switchToMemoValetCaptions()) return;
        const messages: Record<string, string> = {
          "not-allowed": "Microphone access was denied. Allow it in your browser, then try again.",
          "service-not-allowed": "Speech recognition is unavailable in this browser. Try Chrome.",
          "audio-capture": "No microphone is available. Check your microphone connection.",
          "language-not-supported": "This browser cannot recognise the selected language. Choose another language or browser.",
          network: "Speech recognition lost its connection. Check your internet, then start captions again.",
        };
        setRecordingError(messages[event.error] || "Captions stopped. Your captured words are safe; try starting again.");
        recordingActiveRef.current = false;
        setIsRecording(false);
        clearInterim();
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !recordingActiveRef.current) return;
      try { recognition.start(); }
      catch {
        if (switchToMemoValetCaptions()) return;
        recordingActiveRef.current = false;
        setIsRecording(false);
        setRecordingError("Captions paused. Start them again when your microphone is ready.");
      }
    };

    recognitionRef.current = recognition;
    recordingActiveRef.current = true;
    try {
      recognition.start();
      setCaptionEngine("browser");
      setIsRecording(true);
      reportCaptions("browser-captions-started", langCodeRef.current);
    } catch {
      recordingActiveRef.current = false;
      if (switchToMemoValetCaptions()) return;
      setIsRecording(false);
      setRecordingError("Couldn't start captions. Check microphone access and try again.");
      return;
    }

    // Chrome's recognition can run without error and still hear nothing — it
    // listens to the computer's default microphone, not necessarily the one in
    // the call. Listen to the call's microphone alongside it (nothing is sent
    // anywhere) and, after several seconds of speech with no words back, switch.
    const track = callMicrophone();
    if (!track || !canListenToMicrophone()) return;
    heardWithoutWordsRef.current = 0;
    microphoneListenerRef.current?.stop();
    microphoneListenerRef.current = listenToMicrophone({
      track,
      mode: "watch",
      // Nothing is captioned from this; it only names the language.
      onSample: (wav, voicedMs) => void detectSpokenLanguage(wav, voicedMs),
      onSilentStart: () => {
        // The watcher hears nothing, so it can't judge whether the browser's
        // own captions are working. Leave them be rather than switching away.
        heardWithoutWordsRef.current = 0;
      },
      onVoice: (ms) => {
        if (recognitionRef.current !== recognition || !recordingActiveRef.current) return;
        heardWithoutWordsRef.current += ms;
        if (heardWithoutWordsRef.current >= SPEECH_WITHOUT_WORDS_MS) switchToMemoValetCaptions();
      },
    });
  };

  const stopSpeaking = () => {
    recordingActiveRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.stop(); } catch { /* Already stopped. */ }
    // Words already said are still written down; only listening stops.
    microphoneListenerRef.current?.stop();
    microphoneListenerRef.current = null;
    setIsRecording(false);
    setInterimBySpeaker((prev) => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
    channelRef.current?.send({
      type: "broadcast",
      event: "interim",
      payload: { speakerId: clientId, speakerName: "", langLabel: "", text: "" },
    });
  };

  // Captions and live translation are the point of the room, so listening
  // starts by itself once you are in the call with your microphone on. The only
  // control that ever started it was the "Start the meeting" button on the
  // embedded transcript view, which the call page does not render — so on a
  // real call nothing ever listened and the translation panel sat on "Waiting
  // for speech…" forever. The embedded view keeps its button.
  const beginListening = useEffectEvent(() => startSpeaking());
  useEffect(() => {
    if (!shouldListen({ previewMode, embedded, joined, ended, left, callClosed, micEnabled, recordingSupported })) return;
    // A tick later, so turning the microphone on can finish settling first.
    const timer = setTimeout(() => beginListening(), 0);
    return () => clearTimeout(timer);
  }, [joined, micEnabled, ended, left, callClosed, previewMode, embedded, recordingSupported]);

  // A muted microphone has nothing to caption. Covers being muted by the host
  // as well as muting yourself, since both land on the same piece of state.
  useEffect(() => {
    if (!micEnabled) stopSpeaking();
    // stopSpeaking only tears down what is already running, so it is safe to
    // call whenever the microphone goes quiet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled]);

  // Stops this device's part in the call: captions, camera, microphone and video.
  const stopCallHere = () => {
    mediaGenerationRef.current += 1;
    translationRequests.cancelAll();
    Object.values(interimDebounceRef.current).forEach(clearTimeout);
    recordingActiveRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.stop(); } catch { /* Already stopped; still release call devices. */ }
    // The sentence being spoken as the call closes still goes in the transcript.
    const listener = microphoneListenerRef.current;
    microphoneListenerRef.current = null;
    if (listener) lastWordsRef.current = listener.finish(LAST_WORDS_WAIT_MS);
    livekitRoomRef.current?.localParticipant.trackPublications.forEach(publication => {
      try { publication.track?.stop(); } catch { console.warn("[call-end] track_stop_failed"); }
    });
    releaseLocalTracks();
    disconnectLiveKit();
  };

  const downloadRecording = (index = recordingClipsRef.current.length - 1) => {
    const blob = recordingClipsRef.current[index]?.blob ?? videoBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `memovalet-recording-${index + 1}.${extensionFor(blob.type) || "mp4"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const closeRoom = async (meetingId: string | null) => {
    const response = await fetch(`/api/live/${sessionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("You have left, but ending the meeting for everyone failed. Retry below.");
    roomEndedRef.current = true;
    setRoomEnded(true);
  };

  const handleFinish = async (mode: "leave" | "end" = "end") => {
    if (finishBusyRef.current) return;
    finishBusyRef.current = true;
    exitModeRef.current = mode;
    setExitMode(mode);
    setEndPrompt(false);
    setFinishing(true);
    setFinishError("");
    // Stop recording first, but disconnect immediately without waiting for its final data,
    // storage, the network, or AI. Retain this page for backup downloads and retries.
    callClosedRef.current = true;
    setCallClosed(true);
    const { recording: stopped, closing: closure } = beginCallExit(stopVideoCapture, stopCallHere,
      () => mode === "end" && canManage && !roomEndedRef.current ? closeRoom(savedMeetingRef.current) : Promise.resolve());
    void channelRef.current?.unsubscribe();
    channelRef.current = null;
    try {
      setFinishStage("Finishing recording…");
      const recordingFailure = await stopped;
      if (recordingFailure) setRecordingWarning(recordingFailure.message || "Recording could not be finished.");
      if (lastWordsRef.current) {
        setFinishStage("Writing down the last few words…");
        await lastWordsRef.current;
        lastWordsRef.current = null;
      }
      const sorted = [...utterancesRef.current].sort((a, b) => a.ts - b.ts);
      const transcript = sorted.map(u => `${u.speakerName} (${u.langLabel}): ${u.text}`).join("\n");
      const pending = Object.values(interimBySpeaker).map(u => `${u.speakerName} (${u.langLabel}): ${u.text}`).join("\n");
      const notes = sharedNotesRef.current;
      const notesText = [
        ...notes.discussionPoints.map(point => `- ${point}`),
        ...notes.nextSteps.map(step => `- [${step.done ? "x" : " "}] ${step.text}`),
      ].join("\n");
      const transcriptWithNotes = [transcript, pending, notesText].filter(Boolean).join("\n\n");
      // A call with nothing captured is still a meeting that happened, and
      // dropping it is why History could sit empty after a morning of calls.
      // The server decides whether it was real, from the live session's own
      // age — this only avoids asking about a room opened for a few seconds.
      const ranForSeconds = secondsSince(sessionStartRef.current);
      const worthSaving = isWorthSaving({
        hasContent: Boolean(transcriptWithNotes.trim() || videoBlobRef.current),
        elapsedSeconds: ranForSeconds,
      });
      if (canManage && worthSaving && !savedMeetingRef.current) {
        setFinishStage(recordingClipsRef.current.length
          ? "Uploading the recording. Keep this page open…"
          : "Saving your meeting. Keep this page open…");
        if (!uploadPromiseRef.current) uploadPromiseRef.current = uploadRecordedVideo();
        // Earlier parts went up during the call, so this is mostly the last one,
        // never more than one part's worth. Give a slow connection a fair
        // chance — but however it goes, the meeting is saved with whatever made
        // it, and nothing here throws the meeting away.
        await withCallTimeout(uploadPromiseRef.current, 180000, "slow").catch(() => {});
        uploadPromiseRef.current = null;
        const recordingUrls = uploadedClipUrls(recordingClipsRef.current);
        const videoUrl = recordingUrls[0] ?? null;
        setRecordingSaved(recordingUrls.length > 0);
        if (recordingUrls.length < recordingClipsRef.current.length) {
          setRecordingWarning(
            recordingClipsRef.current.length - recordingUrls.length === 1
              ? "One part of the recording didn't upload. The meeting is saved with the rest; download that part below and keep it."
              : "Some of the recording didn't upload. The meeting is saved with the rest; download the missing parts below and keep them."
          );
        }
        setFinishStage("Saving your meeting. Keep this page open…");
        const response = await fetch("/api/process-meeting", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20000),
          // Only parts that are really in storage. A blank for a failed one
          // used to be sent too, and the server refused the whole meeting —
          // with "This recording does not belong to your account".
          body: JSON.stringify({ transcript: transcriptWithNotes, requestId: sessionId, title,
            participants: Array.from(new Set(sorted.map(u => u.speakerName))).join(", "),
            meetingType, videoUrl, recordingUrls, saveOnly: true }),
        });
        const data = await response.json();
        if (!response.ok || !data.meetingId) throw new Error(data.error || "Saving failed. Your recording backup is still available below.");
        savedMeetingRef.current = data.meetingId;
        setSavedMeetingId(data.meetingId);
        // The meeting is safe; now write its summary, without making the save
        // wait on the AI. Seven of the first eight meetings ever saved sat in
        // History with no summary because nobody knew to ask for one.
        void fetch("/api/process-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Only the meeting id: the server works from the transcript it saved,
          // never from anything sent again here.
          body: JSON.stringify({ meetingId: data.meetingId }),
          keepalive: true,
        }).catch(() => {});
      }
      const closeError = await closure;
      if (closeError) throw closeError;
      if (mode === "end" && canManage && savedMeetingRef.current) await closeRoom(savedMeetingRef.current);
      setFinishStage(
        savedMeetingRef.current
          ? "Saved in History. The summary is being written now."
          : canManage
            // Say what did not happen. "Disconnected" let people believe their
            // meeting was waiting for them in History when nothing was kept.
            ? `You are disconnected. ${nothingSavedReason({ elapsedSeconds: ranForSeconds })}`
            : "You are disconnected from the call."
      );
    } catch (error) {
      console.warn("[call-end] save_or_close_failed");
      setFinishError(error instanceof Error && error.name !== "TimeoutError"
        ? error.message : "The request timed out. You are already disconnected. Retry below; your backup is kept on this page.");
      setFinishStage("");
    } finally {
      finishBusyRef.current = false;
      setFinishing(false);
    }
  };

  // The host closing the room must also end guest clients, even if their media
  // connection is reconnecting when LiveKit removes the room.
  const hostEnded = useEffectEvent(() => { void handleFinish("leave"); setEnded(true); });
  useEffect(() => {
    if (!joined || ended || left || callClosed || previewMode) return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch(`/api/live/${sessionId}`, { signal: AbortSignal.timeout(5000) });
        const data = await response.json();
        if (active && !callClosedRef.current && data.session?.status === "ended") {
          hostEnded();
        }
      } catch { /* A network outage is not proof that the host ended the call. */ }
    };
    const timer = setInterval(() => { void check(); }, 6000);
    return () => { active = false; clearInterval(timer); };
  }, [joined, ended, left, callClosed, previewMode, sessionId]);

  // Whatever is being shared takes the stage. If two people share at once the
  // first one holds it, rather than the screen flickering between them.
  const sharingId = Object.keys(screenShares)[0];
  const screenShare = sharingId
    ? {
        stream: screenShares[sharingId],
        isMine: sharingId === clientId,
        name: sharingId === clientId ? "You" : participants[sharingId]?.name || "Someone",
      }
    : undefined;

  const participantList = Object.values(participants);
  const roomParticipants: LiveRoomParticipant[] = previewMode
    ? PREVIEW_PARTICIPANTS.map(participant => participant.isLocal ? { ...participant, cameraEnabled, micEnabled } : participant)
    : Object.entries(participants)
        .map(([id, participant]) => ({
          id,
          ...participant,
          stream: id === clientId ? localStream : remoteStreams[id] || null,
          isLocal: id === clientId,
          cameraEnabled: id === clientId ? cameraEnabled : participant.cameraEnabled,
          micEnabled: id === clientId ? micEnabled : participant.micEnabled,
        }))
        .sort((a, b) => Number(b.isLocal) - Number(a.isLocal));
  // Captions are the whole point of the panel, so it says what they are doing
  // rather than sitting on "Waiting for speech…" whether they are running,
  // stopped, or never started.
  const captionStatus = previewMode
    ? "Listening. Your words will appear here as you speak."
    : !joined
      ? "Join the call to start captions."
      : recordingError
        ? recordingError
        : !micEnabled
          ? "Your microphone is off, so nothing is being written down. Turn it on and captions start."
          : !isRecording
            ? "Captions aren't running. Turn your microphone off and on again to start them."
            : captionEngine === "memovalet"
              ? translationEnabled
                ? "Listening. MemoValet is transcribing your speech for translation. Each sentence appears shortly after you speak."
                : "Listening. MemoValet is transcribing your speech. Each sentence appears shortly after you speak."
              : "Listening. Your words will appear here as you speak.";

  /**
   * Translation on, for the rest of the call. Pressing Translate is all it
   * takes — there used to be a separate "Translation on" tick as well, and
   * people who pressed Translate, chose Arabic and spoke for a minute saw
   * nothing but English because the tick was still off. Once on it stays on
   * however long the meeting runs; the Original tab is there for reading the
   * words as spoken. Everything already said is translated too, not only
   * what comes next.
   */
  const turnTranslationOn = () => {
    // Already on: it is working through the meeting and every new line.
    if (translationEnabledRef.current) return;
    reportCaptions("translation-on");
    translationRequests.cancelAll();
    Object.values(interimDebounceRef.current).forEach(clearTimeout);
    translationEnabledRef.current = true;
    setTranslationEnabled(true);
    translationGenerationRef.current += 1;
    setTranslations({});
    setInterimTranslations({});
    setUntranslated({});
    // Reading in another language means the words themselves have to be
    // right, so MemoValet's own transcription takes over from the browser's.
    if (recordingActiveRef.current && engineToUse() === "memovalet" && captionEngineRef.current !== "memovalet") {
      stopSpeaking();
      startMemoValetCaptions();
    }
    void translateMeetingSoFar();
  };

  /**
   * Picking a language to read in is asking for translation, wherever it is
   * picked — so choosing one that isn't the one being spoken switches it on.
   */
  const chooseReadingLanguage = (code: string) => {
    changeCaptionLanguage(code);
    reportCaptions("reading-language", code);
    const reading = SPEECH_LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? "";
    const spoken = SPEECH_LANGUAGE_OPTIONS.find((option) => option.code === langCodeRef.current)?.label ?? "";
    if (needsTranslation({ enabled: true, spokenLanguage: spoken, readingLanguage: reading })) {
      turnTranslationOn();
    }
  };

  const roomCaptions: LiveRoomCaption[] = previewMode
    ? PREVIEW_CAPTIONS
    : [
        ...utterances.map((utterance) => ({
          id: utterance.id,
          speakerId: utterance.speakerId,
          speakerName: utterance.speakerName,
          langLabel: utterance.langLabel,
          original: utterance.text,
          translated:
            utterance.langLabel === myLangLabel
              ? utterance.text
              : translations[utterance.id] || utterance.text,
          // Says so while it is being translated, instead of showing the
          // original as though translation had simply not happened.
          translating:
            needsTranslation({
              enabled: translationEnabled,
              spokenLanguage: utterance.langLabel,
              readingLanguage: myLangLabel,
            }) && !translations[utterance.id] && !untranslated[utterance.id],
          time: new Date(utterance.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
        ...Object.entries(interimBySpeaker).map(([speakerId, caption]) => ({
          id: `interim-${speakerId}`,
          speakerId,
          speakerName: caption.speakerName,
          langLabel: caption.langLabel,
          original: caption.text,
          translated:
            caption.langLabel === myLangLabel
              ? caption.text
              : interimTranslations[speakerId] || caption.text,
          time: "Live",
          live: true,
        })),
      ];

  if (callClosed) {
    return <main className="min-h-dvh bg-[#f6f7fb] px-5 py-12 text-slate-900">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{exitMode === "end" && roomEnded ? "Meeting ended" : "You left the meeting"}</h1>
        <p className="mt-2 text-sm text-slate-600">Your camera and microphone are off.</p>
        {finishStage && <p role="status" className="mt-4 text-sm">{finishStage}</p>}
        {finishError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{finishError}</p>}
        {recordingWarning && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{recordingWarning}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {Array.from({ length: clipCount }, (_, index) => <button key={index} onClick={() => downloadRecording(index)} className="rounded-xl border border-indigo-200 px-4 py-3 text-sm font-medium">Download recording {index + 1}</button>)}
          {finishError && <button disabled={finishing} onClick={() => void handleFinish(exitModeRef.current)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">Retry saving / ending</button>}
          {/* Straight to the meeting, where the recording plays and its link can be sent. */}
          {savedMeetingId && <button onClick={() => router.push(`/history/${savedMeetingId}`)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white">{recordingSaved ? "Open the meeting and recording" : "Open saved meeting"}</button>}
          {!finishing && !finishError && <button onClick={() => router.push("/meeting")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">Back to meetings</button>}
        </div>
      </section>
    </main>;
  }

  if (left) {
    const leftMessage = (
      <>
        <p className="mb-1 font-medium">You left the meeting</p>
        <p className="text-sm text-[var(--muted)]">It carries on for everyone else.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-xl brand-gradient-bg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Rejoin
        </button>
      </>
    );
    if (embedded) {
      return <div className="rounded-xl border border-[var(--surface-border)] p-6 text-center">{leftMessage}</div>;
    }
    return (
      <div className="relative min-h-screen overflow-hidden px-6 py-16 flex items-center justify-center">
        <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
        <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />
        <div className="relative surface-card rounded-2xl p-10 max-w-md text-center">
          <Logo size="md" href="/" />
          <div className="mt-6">{leftMessage}</div>
        </div>
      </div>
    );
  }

  if (ended) {
    if (embedded) {
      return (
        <div className="rounded-xl border border-[var(--surface-border)] p-6 text-center">
          <p className="font-medium mb-1">This session has ended</p>
          <p className="text-sm text-[var(--muted)]">If it was saved, the host has the summary.</p>
        </div>
      );
    }
    return (
      <div className="relative min-h-screen overflow-hidden px-6 py-16 flex items-center justify-center">
        <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
        <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />
        <div className="relative surface-card rounded-2xl p-10 max-w-md text-center">
          <Logo size="md" href="/" />
          <p className="font-medium mt-6 mb-1">This session has ended</p>
          <p className="text-sm text-[var(--muted)]">
            If it was saved, ask the host to share the summary with you.
          </p>
        </div>
      </div>
    );
  }

  if (!joined) {
    if (embedded) {
      return (
        <div className="swoop-in rounded-xl border border-[var(--surface-border)] p-4">
          <p className="text-sm font-medium mb-1">Live session with others</p>
          <p className="text-xs text-[var(--muted)] mb-4">
            You&apos;ll speak in{" "}
            {SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === langCode)?.label || "English"}. Everyone
            else sees it translated into their own.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleJoin();
                }
              }}
              placeholder="Your name"
              className="flex-1 min-w-[8rem] rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-400"
              autoFocus
            />
          </div>

          {shareUrl && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-400/10 px-3 py-2 mb-3">
              <span className="text-xs truncate flex-1">{shareUrl}</span>
              <button
                type="button"
                onClick={copyShareLink}
                className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 shrink-0"
              >
                {linkCopied ? "Copied" : "Copy link for others"}
              </button>
            </div>
          )}

          {videoSupported && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-3">
              Recording is off by default. The host can record with everyone’s agreement. A recording notice appears in the call.
            </label>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleJoin()}
              disabled={!name.trim()}
              className="flex-1 brand-gradient-bg text-white font-medium py-2 rounded-lg text-sm transition hover:opacity-90 disabled:opacity-60"
            >
              Join session
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-[var(--muted)] hover:text-current transition px-2"
              >
                Cancel
              </button>
            )}
          </div>

          {!recordingSupported && (
            <p className="text-xs text-[var(--muted)] mt-3">
              This browser can&apos;t pick up your microphone for captions. You can still join to read what others say.
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="relative min-h-screen overflow-hidden px-6 py-16 flex items-center justify-center">
        <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
        <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />
        <form
          onSubmit={handleJoin}
          className="relative surface-card rounded-2xl p-8 max-w-sm w-full"
        >
          <Logo size="md" href="/" />
          <h1 className="text-lg font-semibold mt-6 mb-1">{title}</h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            Join and pick the language you&apos;ll speak. Everyone else sees it translated into
            their own.
          </p>

          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya"
            className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 mb-4"
            required
            autoFocus
          />

          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            Language you&apos;ll speak
          </label>
          <select
            value={langCode}
            onChange={(e) => changeSpeakingLanguage(e.target.value)}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 mb-6"
          >
            {SPEECH_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>

          {hasScheduledDuration && (
            <p className="text-xs text-[var(--muted)] mb-4">
              Scheduled for{" "}
              {durationMinutes < 60
                ? `${durationMinutes} minutes`
                : durationMinutes === 60
                  ? "1 hour"
                  : `${(durationMinutes / 60).toFixed(1).replace(".0", "")} hours`}
              .
            </p>
          )}

          {videoSupported && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-6">
              Recording is off by default. The host can record with everyone’s agreement. A recording notice appears in the call.
            </label>
          )}

          <button
            type="submit"
            className="w-full brand-gradient-bg text-white font-medium py-2.5 rounded-xl transition hover:opacity-90"
          >
            Join session
          </button>

          {!recordingSupported && (
            <p className="text-xs text-[var(--muted)] mt-4">
              This browser can&apos;t pick up your microphone for captions. You can still join to read what others say.
            </p>
          )}
        </form>
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="text-sm font-medium">Live session with others</p>
          <div className="flex items-center gap-2">
            {isRecordingVideo && (
              <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums rounded-full border border-red-500/40 text-red-500 dark:text-red-400 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                REC {formatElapsed(videoElapsed)}
              </span>
            )}
            <span
              className={`flex items-center gap-1.5 text-xs font-medium tabular-nums rounded-full border px-2.5 py-1 ${
                remainingSeconds <= 0
                  ? "text-red-500 dark:text-red-400 border-red-500/40"
                  : remainingSeconds <= 300
                    ? "text-amber-600 dark:text-amber-400 border-amber-500/40"
                    : "text-[var(--muted)] border-[var(--surface-border)]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                  remainingSeconds <= 0
                    ? "bg-red-500"
                    : remainingSeconds <= 300
                      ? "bg-amber-500"
                      : "bg-indigo-400"
                }`}
              />
              {formatClock(remainingSeconds)}
            </span>
            {isAuthed && (
              <button
                onClick={() => void handleFinish(canManage ? "end" : "leave")}
                disabled={finishing}
                className="brand-gradient-bg text-white text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-90 disabled:opacity-60"
              >
                {finishing ? "Saving…" : "Finish and save"}
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-[var(--muted)] hover:text-current transition px-1"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {shareUrl && (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-400/10 px-3 py-2 mb-3">
            <span className="text-xs truncate flex-1">{shareUrl}</span>
            <button
              type="button"
              onClick={copyShareLink}
              className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 shrink-0"
            >
              {linkCopied ? "Copied" : "Copy link for others"}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-3 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {participantList.map((p, i) => (
            <span
              key={i}
              className="text-xs rounded-full border border-[var(--surface-border)] px-2.5 py-1"
            >
              {p.name} <span className="text-[var(--muted)]">· {p.langLabel}</span>
            </span>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--surface-border)] bg-indigo-400/5 p-4 mb-3 max-h-72 overflow-y-auto space-y-3">
          {utterances.length === 0 && Object.keys(interimBySpeaker).length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-6">
              Nobody has said anything yet. Hit record and start talking.
            </p>
          )}
          {[...utterances]
            .sort((a, b) => a.ts - b.ts)
            .map((u) => {
              const isMine = u.speakerId === clientId;
              const displayText =
                u.langLabel === myLangLabel ? u.text : translations[u.id] || u.text;
              return (
                <div key={u.id} className={isMine ? "text-right" : ""}>
                  <p className="text-xs text-[var(--muted)] mb-0.5">
                    {u.speakerName} <span className="opacity-60">· {u.langLabel}</span>
                  </p>
                  <p className="text-sm inline-block max-w-[85%] rounded-xl px-3 py-2 bg-indigo-400/10">
                    {displayText}
                  </p>
                </div>
              );
            })}
          {Object.entries(interimBySpeaker).map(([speakerId, caption]) => {
            const isMine = speakerId === clientId;
            const displayText =
              caption.langLabel === myLangLabel
                ? caption.text
                : interimTranslations[speakerId] || caption.text;
            return (
              <div key={`interim-${speakerId}`} className={isMine ? "text-right" : ""}>
                <p className="text-xs text-[var(--muted)] mb-0.5">
                  {caption.speakerName}{" "}
                  <span className="opacity-60">· {caption.langLabel} · live</span>
                </p>
                <p className="text-sm inline-block max-w-[85%] rounded-xl px-3 py-2 bg-indigo-400/5 text-[var(--muted)] italic">
                  {displayText}
                </p>
              </div>
            );
          })}
          <div ref={transcriptEndRef} />
        </div>

        {recordingError && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-2">{recordingError}</p>
        )}
        {videoError && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{videoError}</p>}

        {recordingSupported ? (
          <button
            type="button"
            onClick={isRecording ? stopSpeaking : startSpeaking}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              isRecording
                ? "bg-red-500/10 text-red-500 dark:text-red-400"
                : "brand-gradient-bg text-white hover:opacity-90"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-white"}`}
            />
            {isRecording ? "Pause" : "Start the meeting"}
          </button>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            This browser can&apos;t pick up your microphone for captions. You can still read what others say here.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <LiveMeetingRoom
        title={previewMode ? "Global project kickoff" : title}
        elapsedLabel={formatElapsed(
          previewMode ? 18 * 60 + 42 : Math.max(0, durationMinutes * 60 - remainingSeconds)
        )}
        participants={roomParticipants}
        participantCount={previewMode ? 12 : Math.max(roomParticipants.length, 1)}
        activeSpeakerId={activeSpeaker.id ?? undefined}
        screenShare={screenShare}
        onMuteForEveryone={canManage && !previewMode ? muteForEveryone : undefined}
        captions={roomCaptions}
        captionStatus={captionStatus}
        sessionId={previewMode ? undefined : sessionId}
        callPass={livekitToken}
        myLangCode={captionLangCode}
        speakingLangCode={langCode}
        onSpeakingLanguageChange={changeSpeakingLanguage}
        translationEnabled={translationEnabled}
        onTranslate={turnTranslationOn}
        recording={isRecordingVideo || Object.values(participants).some(person => person.recording)}
        localRecording={isRecordingVideo}
        recordingBusy={recordingBusy}
        onToggleRecording={canManage && !previewMode ? toggleRecording : undefined}
        onDownloadRecording={!isRecordingVideo && recordingReady ? () => downloadRecording() : undefined}
        recordingReady={recordingReady}
        recordingWarning={recordingWarning}
        onToggleScreenSharing={!previewMode ? toggleScreenSharing : undefined}
        screenSharing={screenSharing}
        canFinish={canManage || previewMode}
        notes={sharedNotes}
        chatMessages={chatMessages}
        selfId={clientId}
        onSendChat={sendChat}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        deviceBusy={deviceBusy}
        saving={finishing}
        endLabel="Leave"
        onLeave={previewMode ? () => setLeft(true) : () => void handleFinish("leave")}
        finishMessage={finishError}
        statusMessage={error || recordingError || videoError || wakeWarning || (linkCopied ? "Invite link copied." : "") || captionNotice}
        onLanguageChange={chooseReadingLanguage}
        onToggleMic={() => void toggleDevice("audio")}
        onToggleCamera={() => void toggleDevice("video")}
        onShare={copyShareLink}
        onFinish={() => setEndPrompt(true)}
        onNotesChange={updateSharedNotes}
      />
      {endPrompt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-empty-heading"
        >
          <div className="surface-card w-full max-w-md rounded-2xl p-6">
            <h2 id="end-empty-heading" className="text-base font-semibold">
              End meeting for everyone?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Everyone will be disconnected and recording will stop. Your captured recording and notes will be saved after you leave. Keep the next page open until saving finishes.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEndPrompt(false)}
                disabled={finishing}
                className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Keep meeting open
              </button>
              <button
                type="button"
                onClick={() => { if (previewMode) { setEnded(true); setEndPrompt(false); } else void handleFinish("end"); }}
                disabled={finishing}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {finishing ? "Ending…" : "End for everyone"}
              </button>
            </div>
          </div>
        </div>
      )}
      {consentPromptOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recording-consent-heading"
        >
          <div className="surface-card w-full max-w-md rounded-2xl p-6">
            <h2 id="recording-consent-heading" className="text-base font-semibold">
              Before you record
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This records everyone&apos;s camera, microphone and anything shared on screen.
              Keep this tab open and visible until you finish and save.
            </p>

            <button
              type="button"
              role="checkbox"
              aria-checked={consentTicked}
              onClick={() => setConsentTicked(!consentTicked)}
              className="mt-4 flex w-full items-start gap-3 rounded-xl border border-[var(--surface-border)] px-3.5 py-3 text-left text-xs leading-5 transition hover:border-indigo-300"
            >
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                  consentTicked
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white"
                }`}
                aria-hidden="true"
              >
                {consentTicked && <Check size={12} weight="bold" />}
              </span>
              <span>I&apos;ve told everyone in this meeting that it will be recorded.</span>
            </button>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConsentPromptOpen(false)}
                className="flex-1 rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-medium transition hover:border-indigo-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startRecordingWithConsent}
                disabled={!consentTicked}
                className="brand-gradient-bg flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Start recording
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
