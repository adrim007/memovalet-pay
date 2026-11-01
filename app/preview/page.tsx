import AppShell from "@/components/AppShell";
import HomeWorkspace from "@/components/HomeWorkspace";
import HackathonHomeFlow from "@/components/HackathonHomeFlow";
import { previewActiveProject, previewActiveTask, previewRecentDocuments, previewScheduleEvents } from "@/lib/homePreviewData";

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; tour?: string; scenario?: string }>;
}) {
  const { state, tour, scenario } = await searchParams;
  if (scenario === "launch") return <AppShell userEmail="maya@example.com" userName="Maya"><HackathonHomeFlow /></AppShell>;
  const showExamples = state !== "empty";

  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <HomeWorkspace
        firstName="Maya"
        accountType="business"
        onboarding={{ userId: "preview-maya", showInitially: state === "empty", replayRequested: tour === "1", preview: true }}
        previewMode={showExamples}
        totalMeetings={showExamples ? 12 : 0}
        meetingsThisWeek={showExamples ? 3 : 0}
        totalActionItems={showExamples ? 7 : 0}
        totalTasksSent={showExamples ? 2 : 0}
        activeProject={showExamples ? previewActiveProject : null}
        activeTask={showExamples ? previewActiveTask : null}
        recentDocuments={showExamples ? previewRecentDocuments : []}
        scheduleEvents={showExamples ? previewScheduleEvents : []}
      />
    </AppShell>
  );
}
