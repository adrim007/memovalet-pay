import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  ChatCircleDots,
  FileText,
  FolderOpen,
  ListChecks,
  Translate,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";

type StarterIcon =
  | "meeting"
  | "ask"
  | "tasks"
  | "documents"
  | "projects"
  | "people"
  | "teams";

const ICONS = {
  meeting: VideoCamera,
  ask: ChatCircleDots,
  tasks: ListChecks,
  documents: FileText,
  projects: FolderOpen,
  people: UsersThree,
  teams: UsersThree,
};

export function SectionStarter({
  icon,
  eyebrow = "Start here",
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  points = [],
}: {
  icon: StarterIcon;
  eyebrow?: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  points?: string[];
}) {
  const Icon = ICONS[icon];

  return (
    <section className="surface-card overflow-hidden rounded-2xl" aria-labelledby={`${icon}-starter-title`}>
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] lg:items-center">
        <div>
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <Icon size={23} weight="duotone" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
            {eyebrow}
          </p>
          <h2 id={`${icon}-starter-title`} className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">{body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={primaryHref}
              className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90"
            >
              {primaryLabel}
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link
                href={secondaryHref}
                className="inline-flex items-center rounded-xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-semibold transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>

        {points.length > 0 && (
          <ul className="space-y-3 rounded-2xl bg-indigo-500/[0.045] p-5" aria-label="What you will get">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm leading-5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                  <ArrowRight size={11} weight="bold" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function FirstRunGuide() {
  const steps = [
    {
      icon: CalendarCheck,
      title: "Connect your calendar",
      body: "Bring Google Meet and Microsoft Teams invitations into your day.",
      href: "/settings#integrations",
    },
    {
      icon: Translate,
      title: "Start a multilingual meeting",
      body: "Bring up to 50 people together, including the host, with language options for each participant.",
      href: "/meeting",
    },
    {
      icon: FileText,
      title: "Create a meeting pack",
      body: "Keep the recording, transcript, summary, decisions, notes, and tasks together.",
      href: "/meeting",
    },
  ];

  return (
    <section className="surface-card mb-8 overflow-hidden rounded-3xl" aria-labelledby="first-run-title">
      <div className="border-b border-[var(--surface-border)] bg-indigo-500/[0.045] px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
          Your first MemoValet memory
        </p>
        <h2 id="first-run-title" className="mt-2 text-2xl font-bold tracking-tight">
          Start with one conversation. MemoValet handles what comes next.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          After your first meeting, the people, decisions, tasks, documents, projects, insights,
          and answers across MemoValet begin connecting automatically.
        </p>
      </div>

      <ol className="grid gap-0 divide-y divide-[var(--surface-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <Link href={step.href} className="group block h-full p-5 transition hover:bg-indigo-400/5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                    <Icon size={19} weight="duotone" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-[var(--muted)]">Step {index + 1}</span>
                </div>
                <p className="mt-4 font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{step.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  Open <ArrowRight size={13} weight="bold" className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
