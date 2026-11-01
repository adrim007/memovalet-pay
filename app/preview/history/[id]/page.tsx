import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ResultsDisplay from "@/components/ResultsDisplay";
import TranscriptViewer from "@/components/TranscriptViewer";
import { getDecisionContext } from "@/lib/hackathon/meeting-memory";

// Sample dates are stored as YYYY MM DD; the page shows them in words so no dashes appear.
const inWords = (date: string, withYear = false) => /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
  : date;

export default async function SampleMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = getDecisionContext(id);
  if (!meeting) notFound();
  const transcript = id === "launch-date"
    ? "Maya: We need to settle the pilot launch.\nPriya: Let's launch on 28 October and invite customers first.\nAlex: That gives support time to review feedback before a wider release.\nMaya: Agreed. Priya, finish the onboarding copy by 20 October. Alex, draft the pilot support playbook by 21 October."
    : "Maya: We need to keep pricing simple.\nPriya: Let's use one monthly plan and a short free trial.\nMaya: Agreed. A clear choice matters more than adding tiers before validation.";
  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <div className="mx-auto max-w-3xl">
        <p className="mb-5 text-xs text-[var(--muted)]">Sample workspace · fictional meeting record</p>
        <Link href="/preview?scenario=launch" className="mb-6 inline-block text-sm font-semibold text-[var(--muted)]">← Back to Home</Link>
        <div className="mb-6"><h1 className="text-3xl font-extrabold tracking-tight">{meeting.meeting}</h1><p className="mt-2 text-sm text-[var(--muted)]">Maya, Priya, Alex · {inWords(meeting.date, true)}</p></div>
        <div className="space-y-6">
          <ResultsDisplay data={{ meeting_summary: meeting.context, key_decisions: [meeting.decision], action_items: meeting.relatedOpenActions.map(a => ({ task: a.task, owner: a.owner, due_date: inWords(a.due) })) }} />
          <TranscriptViewer transcript={transcript} />
          <Link href="/preview/ask?scenario=launch" className="brand-gradient-bg inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white">Ask about this meeting →</Link>
        </div>
      </div>
    </AppShell>
  );
}
