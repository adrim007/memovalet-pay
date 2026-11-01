"use client";

import { useEffect, useRef, useState } from "react";
import TranscriptForm from "@/components/TranscriptForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import ExportsDisplay from "@/components/ExportsDisplay";
import ExportOptionsPanel, { IntegrationConnectable, IntegrationStatus } from "@/components/ExportOptionsPanel";
import UpcomingMeetings from "@/components/UpcomingMeetings";
import ScheduleMeetingCard from "@/components/ScheduleMeetingCard";
import { JoinMeetingCard } from "@/components/MeetingLaunchpad";
import { GlobeHemisphereWest, Sparkle, UsersThree } from "@phosphor-icons/react";
import { getMeetingStatus } from "@/lib/meetingStatus";
import {
  AttendeeInfo,
  ExportOptions,
  ExportResults,
  MeetingResult,
  MeetingType,
  UpcomingCalendarEvent,
} from "@/lib/types";

interface HomeClientProps {
  activeTeamId: string | null;
  activeTeamName?: string | null;
  googleConnected: boolean;
  integrations: IntegrationStatus;
  connectable?: IntegrationConnectable;
}

export default function HomeClient({
  activeTeamId,
  activeTeamName,
  googleConnected,
  integrations,
  connectable = {},
}: HomeClientProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [results, setResults] = useState<MeetingResult | null>(null);
  const [exports, setExports] = useState<ExportResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState<{ id: string; message: string } | null>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const processingRef = useRef(false);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("general");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<UpcomingCalendarEvent | null>(null);
  const [allEvents, setAllEvents] = useState<UpcomingCalendarEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [focusSignal, setFocusSignal] = useState(0);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState("");
  const prevStatusRef = useRef<string>("unknown");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    // Opt-in: a new Doc after every meeting should be a choice, not a surprise.
    exportToDocs: false,
    exportToTrello: integrations.trello,
    exportToSlack: integrations.slack,
    exportToNotion: integrations.notion,
    emailAttendees: true,
  });

  const handleToggleExport = (key: keyof ExportOptions, value: boolean) => {
    setExportOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectEvent = (event: UpcomingCalendarEvent) => {
    setSelectedEvent(event);
    setTitle(event.title);
    setParticipants(event.attendees.map((a) => a.name).join(", "));
    setAttendees(event.attendees);
  };

  useEffect(() => {
    if (!selectedEvent) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) {
      prevStatusRef.current = "unknown";
      return;
    }
    const status = getMeetingStatus(selectedEvent, now);
    if (prevStatusRef.current === "live" && status === "ended") {
      setFocusSignal((n) => n + 1);
    }
    prevStatusRef.current = status;
  }, [selectedEvent, now]);

  const handleProcess = async (
    transcript: string,
    metadata?: { title?: string; participants?: string; videoUrl?: string | null }
  ) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setError("");
    setResults(null);
    setExports(null);
    setSavedNotice(null);

    try {
      const fingerprint = JSON.stringify({ transcript, ...metadata, meetingType, teamId: activeTeamId, projectId });
      if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
      const response = await fetch("/api/process-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestRef.current.id,
          transcript,
          ...metadata,
          ...exportOptions,
          attendees,
          meetingType,
          teamId: activeTeamId,
          projectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process");
      }

      setSavedNotice({ id: data.meetingId, message: data.warning || "Your meeting is saved in History." });
      if (data.summaryStatus === "ready") setResults(data);

      if (data.exports) {
        setExports(data.exports);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong on our end, mind giving it another try?"
      );
    } finally {
      processingRef.current = false;
      setLoading(false);
    }
  };

  const handleJoinMeeting = () => {
    const value = joinValue.trim();
    if (!value) return;

    let sessionId = value;
    try {
      const parsed = new URL(value, window.location.origin);
      const match = parsed.pathname.match(/^\/live\/([^/]+)\/?$/);
      if (match) sessionId = decodeURIComponent(match[1]);
    } catch {
      // A room code is also valid, so continue with the original value.
    }

    if (!sessionId || sessionId.includes("/") || sessionId.includes(" ")) {
      setJoinError("That meeting link or code doesn’t look right.");
      return;
    }

    setJoinError("");
    window.location.assign(`/live/${encodeURIComponent(sessionId)}`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {activeTeamName && (
        <p className="text-[var(--muted)] mb-6 text-base">
          Viewing the {activeTeamName} workspace.
        </p>
      )}

      {!googleConnected && !bannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/30 bg-indigo-400/5 px-4 py-3 mb-5">
          <p className="text-sm">
            Want calendar detection or Gmail sending?{" "}
            <a href="/settings" className="font-medium text-indigo-500 dark:text-indigo-400 hover:underline">
              Connect Google in Settings
            </a>
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="text-[var(--muted)] hover:text-current transition shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
          {error}
        </div>
      )}
      {savedNotice && (
        <div role="status" className="mb-6 rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-4 py-3 text-sm">
          {savedNotice.message}{" "}
          <a className="font-semibold underline" href={`/history/${savedNotice.id}`}>Open saved meeting</a>
        </div>
      )}

      <header className="mb-7">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          <Sparkle size={16} weight="fill" />
          Meetings without language barriers
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Meetings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          Start here, invite your team, and let everyone speak in the language that feels natural.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <UsersThree size={17} weight="duotone" className="text-indigo-500" />
            Group calls for up to 50 people
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GlobeHemisphereWest size={17} weight="duotone" className="text-indigo-500" />
            Live captions in each person&apos;s language
          </span>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)] lg:gap-8">
        <div className="min-w-0">
          <TranscriptForm
            onProcess={handleProcess}
            loading={loading}
            title={title}
            setTitle={setTitle}
            participants={participants}
            setParticipants={setParticipants}
            meetingType={meetingType}
            setMeetingType={setMeetingType}
            projectId={projectId}
            setProjectId={setProjectId}
            focusSignal={focusSignal}
            selectedEvent={selectedEvent}
            allEvents={allEvents}
            now={now}
            onSelectEvent={handleSelectEvent}
          />
        </div>

        <aside className="space-y-6">
          <JoinMeetingCard value={joinValue} onChange={setJoinValue} onJoin={handleJoinMeeting} />
          {joinError && (
            <p className="-mt-3 text-xs font-medium text-red-500 dark:text-red-400">{joinError}</p>
          )}

          <UpcomingMeetings
            onSelect={handleSelectEvent}
            onEventsChange={setAllEvents}
            selectedId={selectedEvent?.id ?? null}
          />

          <ScheduleMeetingCard onScheduled={handleSelectEvent} />

          {!loading && !results && (
            <ExportOptionsPanel
              options={exportOptions}
              onToggle={handleToggleExport}
              attendees={attendees}
              integrations={integrations}
              connectable={connectable}
            />
          )}
        </aside>
      </div>

      {(loading || results) && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {loading && <ResultsSkeleton />}
          {!loading && results && (
            <>
              <ResultsDisplay data={results} emailActions />
              <ExportsDisplay exports={exports} />
            </>
          )}
        </div>
      )}
    </div>
  );
}


function ResultsSkeleton() {
  return (
    <div className="surface-card rounded-2xl p-6 md:p-7 space-y-6 animate-pulse">
      <div className="h-4 w-24 rounded bg-[var(--surface-border)]" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[var(--surface-border)]" />
        <div className="h-3 w-5/6 rounded bg-[var(--surface-border)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--surface-border)]" />
      </div>
      <div className="space-y-2">
        <div className="h-10 w-full rounded-xl bg-[var(--surface-border)]" />
        <div className="h-10 w-full rounded-xl bg-[var(--surface-border)]" />
        <div className="h-10 w-full rounded-xl bg-[var(--surface-border)]" />
      </div>
    </div>
  );
}
