"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  SpeechRecognitionInstance,
  getSpeechRecognitionConstructor,
  SPEECH_LANGUAGE_OPTIONS,
} from "@/lib/speechRecognition";
import { MeetingType, Project, UpcomingCalendarEvent } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { PRIVATE_RECORDING_PREFIX } from "@/lib/recording-path";
import {
  MAX_RECORDING_BYTES,
  UPLOADABLE_RECORDING_ACCEPT,
  containerOf,
  extensionFor,
  pickRecordingMimeType,
} from "@/lib/recording-format";
import { AUDIO_BITS_PER_SECOND, VIDEO_BITS_PER_SECOND } from "@/lib/recording-limits";
import { startRecordingClock, withPlayableDuration } from "@/lib/webm-duration";
import { useWakeLock } from "@/lib/use-wake-lock";
import MeetingStatusHeader from "@/components/MeetingStatusHeader";
import MeetingLaunchpad from "@/components/MeetingLaunchpad";

function subscribeNoop() {
  return () => {};
}

function getRecordingSupported() {
  return !!getSpeechRecognitionConstructor();
}

function getRecordingSupportedServer() {
  return false;
}

// "off" still leaves the written transcript running — it only skips the media.
type CaptureMode = "video" | "audio" | "off";

function getVideoSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined" &&
    // A browser with MediaRecorder but no container we can write is no use here;
    // don't offer recording we know will fail the moment it's pressed.
    (!!pickRecordingMimeType("video") || !!pickRecordingMimeType("audio"))
  );
}

function getVideoSupportedServer() {
  return false;
}

interface TranscriptFormProps {
  onProcess: (
    transcript: string,
    metadata?: { title?: string; participants?: string; videoUrl?: string | null }
  ) => void | Promise<void>;
  loading: boolean;
  title: string;
  setTitle: (value: string) => void;
  participants: string;
  setParticipants: (value: string) => void;
  meetingType: MeetingType;
  setMeetingType: (value: MeetingType) => void;
  projectId: string | null;
  setProjectId: (value: string | null) => void;
  focusSignal?: number;
  selectedEvent: UpcomingCalendarEvent | null;
  allEvents: UpcomingCalendarEvent[];
  now: number;
  onSelectEvent: (event: UpcomingCalendarEvent) => void;
}

export default function TranscriptForm({
  onProcess,
  loading,
  title,
  setTitle,
  participants,
  setParticipants,
  meetingType,
  setMeetingType,
  projectId,
  setProjectId,
  focusSignal,
  selectedEvent,
  allEvents,
  now,
  onSelectEvent,
}: TranscriptFormProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.projects)) setProjects(data.projects);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupNote, setCleanupNote] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [recordingLang, setRecordingLang] = useState(SPEECH_LANGUAGE_OPTIONS[0].code);
  const [translateTargets, setTranslateTargets] = useState<string[]>([]);
  const [liveTranslations, setLiveTranslations] = useState<Record<string, string>>({});
  const [interimTranslations, setInterimTranslations] = useState<Record<string, string>>({});
  const [captureMode, setCaptureMode] = useState<CaptureMode>("video");
  const [videoError, setVideoError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [pickedIsAudio, setPickedIsAudio] = useState(false);
  const [recordingExtension, setRecordingExtension] = useState("webm");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  // Set when the recording would not upload, to offer saving the meeting
  // without it. The transcript is never held hostage by the recording.
  const [recordingUploadFailed, setRecordingUploadFailed] = useState(false);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [hasRecordedVideo, setHasRecordedVideo] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [startingLiveSession, setStartingLiveSession] = useState(false);
  const [liveSessionError, setLiveSessionError] = useState("");
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recordingSupported = useSyncExternalStore(
    subscribeNoop,
    getRecordingSupported,
    getRecordingSupportedServer
  );
  const videoSupported = useSyncExternalStore(
    subscribeNoop,
    getVideoSupported,
    getVideoSupportedServer
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recordingActiveRef = useRef(false);
  const transcriptRef = useRef("");
  const translateTargetsRef = useRef<string[]>([]);
  const interimTranslateDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoPreviewUrlRef = useRef<string | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoBlobRef = useRef<Blob | null>(null);
  const videoFinalizedRef = useRef<Promise<void> | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const pickedFileRef = useRef<File | null>(null);
  const uploadedRecordingRef = useRef<{ blob: Blob; path: string } | null>(null);
  const captureGenerationRef = useRef(0);
  const submittingRef = useRef(false);

  // A phone left on the table dims, locks, and takes the recording down with it.
  const wakeWarning = useWakeLock(isRecording);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!focusSignal) return;
    transcriptAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    transcriptAreaRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    translateTargetsRef.current = translateTargets;
  }, [translateTargets]);

  useEffect(() => {
    videoPreviewUrlRef.current = videoPreviewUrl;
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      captureGenerationRef.current += 1;
      recordingActiveRef.current = false;
      recognitionRef.current?.stop();
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (videoPreviewUrlRef.current) URL.revokeObjectURL(videoPreviewUrlRef.current);
    };
  }, []);

  const cleanUpTranscript = async () => {
    const raw = transcriptRef.current.trim();
    if (!raw) return;

    setIsCleaning(true);
    setCleanupNote("");
    try {
      const response = await fetch("/api/format-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: raw }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.transcript) {
        // A long meeting can take a minute or two to clean up. If they've
        // started editing in the meantime, their edits win over the tidy copy.
        if (transcriptRef.current.trim() === raw) {
          setTranscript(data.transcript);
        } else {
          setCleanupNote("You edited the transcript while it was being tidied, so your version was kept.");
        }
      } else if (response.status === 413 || response.status === 502) {
        setCleanupNote(data.error || "Punctuation could not be updated. Your transcript is unchanged.");
      }
    } catch {
      // leave the raw transcript as-is if cleanup fails
    } finally {
      setIsCleaning(false);
    }
  };

  const translateChunk = async (text: string, targetLabel: string) => {
    try {
      const response = await fetch("/api/translate-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: targetLabel }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translation) {
          setLiveTranslations((prev) => ({
            ...prev,
            [targetLabel]: prev[targetLabel]
              ? prev[targetLabel] + " " + data.translation
              : data.translation,
          }));
        }
      }
    } catch {
      // skip this chunk's translation if it fails, keep listening
    }
  };

  const translateInterimChunk = async (text: string, targetLabel: string) => {
    try {
      const response = await fetch("/api/translate-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: targetLabel }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.translation) {
          setInterimTranslations((prev) => ({ ...prev, [targetLabel]: data.translation }));
        }
      }
    } catch {
      // leave the previous preview showing if this update fails
    }
  };

  const addTranslateTarget = (code: string) => {
    if (!code) return;
    setTranslateTargets((prev) => (prev.includes(code) ? prev : [...prev, code]));
  };

  const removeTranslateTarget = (code: string) => {
    setTranslateTargets((prev) => prev.filter((c) => c !== code));
    setLiveTranslations((prev) => {
      const opt = SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === code);
      if (!opt) return prev;
      const next = { ...prev };
      delete next[opt.label];
      return next;
    });
  };

  const startVideoCapture = async (kind: "video" | "audio") => {
    const generation = ++captureGenerationRef.current;
    setVideoError("");
    setHasRecordedVideo(false);
    setVideoElapsed(0);
    setShowVideoPreview(false);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    videoChunksRef.current = [];
    videoBlobRef.current = null;
    videoFinalizedRef.current = null;
    pickedFileRef.current = null;
    setUploadedFileName("");

    const mimeType = pickRecordingMimeType(kind);
    if (!mimeType) {
      setVideoError(
        kind === "audio"
          ? "This browser can't record sound. You can record on your phone and add the file afterwards. Transcription will continue."
          : "This browser can't record video. Try sound only, or record on your phone and add the file afterwards. Transcription will continue."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: true } : { video: true, audio: true }
      );
      if (generation !== captureGenerationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      videoStreamRef.current = stream;
      for (const track of stream.getTracks()) track.addEventListener("ended", () => {
        if (recordingActiveRef.current) {
          setVideoError("Camera or microphone capture stopped. Check and download the captured part before continuing.");
          stopRecording();
        }
      }, { once: true });
      if (kind === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // The same rates as call recordings (see recording-limits), so a file
      // stays inside what storage will accept for as long as possible.
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        ...(kind === "video" ? { videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : {}),
      });
      const elapsed = startRecordingClock();
      let recordedBytes = 0;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
        recordedBytes += e.data.size;
        if (recordedBytes > MAX_RECORDING_BYTES && recorder.state === "recording") {
          setVideoError(kind === "video"
            ? "The video reached the most one recording can hold (about 9 minutes). What was recorded is kept and the transcript carries on. For a long meeting, record sound only."
            : "The recording reached the most one recording can hold. What was recorded is kept and the transcript carries on.");
          stopRecording();
        }
      };
      videoFinalizedRef.current = new Promise<void>((resolve) => {
      recorder.onerror = () => {
        setVideoError("Recording was interrupted. Preview or download the captured part before leaving this page.");
        stopRecording();
      };
      recorder.onstop = async () => {
        // Given its length, so it plays back with a seek bar (see webm-duration).
        const blob = await withPlayableDuration(
          new Blob(videoChunksRef.current, { type: containerOf(mimeType) }),
          elapsed()
        );
        videoBlobRef.current = blob;
        setRecordingExtension(extensionFor(blob.type) || "webm");
        if (videoChunksRef.current.length > 0) {
          setHasRecordedVideo(true);
          setVideoPreviewUrl(URL.createObjectURL(blob));
        }
        if (recordingActiveRef.current) {
          setVideoError("The recording stopped unexpectedly. Check the captured part before starting again.");
          stopRecording();
        }
        resolve();
      };
      });
      void videoFinalizedRef.current.catch(() => {});

      videoRecorderRef.current = recorder;
      recorder.start(1000);

      videoTimerRef.current = setInterval(() => {
        setVideoElapsed((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      videoFinalizedRef.current = null;
      videoRecorderRef.current = null;
      videoStreamRef.current?.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
      // Naming the wrong cause sends people into browser settings for a problem
      // that was never a permission, so only say "denied" when it actually was.
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      const missing = error instanceof DOMException && (error.name === "NotFoundError" || error.name === "OverconstrainedError");
      const device = kind === "audio" ? "Microphone" : "Camera";
      setVideoError(
        denied
          ? `${device} access was denied, transcript will still record.`
          : missing
            ? `No ${kind === "audio" ? "microphone" : "camera"} was found, transcript will still record.`
            : `${kind === "audio" ? "Sound" : "Video"} recording couldn't start, transcript will still record.`
      );
    }
  };

  const stopVideoCapture = () => {
    captureGenerationRef.current += 1;
    if (videoRecorderRef.current?.state === "recording") videoRecorderRef.current.stop();
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  };

  const discardVideo = () => {
    videoBlobRef.current = null;
    videoFinalizedRef.current = null;
    videoChunksRef.current = [];
    pickedFileRef.current = null;
    setUploadedFileName("");
    setPickedIsAudio(false);
    setHasRecordedVideo(false);
    setVideoElapsed(0);
    setShowVideoPreview(false);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
  };

  // The way around the browser's limits: the phone's own camera and voice
  // recorder are allowed to keep running with the screen off and the app in the
  // background, which Safari is not. Record there, hand the file over here.
  const attachExistingRecording = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file twice still fires onChange
    if (!file) return;

    setVideoError("");
    if (!extensionFor(file.type)) {
      setVideoError("That file type can't be added. Use a video or sound recording from your phone.");
      return;
    }
    if (file.size > MAX_RECORDING_BYTES) {
      setVideoError("That recording is too large to add (the limit is 45 MB, about 90 minutes of sound or 9 minutes of video). An audio recording is much smaller.");
      return;
    }

    videoChunksRef.current = [];
    videoBlobRef.current = null;
    videoFinalizedRef.current = null;
    pickedFileRef.current = file;
    setRecordingExtension(extensionFor(file.type) || "webm");
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setUploadedFileName(file.name);
    setPickedIsAudio(containerOf(file.type).startsWith("audio/"));
    setHasRecordedVideo(true);
    setVideoElapsed(0);
    setShowVideoPreview(false);
  };

  const isAudioPreview = uploadedFileName ? pickedIsAudio : captureMode === "audio";

  function formatElapsed(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const uploadRecordedVideo = async (): Promise<string | null> => {
    const blob: Blob | null = pickedFileRef.current || videoBlobRef.current;
    if (!blob) return null;
    if (uploadedRecordingRef.current?.blob === blob) return uploadedRecordingRef.current.path;

    // Label the upload with what is actually in it — an MP4 stored as WebM
    // reaches the player as an unplayable file.
    const extension = extensionFor(blob.type);
    if (!extension) throw new Error("That recording is in a format we can't store. Try a different file.");

    setIsUploadingVideo(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again before saving the recording.");

      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("meeting-recordings").upload(path, blob, {
        contentType: containerOf(blob.type),
      });
      if (error) {
        console.error(error);
        throw new Error("The recording didn't upload. Try again, or download it to this device and save the meeting without it.");
      }

      const savedPath = PRIVATE_RECORDING_PREFIX + path;
      uploadedRecordingRef.current = { blob, path: savedPath };
      return savedPath;
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const startRecording = () => {
    if (hasRecordedVideo && captureMode !== "off") {
      setVideoError("A recording is ready. Save or download it, then remove it before starting another capture.");
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    setRecordingError("");

    if (captureMode !== "off" && videoSupported) {
      startVideoCapture(captureMode);
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = recordingLang;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      const currentTargets = translateTargetsRef.current
        .map((code) => SPEECH_LANGUAGE_OPTIONS.find((opt) => opt.code === code))
        .filter((opt): opt is (typeof SPEECH_LANGUAGE_OPTIONS)[number] => !!opt);

      const trimmedInterim = interimText.trim();
      if (trimmedInterim) {
        for (const opt of currentTargets) {
          if (interimTranslateDebounceRef.current[opt.label]) {
            clearTimeout(interimTranslateDebounceRef.current[opt.label]);
          }
          interimTranslateDebounceRef.current[opt.label] = setTimeout(() => {
            translateInterimChunk(trimmedInterim, opt.label);
          }, 350);
        }
      }

      if (finalText.trim()) {
        setTranscript((prev) => (prev ? prev.trim() + " " + finalText.trim() : finalText.trim()));
        setInterimTranslations({});
        for (const opt of currentTargets) {
          if (interimTranslateDebounceRef.current[opt.label]) {
            clearTimeout(interimTranslateDebounceRef.current[opt.label]);
            delete interimTranslateDebounceRef.current[opt.label];
          }
          translateChunk(finalText.trim(), opt.label);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setRecordingError(
          "Microphone access was denied. Check the padlock icon next to the address bar and allow the microphone for this site."
        );
        recordingActiveRef.current = false;
        stopVideoCapture();
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      } else if (event.error === "no-speech" || event.error === "aborted") {
        // benign: recognition.onend restarts it automatically while still recording
      } else {
        setRecordingError(`Recording stopped unexpectedly (${event.error}). Try again.`);
        recordingActiveRef.current = false;
        stopVideoCapture();
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      }
    };

    recognition.onend = () => {
      if (recordingActiveRef.current) {
        recognition.start();
      } else {
        cleanUpTranscript();
      }
    };

    recognitionRef.current = recognition;
    recordingActiveRef.current = true;
    try {
      recognition.start();
    } catch {
      setRecordingError("Couldn't start the microphone. Try again.");
      recordingActiveRef.current = false;
      stopVideoCapture();
      return;
    }
    setIsRecording(true);
    setRecordingElapsed(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingElapsed((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    recordingActiveRef.current = false;
    recognitionRef.current?.stop();
    stopVideoCapture();
    setIsRecording(false);
    setInterimTranslations({});
    Object.values(interimTranslateDebounceRef.current).forEach(clearTimeout);
    interimTranslateDebounceRef.current = {};
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const saveMeeting = async (withRecording: boolean) => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    try {
      if (isRecording) stopRecording();
      if (videoFinalizedRef.current) await videoFinalizedRef.current;
      let videoUrl: string | null = null;
      if (withRecording) {
        try {
          videoUrl = await uploadRecordedVideo();
        } catch (error) {
          setRecordingUploadFailed(true);
          throw error;
        }
      }
      await onProcess(transcriptRef.current, { title, participants, videoUrl });
    } catch (error) { setVideoError(error instanceof Error ? error.message : "Recording wasn't saved. Please try again."); }
    finally { submittingRef.current = false; }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void saveMeeting(true);
  };

  const startLiveSession = async () => {
    setStartingLiveSession(true);
    setLiveSessionError("");
    try {
      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Live session", meetingType }),
      });
      const data = await response.json();
      if (!response.ok || !data.session) throw new Error(data.error || "failed");
      router.push(`/live/${data.session.id}`);
    } catch {
      setLiveSessionError("Couldn't start a live session. Mind trying again?");
    } finally {
      setStartingLiveSession(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <MeetingStatusHeader
        selectedEvent={selectedEvent}
        allEvents={allEvents}
        now={now}
        isRecording={isRecording}
        onSelectEvent={onSelectEvent}
      />
      <MeetingLaunchpad
        title={title}
        setTitle={setTitle}
        participants={participants}
        setParticipants={setParticipants}
        meetingType={meetingType}
        setMeetingType={setMeetingType}
        projectId={projectId}
        setProjectId={setProjectId}
        projects={projects}
        language={recordingLang}
        setLanguage={setRecordingLang}
        starting={startingLiveSession}
        onStart={startLiveSession}
      />

      <details className="surface-card rounded-2xl p-5 sm:p-6">
        <summary className="cursor-pointer list-none text-sm font-semibold">
          Other ways to capture a meeting
          <span className="ml-2 text-xs font-normal text-[var(--muted)]">
            Record this device or paste a transcript
          </span>
        </summary>

        <div className="mt-5 border-t border-[var(--surface-border)] pt-5">
          {recordingSupported && (
            <div className="rounded-2xl border border-[var(--surface-border)] bg-indigo-400/5 p-4">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isCleaning}
                className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:opacity-60 ${
                  isRecording
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-[var(--surface-border)] bg-[var(--background)] hover:border-indigo-400/50 hover:bg-indigo-400/5"
                }`}
              >
                <span
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                    isRecording
                      ? "bg-red-500 text-white shadow-red-500/20"
                      : "bg-[var(--surface-border)] text-[var(--foreground)] shadow-none"
                  }`}
                >
                  {isRecording ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      className="h-4 w-4"
                    >
                      <path
                        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM7 11a5 5 0 0 0 10 0M12 18v3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {isCleaning
                      ? "Cleaning up…"
                      : isRecording
                        ? `Recording ${formatElapsed(recordingElapsed)} · tap to stop`
                        : "Record from this device"}
                  </span>
                  <span className="block text-xs text-[var(--muted)] mt-0.5">
                    Just this browser&apos;s mic, transcribed as you talk
                  </span>
                </span>
              </button>

              {!isRecording && !isCleaning && (
                <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Recording language</span>
                <select
                  value={recordingLang}
                  onChange={(e) => setRecordingLang(e.target.value)}
                  className="text-sm rounded-lg border border-[var(--surface-border)] bg-transparent px-2.5 py-1.5 outline-none"
                >
                  {SPEECH_LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                </div>
              )}

              {recordingError && (
                <p className="mt-2.5 text-xs text-red-500 dark:text-red-400">{recordingError}</p>
              )}
              {/* Not an error: the transcript is complete, only the tidying was skipped. */}
              {cleanupNote && !isCleaning && (
                <p role="status" className="mt-2.5 text-xs text-[var(--muted)]">{cleanupNote}</p>
              )}
            </div>
          )}

          {liveSessionError && (
            <p className="mt-3 text-xs text-red-500 dark:text-red-400">{liveSessionError}</p>
          )}

          <textarea
          ref={transcriptAreaRef}
          placeholder={
            recordingSupported
              ? "Or paste a transcript here, whether it's from Zoom, Teams, or anywhere else"
              : "Enter your meeting notes here or start recording the conversation"
          }
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          className="mt-4 h-72 w-full resize-none rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-3 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          required={!hasRecordedVideo && !isRecording}
          />

        <div className="mt-2.5 mb-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {recordingSupported && videoSupported && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Alongside the transcript, record
              <select
                value={captureMode}
                onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
                disabled={isRecording}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="video">video and sound</option>
                <option value="audio">sound only</option>
                <option value="off">nothing</option>
              </select>
            </label>
          )}

          {!isRecording && (
            <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              <input
                type="file"
                accept={UPLOADABLE_RECORDING_ACCEPT}
                onChange={attachExistingRecording}
                className="sr-only"
              />
              Or add a recording from your phone
            </label>
          )}
        </div>

        {captureMode === "audio" && !isRecording && (
          <p className="mb-1 text-xs text-[var(--muted)]">
            Sound only is much smaller and far less likely to be cut short on a phone.
          </p>
        )}

        {captureMode === "video" && isRecording && (
          <div className="relative w-40 mb-2">
            {/* Mirrored like a bathroom mirror while you record yourself. The
                file this saves is not: it keeps the picture the camera saw. */}
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-40 -scale-x-100 rounded-lg border border-[var(--surface-border)]"
            />
            <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              REC {formatElapsed(videoElapsed)}
            </span>
          </div>
        )}

        {captureMode === "audio" && isRecording && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[11px] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Recording sound · {formatElapsed(videoElapsed)}
          </div>
        )}

        {!isRecording && hasRecordedVideo && (
          <div className="mb-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {uploadedFileName
                  ? `Ready to attach: ${uploadedFileName}`
                  : `${captureMode === "audio" ? "Sound" : "Video"} recorded (${formatElapsed(videoElapsed)})`}
              </span>
              <button
                type="button"
                onClick={() => setShowVideoPreview((v) => !v)}
                className="hover:underline"
              >
                {showVideoPreview ? "Hide preview" : "Preview"}
              </button>
              <button
                type="button"
                onClick={discardVideo}
                className="text-red-500 dark:text-red-400 hover:underline"
              >
                Discard
              </button>
            </div>
            {showVideoPreview && videoPreviewUrl && (
              isAudioPreview ? (
                <audio controls src={videoPreviewUrl} className="mt-2 w-64" />
              ) : (
                <video
                  controls
                  playsInline
                  src={videoPreviewUrl}
                  className="w-48 rounded-lg border border-[var(--surface-border)] mt-2"
                />
              )
            )}
          </div>
        )}

        {videoError && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{videoError}</p>}
        {wakeWarning && <p role="status" className="mb-2 text-xs text-amber-700 dark:text-amber-300">{wakeWarning}</p>}
        {isRecording && <p className="mb-2 text-xs text-[var(--muted)]">Keep this page visible and the screen unlocked. Locking your phone or switching apps can interrupt recording.</p>}
        {!isRecording && videoPreviewUrl && (
          <a href={videoPreviewUrl} download={`memovalet-recording.${recordingExtension}`} className="mb-3 inline-block text-sm font-semibold text-indigo-600 underline dark:text-indigo-300">Download recording to this device</a>
        )}

        {isUploadingVideo && <p className="text-xs text-[var(--muted)] mb-2">Uploading recording…</p>}

        {!recordingSupported && (
          <p className="text-xs text-[var(--muted)]">
            Live recording needs Chrome or Edge, so paste a transcript instead.
          </p>
        )}

        {recordingSupported && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>Live translate to</span>
            <select
              value=""
              onChange={(e) => addTranslateTarget(e.target.value)}
              className="rounded-lg border border-[var(--surface-border)] bg-transparent px-2 py-1.5 outline-none"
            >
              <option value="">+ Add language</option>
              {SPEECH_LANGUAGE_OPTIONS.filter((opt) => !translateTargets.includes(opt.code)).map(
                (opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                )
              )}
            </select>
            {translateTargets.map((code) => {
              const opt = SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === code);
              if (!opt) return null;
              return (
                <span
                  key={code}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-indigo-400/5 pl-2.5 pr-1.5 py-1"
                >
                  {opt.label}
                  <button
                    type="button"
                    onClick={() => removeTranslateTarget(code)}
                    className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-white/10"
                    aria-label={`Remove ${opt.label}`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {translateTargets.length > 0 && (
          <div className="space-y-2">
            {translateTargets.map((code) => {
              const opt = SPEECH_LANGUAGE_OPTIONS.find((o) => o.code === code);
              if (!opt) return null;
              const text = liveTranslations[opt.label];
              const interim = interimTranslations[opt.label];
              if (!text && !interim) return null;
              return (
                <div
                  key={code}
                  className="rounded-xl border border-[var(--surface-border)] bg-indigo-400/5 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
                    Live translation, {opt.label}
                  </p>
                  <p className="text-sm leading-relaxed">
                    {text}
                    {interim && (
                      <span className="text-[var(--muted)] italic">
                        {text ? " " : ""}
                        {interim}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}

          <button
            type="submit"
            disabled={loading || isUploadingVideo}
            className="brand-gradient-bg mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90 active:scale-[0.99] disabled:opacity-80"
          >
            {(loading || isUploadingVideo) && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {isUploadingVideo
              ? "Uploading recording…"
              : loading
                ? "Generating summary…"
                : "Save meeting and generate summary"}
          </button>
          {recordingUploadFailed && !isUploadingVideo && (
            // A recording that will not upload must never cost the meeting.
            // Download it above first; this saves everything else.
            <button
              type="button"
              disabled={loading}
              onClick={() => void saveMeeting(false)}
              className="mt-2 w-full rounded-xl border border-[var(--surface-border)] py-2.5 text-sm font-medium hover:bg-[var(--surface-border)] disabled:opacity-60"
            >
              Save the meeting without the recording
            </button>
          )}
        </div>
      </details>
    </form>
  );
}
