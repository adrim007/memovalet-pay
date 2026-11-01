"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowSquareOut, UsersThree } from "@phosphor-icons/react";
import Avatar from "@/components/Avatar";
import { SectionStarter } from "@/components/AssistantStarter";
import { Team, TeamMember } from "@/lib/types";
import DeleteButton from "@/components/DeleteButton";

export default function TeamsClient({
  teams: initialTeams,
  userId,
  embedded = false,
}: {
  teams: Team[];
  userId: string;
  embedded?: boolean;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTeamName.trim();
    if (!name || creating) return;

    setCreating(true);
    setCreateError("");

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Couldn't create that group.");
        return;
      }

      setTeams((prev) => [...prev, { ...data.team, role: "owner" as const }]);
      setNewTeamName("");
    } catch {
      setCreateError("Something went wrong. Try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={embedded ? "max-w-3xl" : "mx-auto max-w-2xl"}>
      {!embedded ? (
        <>
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight md:text-3xl">Groups</h1>
          <p className="mb-6 text-base text-[var(--muted)]">
            Create a shared space for the people you meet and work with.
          </p>
        </>
      ) : null}

      <div className="mb-6 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.06] px-4 py-3 text-sm text-[var(--muted)]">
        <strong className="text-[var(--foreground)]">Groups</strong> give selected people one shared place for meetings, projects and task progress. Microsoft Teams remains a call integration in Settings.
      </div>

      <form onSubmit={createTeam} className="surface-card rounded-2xl p-5 flex flex-col gap-2 mb-6 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">New group name</span>
          <input
            type="text"
            placeholder="Group name (e.g. Product, Sales)"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        </label>
        <button
          type="submit"
          disabled={creating || !newTeamName.trim()}
          className="brand-gradient-bg min-h-11 text-white font-medium px-5 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shrink-0"
        >
          {creating ? "Creating…" : "Create group"}
        </button>
      </form>

      {createError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
          {createError}
        </div>
      )}

      {teams.length === 0 ? (
        <SectionStarter
          icon="teams"
          eyebrow="Bring people together"
          title="Create a home for the work your group shares."
          body="Name the group above, invite people by email, and let everyone find the same recordings, translations, decisions, notes, and tasks."
          primaryHref="/meeting"
          primaryLabel="Explore the meeting room"
          secondaryHref="/settings#integrations"
          secondaryLabel="Connect call tools"
          points={["Private group meeting library", "A shared project workspace", "Email invitations for members"]}
        />
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              // Whoever created the team is the only one who can delete it —
              // the same rule the database enforces.
              canDelete={team.created_by === userId}
              onDeleted={() => setTeams((prev) => prev.filter((other) => other.id !== team.id))}
              expanded={expandedId === team.id}
              onToggle={() => setExpandedId(expandedId === team.id ? null : team.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  canDelete,
  onDeleted,
  expanded,
  onToggle,
}: {
  team: Team;
  canDelete: boolean;
  onDeleted: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadMembers = async () => {
    if (!loadingMembers) {
      setLoadingMembers(true);
      setMembersError("");
      try {
        const response = await fetch(`/api/teams/${team.id}/members`);
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.members)) throw new Error("Could not load members");
        setMembers(data.members);
      } catch {
        setMembersError("Couldn't load group members. Please try again.");
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  const handleToggle = () => {
    onToggle();
    if (!expanded && members === null) void loadMembers();
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviting || !inviteEmail.trim()) return;
    setInviting(true);
    setCopied(false);
    setInviteError("");
    setInviteResult(null);

    try {
      const response = await fetch(`/api/teams/${team.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setInviteError(data.error || "Couldn't create an invite.");
        return;
      }

      setInviteResult({ url: data.url, emailed: data.emailed });
      setInviteEmail("");
    } catch {
      setInviteError("Something went wrong. Try again.");
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteResult) return;
    setCopied(false);
    setInviteError("");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inviteResult.url);
      setCopied(true);
    } catch {
      setInviteError("Couldn't copy the invite. Select and copy the link below instead.");
    }
  };

  return (
    <div className="surface-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 pl-0">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center justify-between rounded-xl px-5 py-3 text-left transition hover:bg-indigo-500/5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
              <UsersThree size={21} weight="fill" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{team.name}</p>
              <p className="text-xs capitalize text-[var(--muted)]">{team.role || "member"}</p>
            </div>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link
          href={`/dashboard?team=${team.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-indigo-300 hover:text-[var(--foreground)]"
        >
          Open <ArrowSquareOut size={14} />
        </Link>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[var(--surface-border)] pt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
              Members
            </p>
            {loadingMembers && <p className="text-sm text-[var(--muted)]">Loading…</p>}
            {membersError && <div role="alert" className="text-sm text-red-600 dark:text-red-400"><p>{membersError}</p><button type="button" onClick={() => void loadMembers()} className="mt-2 min-h-11 rounded-xl border border-current px-3 font-semibold">Retry</button></div>}
            {!loadingMembers && members && (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2.5">
                    <Avatar name={m.email || m.user_id} size="xs" />
                    <span className="text-sm truncate">{m.email || "Member"}</span>
                    <span className="text-xs text-[var(--muted)] capitalize ml-auto shrink-0">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {team.role === "owner" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                Invite someone
              </p>
              <form onSubmit={sendInvite} className="flex flex-col gap-2 sm:flex-row">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Teammate email</span>
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="text-sm font-medium px-4 py-2 rounded-xl border border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5 transition disabled:opacity-60 shrink-0"
                >
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </form>

              {inviteError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-2">{inviteError}</p>
              )}

              {inviteResult && (
                <div className="mt-3 rounded-xl border border-[var(--surface-border)] p-3">
                  <p className="text-xs text-[var(--muted)] mb-2">
                    {inviteResult.emailed
                      ? "Invite emailed. You can also share this link directly:"
                      : "Share this link (connect Google to also send it by email):"}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs truncate text-[var(--muted)]">
                      {inviteResult.url}
                    </code>
                    <button
                      onClick={copyLink}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5 transition shrink-0"
                    >
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canDelete && (
            <div className="border-t border-[var(--surface-border)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--muted)]">
                  Deleting the group removes everyone from it. Meetings and projects stay with
                  whoever recorded them.
                </p>
                <DeleteButton
                  kind="team"
                  id={team.id}
                  noun="group"
                  name={team.name}
                  detail="Members lose access to what was shared through it."
                  label="Delete group"
                  onDeleted={onDeleted}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
