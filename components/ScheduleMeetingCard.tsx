"use client";

import { useState } from "react";
import { addManualMeeting } from "@/lib/manualMeetings";
import { AttendeeInfo, UpcomingCalendarEvent } from "@/lib/types";

interface ScheduleMeetingCardProps {
  onScheduled: (event: UpcomingCalendarEvent) => void;
}

export default function ScheduleMeetingCard({ onScheduled }: ScheduleMeetingCardProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [email, setEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSentTo, setInviteSentTo] = useState("");

  const sendInvite = async (
    meetingTitle: string,
    start: Date,
    durationMinutes: number,
    toEmail: string
  ) => {
    setSendingInvite(true);
    setInviteError("");
    try {
      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingTitle,
          meetingType: "general",
          scheduledStart: start.toISOString(),
          durationMinutes,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.session) throw new Error(data.error || "failed");

      const inviteResponse = await fetch(`/api/live/${data.session.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toEmail }),
      });
      const inviteData = await inviteResponse.json();
      if (!inviteResponse.ok) throw new Error(inviteData.error || "failed");

      setInviteSentTo(toEmail);
    } catch {
      setInviteError("Couldn't send that invite. Mind trying again?");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) return;

    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const meeting: UpcomingCalendarEvent = {
      id: crypto.randomUUID(),
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      meetLink: "",
      attendees: [] as AttendeeInfo[],
      source: "manual",
    };

    addManualMeeting(meeting);
    onScheduled(meeting);

    if (email.trim()) {
      sendInvite(title.trim(), start, duration, email.trim());
    }

    setTitle("");
    setDate("");
    setTime("");
    setDuration(30);
    setEmail("");
  };

  const inputClasses =
    "w-full rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-400";

  return (
    <div className="surface-card rounded-2xl p-6 shadow-xl shadow-indigo-500/5">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
        Schedule a meeting
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Not on your calendar? Set a time here and we&apos;ll count it down for you.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <label className="block">
          <span className="sr-only">Meeting title</span>
          <input
            type="text"
            placeholder="Meeting title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClasses}
            required
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Meeting date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClasses}
              required
            />
          </label>
          <label className="flex-1">
            <span className="sr-only">Meeting time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClasses}
              required
            />
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>Duration</span>
          <select
            aria-label="Meeting duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-transparent px-2 py-1.5 outline-none"
          >
            {[15, 30, 45, 60, 90, 120].map((mins) => (
              <option key={mins} value={mins}>
                {mins < 60 ? `${mins} min` : `${mins / 60} hr${mins > 60 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </div>
        <label className="block">
          <span className="sr-only">Send an invite to</span>
          <input
            type="email"
            placeholder="Send an invite to (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
        </label>
        <button
          type="submit"
          className="w-full brand-gradient-bg text-white text-sm font-medium py-2.5 rounded-lg transition hover:opacity-90"
        >
          Schedule
        </button>
        {sendingInvite && <p className="text-xs text-[var(--muted)]">Sending the invite…</p>}
        {inviteSentTo && !sendingInvite && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Invite sent to {inviteSentTo}. You&apos;ll get an email the moment they accept.
          </p>
        )}
        {inviteError && <p className="text-xs text-red-500 dark:text-red-400">{inviteError}</p>}
      </form>
    </div>
  );
}
