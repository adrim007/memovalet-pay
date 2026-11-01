"use client";

import { useState } from "react";
import Link from "next/link";
import { Project } from "@/lib/types";
import { useIsPersonal } from "@/lib/account-type-context";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import DeleteButton from "@/components/DeleteButton";
import PriorityPicker from "@/components/PriorityPicker";
import { priorityRank } from "@/lib/priority";

export default function ProjectsClient({
  projects: initialProjects,
  userId,
}: {
  projects: Project[];
  userId: string;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const personal = useIsPersonal();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useUnsavedWarning(Boolean(name || clientName));

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;

    setCreating(true);
    setCreateError("");
    setCreatedId(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, clientName: clientName.trim(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Couldn't create that project.");
        return;
      }

      setProjects((prev) => [data.project, ...prev]);
      setName("");
      setClientName("");
      setQuery("");
      setCreatedId(data.project.id);
    } catch {
      setCreateError("Something went wrong. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const forget = (id: string) => setProjects((prev) => prev.filter((project) => project.id !== id));
  const setPriorityOn = (id: string, priority: Project["priority"]) =>
    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, priority } : project)));

  const matching = projects.filter((project) => `${project.name} ${project.client_name || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  // What you marked urgent leads the list; everything else keeps its order.
  const byPriority = (a: Project, b: Project) => priorityRank(a.priority) - priorityRank(b.priority);
  const active = matching.filter((p) => p.status === "active").sort(byPriority);
  const closed = matching.filter((p) => p.status === "closed");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1">Projects</h1>
      <p className="text-[var(--muted)] mb-6 text-base">
        {personal
          ? "Keep meetings, notes and tasks together for a renovation, trip, move or other personal project."
          : "Group meetings, decisions, and action items for the same deal or client into one thread."}
      </p>

      <form onSubmit={createProject} className="surface-card rounded-2xl p-5 flex flex-wrap items-end gap-3 mb-6">
        <label className="flex-1 min-w-[10rem]">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">Project name</span>
          <input
            id="project-name"
            readOnly={creating}
            type="text"
            placeholder="e.g. Acme renewal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        </label>
        <label className="flex-1 min-w-[8rem]">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">Client or goal</span>
          <input
            readOnly={creating}
            type="text"
            placeholder="Optional"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        </label>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="brand-gradient-bg min-h-11 text-white font-medium px-5 py-2.5 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shrink-0"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </form>

      {createError && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
          {createError}
        </div>
      )}
      {createdId && <p role="status" className="mb-5 rounded-xl bg-indigo-500/10 px-4 py-3 text-sm">Project created. <Link href={`/projects/${createdId}`} className="font-semibold underline underline-offset-4">Open your project →</Link></p>}

      {projects.length > 0 && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Your projects <span className="text-sm font-medium text-[var(--muted)]">({projects.length})</span></h2>
        <input type="search" aria-label="Search projects" placeholder="Find a project or client…" value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm" />
      </div>}
      {projects.length > 0 && matching.length === 0 && <p role="status" className="py-6 text-sm text-[var(--muted)]">No projects match your search. Try a different name.</p>}

      {projects.length === 0 ? (
        <section className="surface-card rounded-2xl border-dashed p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Start with a name</p>
          <h2 className="mt-3 text-xl font-bold">A home for your next project</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">A renovation, a client brief or a personal goal. Create a project above, then open it to organise the work and track what needs doing.</p>
          <button type="button" onClick={() => document.getElementById("project-name")?.focus()} className="mt-5 rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-semibold">Name your first project →</button>
        </section>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Active · {active.length}</h2>
              {active.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  canDelete={project.created_by === userId}
                  onDeleted={() => forget(project.id)}
                  onPriority={(priority) => setPriorityOn(project.id, priority)}
                />
              ))}
            </div>
          )}

          {closed.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                Closed
              </p>
              <div className="space-y-2">
                {closed.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    canDelete={project.created_by === userId}
                    onDeleted={() => forget(project.id)}
                    onPriority={(priority) => setPriorityOn(project.id, priority)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  canDelete,
  onDeleted,
  onPriority,
}: {
  project: Project;
  canDelete: boolean;
  onDeleted: () => void;
  onPriority: (priority: Project["priority"]) => void;
}) {
  return (
    <div className="surface-card flex items-center gap-3 rounded-2xl p-5 transition hover:border-indigo-400/40 hover:bg-indigo-400/5">
      <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
        <p className="font-semibold truncate">{project.name}</p>
        {project.client_name && (
          <p className="text-sm text-[var(--muted)] truncate">{project.client_name}</p>
        )}
      </Link>
      {canDelete && (
        <PriorityPicker
          kind="project"
          id={project.id}
          value={project.priority}
          name={project.name}
          onChanged={(priority) => onPriority(priority)}
        />
      )}
      {project.status === "closed" && (
        <span className="text-xs font-medium text-[var(--muted)] rounded-full border border-[var(--surface-border)] px-2.5 py-1 shrink-0">
          Closed
        </span>
      )}
      {/* A project can be shared with you or come from your team; only its owner can delete it. */}
      {canDelete && (
        <DeleteButton
          kind="project"
          id={project.id}
          noun="project"
          name={project.name}
          detail="The meetings and notes filed under it stay where they are."
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
