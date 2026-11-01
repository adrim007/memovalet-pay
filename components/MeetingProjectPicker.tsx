"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function MeetingProjectPicker({
  meetingId,
  current,
  projects,
}: {
  meetingId: string;
  current: string | null;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(current || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="mf-card rounded-2xl p-4">
      <label className="text-sm font-medium">
        Keep this meeting in a project
        <select
          aria-label="Meeting project"
          disabled={busy}
          value={value}
          onChange={async (event) => {
            const projectId = event.target.value;
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch(`/api/meetings/${meetingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: projectId || null }),
              });
              if (!response.ok) throw new Error();
              setValue(projectId);
              setMessage("Project updated.");
              router.refresh();
            } catch {
              setMessage("The project wasn't changed. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
          className="mt-2 block w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
        >
          <option value="">History only</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="mt-2 text-xs text-[var(--muted)]">
        {busy
          ? "Saving…"
          : message || "The transcript, notes and recording stay together in history."}
      </p>
    </div>
  );
}
