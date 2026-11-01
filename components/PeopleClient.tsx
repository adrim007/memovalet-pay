"use client";

import Link from "next/link";
import { ArrowRight, PaperPlaneTilt, User, UsersThree } from "@phosphor-icons/react";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import { SectionStarter } from "@/components/AssistantStarter";
import TeamsClient from "@/components/TeamsClient";
import type { Team } from "@/lib/types";

export interface PersonSummary {
  name: string;
  meetingCount: number;
  lastMet?: string | null;
  email?: string | null;
}

function formatLastMet(value?: string | null) {
  if (!value) return null;
  const then = new Date(value);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PeopleClient({
  people,
  teams,
  userId,
  initialView = "people",
}: {
  people: PersonSummary[];
  teams: Team[];
  userId: string;
  initialView?: "people" | "groups";
}) {
  const peopleActive = initialView === "people";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="People"
        subtitle="Keep individual relationships and the groups you work with in one place."
      />

      <nav
        aria-label="People views"
        className="mb-6 inline-flex rounded-2xl border border-[var(--surface-border)] bg-white/70 p-1 shadow-sm"
      >
        <Link
          href="/people"
          aria-current={peopleActive ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            peopleActive
              ? "brand-gradient-bg text-white shadow-md shadow-indigo-500/15"
              : "text-[var(--muted)] hover:bg-indigo-500/5 hover:text-[var(--foreground)]"
          }`}
        >
          <User size={17} weight={peopleActive ? "fill" : "regular"} />
          People
          <span className={peopleActive ? "text-white/75" : "text-[var(--muted)]"}>{people.length}</span>
        </Link>
        <Link
          href="/people?view=groups"
          aria-current={peopleActive ? undefined : "page"}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            peopleActive
              ? "text-[var(--muted)] hover:bg-indigo-500/5 hover:text-[var(--foreground)]"
              : "brand-gradient-bg text-white shadow-md shadow-indigo-500/15"
          }`}
        >
          <UsersThree size={18} weight={peopleActive ? "regular" : "fill"} />
          Groups
          <span className={peopleActive ? "text-[var(--muted)]" : "text-white/75"}>{teams.length}</span>
        </Link>
      </nav>

      {!peopleActive ? (
        <TeamsClient teams={teams} userId={userId} embedded />
      ) : people.length === 0 ? (
        <SectionStarter
          icon="people"
          eyebrow="Your relationship memory"
          title="People appear as soon as you meet them."
          body="Add participant names or emails when you start or import a meeting. MemoValet will build a private history of what you discussed together."
          primaryHref="/meeting"
          primaryLabel="Start or import a meeting"
          secondaryHref="/settings#integrations"
          secondaryLabel="Connect a calendar"
          points={["Shared meeting history", "Commitments and next steps", "Projects, tasks, and decisions by person"]}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => {
            const lastMet = formatLastMet(person.lastMet);
            return (
              <article key={person.name} className="mf-card flex flex-col gap-4 rounded-3xl p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={person.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold">{person.name}</h2>
                    {person.email && <p className="truncate text-xs text-[var(--muted)]">{person.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xl font-extrabold tracking-tight">{person.meetingCount}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {person.meetingCount === 1 ? "Meeting" : "Meetings"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold tracking-tight">{lastMet || "Not yet"}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Last met</p>
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Link
                    href={`/people/${encodeURIComponent(person.name)}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold ring-1 ring-[var(--surface-border)] transition hover:ring-indigo-300"
                  >
                    History <ArrowRight size={14} />
                  </Link>
                  <Link
                    href="/tasks"
                    className="brand-gradient-bg inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white"
                  >
                    <PaperPlaneTilt size={14} weight="fill" /> Send a job
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
