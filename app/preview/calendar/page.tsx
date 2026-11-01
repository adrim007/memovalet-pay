import AppShell from "@/components/AppShell";
import LibraryTabs from "@/components/LibraryTabs";
import WorkCalendar from "@/components/WorkCalendar";
import HackathonCalendarFlow from "@/components/HackathonCalendarFlow";

export default async function CalendarPreviewPage({ searchParams }: { searchParams: Promise<{ source?: string; scenario?: string }> }) {
  const { source, scenario } = await searchParams;
  return <AppShell userEmail="maya@example.com" userName="Maya"><LibraryTabs base="/preview" />{scenario === "launch" ? <HackathonCalendarFlow /> : <WorkCalendar previewMode={source !== "api"} />}</AppShell>;
}
