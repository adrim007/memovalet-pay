import Link from "next/link";
import Avatar from "@/components/Avatar";
import { parseParticipants } from "@/lib/participants";
import { LightMeeting, TaskAssignment } from "@/lib/types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export type ActivityItem =
  | { kind: "meeting"; created_at: string; meeting: LightMeeting }
  | { kind: "task"; created_at: string; task: TaskAssignment };

export function buildActivityFeed(
  meetings: LightMeeting[],
  tasks: TaskAssignment[],
  limit: number
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...meetings.map((meeting): ActivityItem => ({ kind: "meeting", created_at: meeting.created_at, meeting })),
    ...tasks.map((task): ActivityItem => ({ kind: "task", created_at: task.created_at, task })),
  ];

  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

function MeetingCard({ meeting }: { meeting: LightMeeting }) {
  const actionItemCount = meeting.action_items ? meeting.action_items.length : 0;
  const decisionCount = meeting.decisions ? meeting.decisions.length : 0;

  return (
    <Link
      href={`/history/${meeting.id}`}
      className="group flex items-center gap-3 border-b border-[var(--surface-border)] py-3.5 last:border-b-0"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-600 dark:text-indigo-300">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
          <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h8A1.5 1.5 0 0 1 14 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 16.5v-9ZM14 10l6-3v10l-6-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{meeting.title}</h3>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[var(--muted)]">
          {meeting.participants && (
            <>
              <div className="flex -space-x-1.5">
                {parseParticipants(meeting.participants).slice(0, 3).map((name, i) => (
                  <Avatar key={i} name={name} size="xs" />
                ))}
              </div>
              <span className="truncate">{meeting.participants}</span>
            </>
          )}
          {!meeting.participants && <span>Meeting saved</span>}
        </div>
      </div>
      <span className="hidden text-xs text-[var(--muted)] sm:block">
        {decisionCount + actionItemCount > 0
          ? `${decisionCount + actionItemCount} outcomes · `
          : ""}
        {formatDate(meeting.created_at)}
      </span>
      <span className="text-[var(--muted)] transition group-hover:translate-x-1">›</span>
    </Link>
  );
}

function TaskCard({ task }: { task: TaskAssignment }) {
  return (
    <Link
      href="/tasks"
      className="group flex items-center gap-3 border-b border-[var(--surface-border)] py-3.5 last:border-b-0"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/10 text-fuchsia-600 dark:text-fuchsia-300">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="h-4 w-4"
          >
            <path
              d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{task.title}</h3>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">
          Sent to {task.recipient_email}
        </p>
      </div>
      <span className="hidden text-xs text-[var(--muted)] sm:block">
        {task.status === "done" ? "Completed" : "Pending"} · {formatDate(task.created_at)}
      </span>
      <span className="text-[var(--muted)] transition group-hover:translate-x-1">›</span>
    </Link>
  );
}

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="surface-card dashed-card rounded-2xl p-10 text-center mb-8">
        <p className="font-medium mb-1">Nothing here yet</p>
        <p className="text-sm text-[var(--muted)]">
          Process a meeting or send a task and it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-8" aria-labelledby="recent-heading">
      <div data-tour="recent-activity" className="flex items-center justify-between mb-3">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recent activity
        </h2>
        <Link
          href="/history"
          className="text-sm font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 transition"
        >
          See all →
        </Link>
      </div>

      <div className="surface-card rounded-2xl px-5">
        {items.map((item) =>
          item.kind === "meeting" ? (
            <MeetingCard key={`meeting-${item.meeting.id}`} meeting={item.meeting} />
          ) : (
            <TaskCard key={`task-${item.task.id}`} task={item.task} />
          )
        )}
      </div>
    </section>
  );
}
