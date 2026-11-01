"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import { LightMeeting } from "@/lib/types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PersonDetailClient({
  name,
  meetings,
}: {
  name: string;
  meetings: LightMeeting[];
}) {
  const totalActionItems = meetings.reduce((sum, m) => sum + (m.action_items?.length || 0), 0);
  const allDecisions = meetings.flatMap((m) =>
    (m.decisions || []).map((decision) => ({ decision, meetingTitle: m.title, meetingId: m.id }))
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/people" className="text-sm text-[var(--muted)] hover:text-current transition">
        ← People
      </Link>

      <div className="flex items-center gap-3 mt-3 mb-6">
        <Avatar name={name} size="sm" />
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="surface-card rounded-2xl p-4">
          <p className="text-2xl font-bold">{meetings.length}</p>
          <p className="text-xs text-[var(--muted)]">Meetings together</p>
        </div>
        <div className="surface-card rounded-2xl p-4">
          <p className="text-2xl font-bold">{totalActionItems}</p>
          <p className="text-xs text-[var(--muted)]">Action items</p>
        </div>
      </div>

      {allDecisions.length > 0 && (
        <div className="surface-card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">Decisions</h2>
          <ul className="space-y-2">
            {allDecisions.map((d, i) => (
              <li key={i} className="text-sm">
                <span>{d.decision}</span>{" "}
                <Link
                  href={`/history/${d.meetingId}`}
                  className="text-[var(--muted)] hover:text-current transition"
                >
                  From {d.meetingTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-sm font-semibold mb-3">Meetings</h2>
      <div className="space-y-3">
        {meetings.map((meeting) => (
          <Link
            key={meeting.id}
            href={`/history/${meeting.id}`}
            className="surface-card block rounded-2xl p-5 transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold truncate">{meeting.title}</h3>
              <span className="text-xs text-[var(--muted)] shrink-0">
                {formatDate(meeting.created_at)}
              </span>
            </div>
            {meeting.summary && (
              <p className="text-sm text-[var(--muted)] line-clamp-2 mt-1">{meeting.summary}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
