"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SavedMeeting } from "@/lib/types";
import Avatar from "@/components/Avatar";
import DeleteButton from "@/components/DeleteButton";
import { parseParticipants } from "@/lib/participants";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupLabel(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(date, now)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";

  const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) return "This week";

  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupMeetingsByDate(
  meetings: SavedMeeting[]
): { label: string; meetings: SavedMeeting[] }[] {
  const groups: { label: string; meetings: SavedMeeting[] }[] = [];

  for (const meeting of meetings) {
    const label = groupLabel(meeting.created_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.meetings.push(meeting);
    } else {
      groups.push({ label, meetings: [meeting] });
    }
  }

  return groups;
}

function getSearchableText(meeting: SavedMeeting): string {
  const parts = [
    meeting.title,
    meeting.participants || "",
    meeting.summary || "",
    meeting.transcript || "",
    (meeting.decisions || []).join(" "),
    (meeting.action_items || []).map((item) => item.task + " " + (item.owner || "")).join(" "),
    meeting.follow_up_email ? meeting.follow_up_email.subject || "" : "",
    meeting.follow_up_email ? meeting.follow_up_email.body || "" : "",
  ];

  return parts.join(" ").toLowerCase();
}

function getTranscriptSnippet(meeting: SavedMeeting, query: string): string | null {
  if (!meeting.transcript) return null;

  const lower = meeting.transcript.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return null;

  const alreadyVisible =
    meeting.title.toLowerCase().includes(query.toLowerCase()) ||
    (meeting.summary && meeting.summary.toLowerCase().includes(query.toLowerCase()));
  if (alreadyVisible) return null;

  const start = Math.max(0, idx - 40);
  const end = Math.min(meeting.transcript.length, idx + query.length + 40);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < meeting.transcript.length ? "…" : "";

  return prefix + meeting.transcript.slice(start, end).trim() + suffix;
}

export default function MeetingHistoryList({
  meetings: initialMeetings,
  userId,
}: {
  meetings: SavedMeeting[];
  userId: string;
}) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return meetings;

    return meetings.filter((m) => getSearchableText(m).includes(q));
  }, [meetings, trimmedQuery]);

  const groups = useMemo(() => groupMeetingsByDate(filtered), [filtered]);

  return (
    <div>
      {meetings.length > 0 && (
        <input
          type="text"
          placeholder="Search meetings, including what was said…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 mb-5"
        />
      )}

      {filtered.length === 0 && trimmedQuery && (
        <div className="surface-card dashed-card rounded-2xl p-10 text-center">
          <p className="font-medium mb-1">No matches</p>
          <p className="text-sm text-[var(--muted)]">
            Nothing matches &quot;{trimmedQuery}&quot;. Try a different search.
          </p>
        </div>
      )}

      <div className="space-y-7">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-3">
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.meetings.map((meeting) => {
                const snippet = trimmedQuery ? getTranscriptSnippet(meeting, trimmedQuery) : null;

                return (
                  <div
                    key={meeting.id}
                    className="surface-card relative rounded-2xl transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
                  >
                  {/* A team library shows meetings other people recorded; only
                      the person who recorded one can delete it. */}
                  {meeting.user_id === userId && (
                    <div className="absolute right-3 top-3.5">
                      <DeleteButton
                        kind="meeting"
                        id={meeting.id}
                        noun="meeting"
                        name={meeting.title}
                        detail="Its recording, summary and tasks go with it."
                        onDeleted={() =>
                          setMeetings((prev) => prev.filter((other) => other.id !== meeting.id))
                        }
                      />
                    </div>
                  )}
                  <Link
                    href={`/history/${meeting.id}`}
                    className="block rounded-2xl p-5 pr-14"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <h3 className="font-semibold flex items-center gap-1.5">
                        {meeting.title}
                        {meeting.video_url && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            className="h-3.5 w-3.5 text-[var(--muted)] shrink-0"
                          >
                            <path
                              d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </h3>
                      <span className="text-xs text-[var(--muted)] shrink-0">
                        {formatDate(meeting.created_at)}
                      </span>
                    </div>
                    {meeting.participants && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="flex -space-x-1.5">
                          {parseParticipants(meeting.participants)
                            .slice(0, 5)
                            .map((name, i) => (
                              <Avatar key={i} name={name} size="xs" />
                            ))}
                        </div>
                        <p className="text-xs text-[var(--muted)]">{meeting.participants}</p>
                      </div>
                    )}
                    {meeting.summary && (
                      <p className="text-sm text-[var(--muted)] line-clamp-2">{meeting.summary}</p>
                    )}
                    {snippet && (
                      <p className="text-xs text-[var(--muted)] mt-2 italic">
                        Found in transcript: &quot;{snippet}&quot;
                      </p>
                    )}
                  </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
