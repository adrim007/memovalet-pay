import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import HomeWorkspace from "@/components/HomeWorkspace";
import { previewActiveProject, previewActiveTask, previewRecentDocuments, previewScheduleEvents } from "@/lib/homePreviewData";

export const dynamic = "force-dynamic";

export default function PrototypePage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_PRODUCT_PREVIEW !== "1"
  ) {
    notFound();
  }

  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <HomeWorkspace
        firstName="Maya"
        previewMode
        totalMeetings={12}
        meetingsThisWeek={3}
        totalActionItems={7}
        totalTasksSent={2}
        activeProject={previewActiveProject}
        activeTask={previewActiveTask}
        recentDocuments={previewRecentDocuments}
        scheduleEvents={previewScheduleEvents}
      />
    </AppShell>
  );
}
