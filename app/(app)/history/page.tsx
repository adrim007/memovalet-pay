import Link from "next/link";
import { redirect } from "next/navigation";
import { listMeetings, listTeamMeetings, listUserTeams } from "@/lib/database";
import { getAuthedUser } from "@/lib/auth";
import { isUKSpelling, pickSpelling } from "@/lib/locale";
import MeetingHistoryList from "@/components/MeetingHistoryList";
import { SectionStarter } from "@/components/AssistantStarter";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  const useUK = await isUKSpelling();

  const teamsPromise = listUserTeams(user.id);
  const defaultMeetingsPromise: Promise<Awaited<ReturnType<typeof listMeetings>>> | null = teamParam
    ? null
    : listMeetings();

  const teams = await teamsPromise;
  const activeTeam = teamParam ? teams.find((t) => t.id === teamParam) || null : null;

  let meetings: Awaited<ReturnType<typeof listMeetings>> = [];
  let loadError = false;

  try {
    meetings = activeTeam
      ? await listTeamMeetings(activeTeam.id)
      : await (defaultMeetingsPromise as Promise<Awaited<ReturnType<typeof listMeetings>>>);
  } catch (err) {
    console.error("Failed to load meeting history", err);
    loadError = true;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {activeTeam ? `${activeTeam.name} library` : "Meeting library"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Revisit recordings, transcripts, translations, notes, decisions, and action items.
          </p>
        </div>
        <Link
          href={activeTeam ? `/meeting?team=${activeTeam.id}` : "/meeting"}
          className="text-sm font-medium px-3.5 py-2 rounded-xl brand-gradient-bg text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90"
        >
          + New Meeting
        </Link>
      </div>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
          Couldn&apos;t load meeting history. Check that Supabase is configured in .env.local and
          the migration has been run.
        </div>
      )}

      {!loadError && meetings.length === 0 && (
        <SectionStarter
          icon="meeting"
          eyebrow="Your searchable meeting memory"
          title="Your first meeting pack will live here."
          body={`Once you ${pickSpelling(useUK, "summarize", "summarise")} a meeting, its recording, transcript, translations, notes, decisions, and tasks stay together.`}
          primaryHref={activeTeam ? `/meeting?team=${activeTeam.id}` : "/meeting"}
          primaryLabel="Start or import a meeting"
          secondaryHref="/settings#integrations"
          secondaryLabel="Connect a calendar"
          points={["Search the exact conversation", "Share a link or PDF", "Return to decisions and follow-through"]}
        />
      )}

      {!loadError && meetings.length > 0 && (
        <MeetingHistoryList meetings={meetings} userId={user.id} />
      )}
    </div>
  );
}
