import { MeetingResult } from "@/lib/types";
import Avatar from "@/components/Avatar";
import FollowUpEmailActions from "@/components/FollowUpEmailActions";

const priorityStyles: Record<string, string> = {
  high: "bg-rose-500/10 text-rose-500 dark:text-rose-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const style =
    priorityStyles[priority.toLowerCase()] || "bg-[var(--surface-border)] text-[var(--muted)]";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>{priority}</span>
  );
}

// emailActions: only in the owner's own views — the public share page shows
// the meeting to others, who aren't the ones sending the follow-up.
export default function ResultsDisplay({ data, emailActions = false }: { data: MeetingResult | null; emailActions?: boolean }) {
  if (!data) return null;

  const { meeting_summary, key_decisions, action_items, follow_up_email, metadata } = data;

  return (
    <div className="surface-card rounded-2xl p-6 md:p-7 space-y-7 shadow-xl shadow-indigo-500/5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Your Summary
        </h2>
        {metadata && (
          <div className="text-xs text-[var(--muted)] flex gap-3">
            {metadata.duration && <span>{metadata.duration}</span>}
            {metadata.sentiment && <span>{metadata.sentiment}</span>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
          Summary
        </h3>
        <p className="text-sm leading-relaxed">{meeting_summary}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
          Key Decisions
        </h3>
        <ul className="space-y-1.5">
          {key_decisions?.map((d: string, i: number) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="brand-gradient-text mt-0.5">✓</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
          Action Items
        </h3>
        <ul className="space-y-2">
          {action_items?.map((item, i: number) => (
            <li
              key={i}
              className="rounded-xl border border-[var(--surface-border)] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
            >
              <div className="flex items-center gap-2.5 text-sm min-w-0">
                {item.owner && <Avatar name={item.owner} size="xs" />}
                <div className="min-w-0">
                  <span className="font-medium">{item.task}</span>
                  {item.owner && <span className="text-[var(--muted)]"> · {item.owner}</span>}
                  {item.due_date && (
                    <span className="text-[var(--muted)]"> · due {item.due_date}</span>
                  )}
                </div>
              </div>
              <PriorityBadge priority={item.priority} />
            </li>
          ))}
        </ul>
      </div>

      {follow_up_email && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
            Follow Up Email
          </h3>
          <div className="rounded-xl border border-[var(--surface-border)] p-4">
            <p className="text-sm font-medium mb-2">{follow_up_email.subject}</p>
            <p className="text-sm text-[var(--muted)] whitespace-pre-line leading-relaxed">
              {follow_up_email.body}
            </p>
            {emailActions && <FollowUpEmailActions subject={follow_up_email.subject || ""} body={follow_up_email.body || ""} />}
          </div>
        </div>
      )}
    </div>
  );
}
