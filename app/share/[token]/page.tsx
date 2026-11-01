import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { toMeetingResult, SavedMeeting } from "@/lib/types";
import ResultsDisplay from "@/components/ResultsDisplay";
import TranscriptViewer from "@/components/TranscriptViewer";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function SharedMeetingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let meeting: SavedMeeting | null = null;

  try {
    const supabase = createServiceClient();
    const response = await supabase.from("meetings").select("*").eq("share_token", token).single();

    if (!response.error) {
      meeting = response.data;
    }
  } catch (err) {
    console.error("Failed to load shared meeting", err);
  }

  if (!meeting) {
    notFound();
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 md:px-10 md:py-16">
      <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
      <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />

      <div className="relative max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-xl brand-gradient-bg shadow-lg shadow-indigo-500/20 flex items-center justify-center text-white font-bold text-sm">
            MF
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Meeting<span className="brand-gradient-text">Flow</span>
          </h1>
        </div>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{meeting.title}</h2>
            {meeting.participants && (
              <p className="text-sm text-[var(--muted)] mt-1">{meeting.participants}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-xs text-[var(--muted)] pt-1">
              {formatDate(meeting.created_at)}
            </span>
            <a
              href={`/api/share/${token}/pdf`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--surface-border)] transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
            >
              Download PDF
            </a>
          </div>
        </div>

        <div className="space-y-6">
          <ResultsDisplay data={toMeetingResult(meeting)} />
          <TranscriptViewer transcript={meeting.transcript} />
        </div>

        <p className="text-xs text-[var(--muted)] text-center mt-6">
          Shared via MemoValet (view only)
        </p>
      </div>
    </div>
  );
}
