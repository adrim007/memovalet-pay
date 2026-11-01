"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MeetingSummaryRecovery({ meetingId, hasTranscript }: { meetingId: string; hasTranscript: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  async function retry() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/process-meeting", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId }),
      });
      const data = await response.json();
      setMessage(response.ok ? data.warning || "Summary saved." : data.error || "Couldn't generate the summary. Your saved work is unchanged.");
      router.refresh();
    } catch { setMessage("Couldn't connect. Your meeting remains saved; try again when you're online."); }
    finally { running.current = false; setBusy(false); }
  }
  return (
    <section className="rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-5">
      <h2 className="font-semibold">Saved safely · summary not ready</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Your transcript and any attached recording are saved. {hasTranscript
          ? "You can retry the summary without creating another meeting. This won't send emails or export anything."
          : "This recording is stored for playback. Automatic transcription of uploaded recordings is not available yet."}
      </p>
      {hasTranscript && <button type="button" disabled={busy} onClick={retry} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Generating summary…" : "Generate summary"}
      </button>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </section>
  );
}
