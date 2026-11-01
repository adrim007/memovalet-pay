"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { LightMeeting, UserDocument } from "@/lib/types";

export default function DocumentTimeline({ documents, meetings }: { documents: UserDocument[]; meetings: LightMeeting[] }) {
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const entries = useMemo(() => [
    ...documents.map(doc => ({ id: doc.id, title: doc.title, date: doc.created_at.slice(0, 10), kind: "Document", href: `/documents?document=${doc.id}` })),
    ...meetings.map(meeting => ({ id: meeting.id, title: meeting.title, date: meeting.created_at.slice(0, 10), kind: "Meeting", href: `/history/${meeting.id}` })),
  ].sort((a,b) => b.date.localeCompare(a.date)), [documents, meetings]);
  const months = [...new Set(entries.map(entry => entry.date.slice(0,7)))];
  const filtered = entries.filter(entry => (!month || entry.date.startsWith(month)) && (!day || entry.date === day));
  return <details className="mb-6 border-y border-[var(--surface-border)] py-4">
    <summary className="cursor-pointer font-semibold text-sm">Browse meetings and documents by date</summary>
    <div className="mt-4 flex flex-wrap gap-3 items-end">
      <label className="text-xs text-[var(--muted)]">Month<select aria-label="Timeline month" value={month} onChange={e => { setMonth(e.target.value); setDay(""); }} className="mt-1 block rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm">
        <option value="">All months</option>{months.map(m => <option key={m} value={m}>{new Date(m+"-01T12:00:00Z").toLocaleDateString("en", { month:"long", year:"numeric", timeZone:"UTC" })}</option>)}
      </select></label>
      <label className="text-xs text-[var(--muted)]">Day<input aria-label="Timeline day" type="date" value={day} onChange={e=>{setDay(e.target.value);setMonth(e.target.value.slice(0,7));}} className="mt-1 block max-w-full rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-2 text-sm" /></label>
      {(month || day) && <button type="button" onClick={()=>{setMonth("");setDay("");}} className="px-3 py-2 text-sm underline">Clear dates</button>}
    </div>
    <div className="mt-4 max-h-96 overflow-auto">
      {filtered.length === 0 && <p className="text-sm text-[var(--muted)] py-4">No meetings or documents on these dates.</p>}
      {filtered.map((entry,index) => <div key={entry.kind+entry.id}>
        {(index === 0 || filtered[index-1].date !== entry.date) && <h3 className="text-xs font-semibold text-[var(--muted)] py-3">{entry.date}</h3>}
        <Link href={entry.href} className="flex gap-3 min-w-0 border-l-2 border-indigo-400/30 py-2 pl-3 text-sm hover:bg-indigo-500/5">
          <span className="text-xs text-[var(--muted)] w-16 shrink-0">{entry.kind}</span><span className="break-words min-w-0">{entry.title}</span>
        </Link>
      </div>)}
    </div>
  </details>;
}
