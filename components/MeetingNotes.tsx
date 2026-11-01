"use client";

import AutosaveNotes from "@/components/AutosaveNotes";

export default function MeetingNotes({ meetingId, initialNotes }: { meetingId: string; initialNotes: string | null }) {
  return <div className="surface-card rounded-2xl p-5">
    <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">Your notes</h2>
    <AutosaveNotes key={meetingId} endpoint={`/api/meetings/${meetingId}`} initial={initialNotes ?? ""}
      label="Your meeting notes" placeholder="Add context, next steps or anything the summary missed." />
  </div>;
}
