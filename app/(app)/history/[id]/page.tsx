import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMeeting, listUserProjects } from "@/lib/database";
import MeetingProjectPicker from "@/components/MeetingProjectPicker";
import { toMeetingResult } from "@/lib/types";
import { getAuthedUser } from "@/lib/auth";
import MeetingLanguageSwitcher from "@/components/MeetingLanguageSwitcher";
import MeetingChat from "@/components/MeetingChat";
import MeetingFollowThrough from "@/components/MeetingFollowThrough";
import MeetingSharePack from "@/components/MeetingSharePack";
import MeetingTitleEditor from "@/components/MeetingTitleEditor";
import MeetingNotes from "@/components/MeetingNotes";
import MeetingSummaryRecovery from "@/components/MeetingSummaryRecovery";
import DeleteButton from "@/components/DeleteButton";
import ShareWithUser from "@/components/ShareWithUser";
import PriorityPicker from "@/components/PriorityPicker";
import { isAudioRecording, parseRecordingPath } from "@/lib/recording-path";

// The follow through panel is still in preview, so the live site only shows it when previews are on.
const followThroughOn = process.env.NODE_ENV !== "production" || process.env.ENABLE_PRODUCT_PREVIEW === "1";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  let meeting;
  try {
    meeting = await getMeeting(id);
  } catch (err) {
    console.error("Failed to load meeting", err);
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href="/history"
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition mb-6 inline-flex items-center gap-1"
        >
          ← Back to history
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
          Couldn&apos;t load this meeting. Check that Supabase is configured in .env.local.
        </div>
      </div>
    );
  }

  if (!meeting) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/history"
        className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition mb-6 inline-flex items-center gap-1"
      >
        ← Back to history
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <MeetingTitleEditor meetingId={meeting.id} initialTitle={meeting.title} />
          {meeting.participants && (
            <p className="text-sm text-[var(--muted)] mt-1">{meeting.participants}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xs text-[var(--muted)] pt-1">{formatDate(meeting.created_at)}</span>
          <div className="flex items-center gap-2">
            <a
              href={`/api/meetings/${meeting.id}/pdf`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--surface-border)] transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
            >
              Download PDF
            </a>
            {/* Team members can open a meeting they don't own; only the owner
                can mark or delete it. */}
            {meeting.user_id === user.id && (
              <PriorityPicker
                kind="meeting"
                id={meeting.id}
                value={meeting.priority}
                name={meeting.title}
              />
            )}
            {/* Send it to another MemoValet account: it lands in their library
                rather than as an email they have to keep. */}
            {meeting.user_id === user.id && <ShareWithUser itemType="meeting" itemId={meeting.id} />}
            {meeting.user_id === user.id && (
              <DeleteButton
                kind="meeting"
                id={meeting.id}
                noun="meeting"
                name={meeting.title}
                detail="Its recording, summary and tasks go with it."
                goTo="/history"
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {meeting.metadata?.summary_status && meeting.metadata.summary_status !== "ready" && (
          <MeetingSummaryRecovery meetingId={meeting.id} hasTranscript={meeting.transcript.trim().length >= 20} />
        )}
        <MeetingProjectPicker meetingId={meeting.id} current={meeting.project_id} projects={await listUserProjects()} />
        <MeetingLanguageSwitcher
          meetingId={meeting.id}
          original={toMeetingResult(meeting)}
          transcript={meeting.transcript}
        />
        {meeting.video_url && (
          <div className="surface-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)] mb-3">
              Recording
            </h2>
            {(meeting.metadata?.recording_urls?.length ? meeting.metadata.recording_urls : [meeting.video_url]).map((recording, index) => <div key={recording} className="mb-4">
              <p className="mb-2 text-sm font-medium">Recording {index + 1}</p>
            {isAudioRecording(recording) ? (
              // A sound-only recording in a <video> is a black rectangle with a
              // play button; give it the player it actually needs.
              <audio controls preload="metadata" src={`/api/meetings/${meeting.id}/recording?clip=${index}`} className="w-full" />
            ) : (
              <video controls playsInline preload="metadata" src={parseRecordingPath(recording) ? `/api/meetings/${meeting.id}/recording?clip=${index}` : recording} className="w-full rounded-xl" />
            )}
            </div>)}
            <p className="mt-2 text-xs text-[var(--muted)]">{parseRecordingPath(meeting.video_url) ? "Private recording · access is checked before playback." : "Older recording · this may use a public link."}</p>
          </div>
        )}
        {!meeting.video_url && (
          // Said out loud: with no recording the page used to show nothing at
          // all, and people went looking for a player that was never there.
          <div className="surface-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
              Recording
            </h2>
            <p className="text-sm">This meeting wasn&apos;t recorded, so there is nothing to play back.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Calls are only recorded when the host presses Record during the call and everyone is told. The recording then appears here.
            </p>
          </div>
        )}
        {followThroughOn && meeting.user_id === user.id && <MeetingFollowThrough key={meeting.id} meetingId={meeting.id} title={meeting.title} />}
        <MeetingNotes meetingId={meeting.id} initialNotes={meeting.notes} />
        <MeetingSharePack
          meetingId={meeting.id}
          participants={meeting.participants}
          hasRecording={!!meeting.video_url}
        />
        <MeetingChat meetingId={meeting.id} />
      </div>
    </div>
  );
}
