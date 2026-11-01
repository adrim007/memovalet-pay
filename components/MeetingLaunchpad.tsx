"use client";

import Image from "next/image";
import {
  ArrowRight,
  FileText,
  GlobeHemisphereWest,
  LinkSimple,
  Record,
  Translate,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react";
import { MEETING_TYPE_LABELS } from "@/lib/prompts";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";
import { MeetingType, Project } from "@/lib/types";

interface MeetingLaunchpadProps {
  title: string;
  setTitle: (value: string) => void;
  participants: string;
  setParticipants: (value: string) => void;
  meetingType: MeetingType;
  setMeetingType: (value: MeetingType) => void;
  projectId: string | null;
  setProjectId: (value: string | null) => void;
  projects: Project[];
  language: string;
  setLanguage: (value: string) => void;
  starting: boolean;
  onStart: () => void;
}

const avatars = ["/avatars/maria.jpg", "/avatars/david.jpg", "/avatars/sarah.jpg", "/avatars/wei.jpg"];

export default function MeetingLaunchpad({
  title,
  setTitle,
  participants,
  setParticipants,
  meetingType,
  setMeetingType,
  projectId,
  setProjectId,
  projects,
  language,
  setLanguage,
  starting,
  onStart,
}: MeetingLaunchpadProps) {
  const inputClasses =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20";

  return (
    <section className="surface-card overflow-hidden rounded-3xl border-slate-200 bg-white shadow-xl shadow-indigo-500/5">
      <div className="border-b border-slate-200 bg-indigo-50/70 px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-700">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-indigo-100">
            <GlobeHemisphereWest size={16} weight="duotone" />
            Live multilingual meeting
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-indigo-100">
            <UsersThree size={16} weight="duotone" />
            Up to 50 people
          </span>
        </div>

        <h2 className="mt-5 max-w-2xl text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Start a conversation everyone understands.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Each person speaks naturally. MemoValet translates the conversation live, keeps the
          original audio, and turns it into notes everyone can share.
        </p>

        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex -space-x-2" aria-label="Example meeting participants">
            {avatars.map((avatar, index) => (
              <Image
                key={avatar}
                src={avatar}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full border-2 border-indigo-50 object-cover"
                priority={index < 2}
              />
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-600">
            Italian, French, Spanish, Japanese or any other supported language.
          </p>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Meeting title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Global project kickoff"
              className={inputClasses}
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Language you&apos;ll speak
            </span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className={inputClasses}
            >
              {SPEECH_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Meeting type
            </span>
            <select
              value={meetingType}
              onChange={(event) => setMeetingType(event.target.value as MeetingType)}
              className={inputClasses}
            >
              {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={projects.length > 0 ? "" : "sm:col-span-2"}>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Invite people <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              type="text"
              value={participants}
              onChange={(event) => setParticipants(event.target.value)}
              placeholder="Names or email addresses"
              className={inputClasses}
            />
          </label>

          {projects.length > 0 && (
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Project</span>
              <select
                value={projectId || ""}
                onChange={(event) => setProjectId(event.target.value || null)}
                className={inputClasses}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                    {project.client_name ? ` · ${project.client_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="brand-gradient-bg mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          <VideoCamera size={20} weight="fill" />
          {starting ? "Creating your meeting…" : "Start live meeting"}
          {!starting && <ArrowRight size={18} weight="bold" />}
        </button>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <Feature icon={<Translate size={19} weight="duotone" />} title="Live translation" text="Everyone reads their language" />
          <Feature icon={<Record size={19} weight="duotone" />} title="Recorded" text="Original video and audio kept" />
          <Feature icon={<FileText size={19} weight="duotone" />} title="Ready to share" text="Notes, transcript and PDF" />
        </div>

        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            Your meeting pack after the call
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Recording · original transcript · translated transcripts · shared notes · decisions ·
            tasks · PDF and secure sharing
          </p>
        </div>
      </div>
    </section>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
        {icon}
      </span>
      <span>
        <span className="block text-xs font-semibold text-slate-800">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{text}</span>
      </span>
    </div>
  );
}

export function JoinMeetingCard({ value, onChange, onJoin }: { value: string; onChange: (value: string) => void; onJoin: () => void }) {
  return (
    <section className="surface-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <LinkSimple size={21} weight="duotone" />
        </span>
        <div>
          <h2 className="font-semibold">Join a meeting</h2>
          <p className="text-xs text-[var(--muted)]">Paste a MemoValet link or room code.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onJoin();
          }}
          placeholder="Meeting link or code"
          aria-label="Meeting link or code"
          className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
        />
        <button
          type="button"
          onClick={onJoin}
          disabled={!value.trim()}
          className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Join
        </button>
      </div>
    </section>
  );
}
