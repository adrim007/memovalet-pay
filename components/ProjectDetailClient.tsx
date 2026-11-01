"use client";

import { useState } from "react";
import Link from "next/link";
import { LightMeeting, Project } from "@/lib/types";
import ShareWithUser from "@/components/ShareWithUser";
import DeleteButton from "@/components/DeleteButton";
import PriorityPicker from "@/components/PriorityPicker";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectDetailClient({
  project: initialProject,
  meetings,
  currentUserId,
  sharedByLabel,
}: {
  project: Project;
  meetings: LightMeeting[];
  currentUserId?: string;
  sharedByLabel?: string | null;
}) {
  const isOwner = !currentUserId || initialProject.created_by === currentUserId;
  const [project, setProject] = useState(initialProject);
  const [updating, setUpdating] = useState(false);

  const toggleStatus = async () => {
    const nextStatus = project.status === "active" ? "closed" : "active";
    setUpdating(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        setProject((prev) => ({ ...prev, status: nextStatus }));
      }
    } finally {
      setUpdating(false);
    }
  };

  const totalActionItems = meetings.reduce((sum, m) => sum + (m.action_items?.length || 0), 0);

  const allDecisions = meetings.flatMap((m) =>
    (m.decisions || []).map((decision) => ({ decision, meetingTitle: m.title, meetingId: m.id }))
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/projects" className="text-sm text-[var(--muted)] hover:text-current transition">
        ← Projects
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-1">
        <div><h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{project.name}</h1>
        {project.due_date && <p className="mt-2 text-sm text-[var(--muted)]">Due {project.due_at ? new Date(project.due_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }) : new Date(project.due_date + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "long" })}</p>}</div>
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <PriorityPicker
              kind="project"
              id={project.id}
              value={project.priority}
              name={project.name}
              onChanged={(priority) => setProject((prev) => ({ ...prev, priority }))}
            />
            <ShareWithUser itemType="project" itemId={project.id} />
            <button
              type="button"
              onClick={toggleStatus}
              disabled={updating}
              className="text-xs font-medium rounded-full border border-[var(--surface-border)] px-3 py-1.5 transition hover:border-indigo-400/40 hover:bg-indigo-400/5 disabled:opacity-60 shrink-0"
            >
              {project.status === "active" ? "Close project" : "Reopen project"}
            </button>
            <DeleteButton
              kind="project"
              id={project.id}
              noun="project"
              name={project.name}
              detail="The meetings and notes filed under it stay where they are."
              goTo="/projects"
            />
          </div>
        ) : (
          <span className="text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 px-3 py-1.5 shrink-0">
            Shared by {sharedByLabel || "someone"}
          </span>
        )}
      </div>
      {project.client_name && (
        <p className="text-[var(--muted)] mb-6 text-base">{project.client_name}</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="surface-card rounded-2xl p-4">
          <p className="text-2xl font-bold">{meetings.length}</p>
          <p className="text-xs text-[var(--muted)]">Meetings</p>
        </div>
        <div className="surface-card rounded-2xl p-4">
          <p className="text-2xl font-bold">{totalActionItems}</p>
          <p className="text-xs text-[var(--muted)]">Action items</p>
        </div>
      </div>

      {allDecisions.length > 0 && (
        <div className="surface-card rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">Decisions across this project</h2>
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
      {meetings.length === 0 ? (
        <div className="surface-card dashed-card rounded-2xl p-10 text-center">
          <p className="font-medium mb-1">No meetings yet</p>
          <p className="text-sm text-[var(--muted)]">
            Assign a meeting to this project from the New Meeting box.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
