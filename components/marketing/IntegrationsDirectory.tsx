"use client";

import {
  AppleLogo,
  ArrowRight,
  CheckCircle,
  MagnifyingGlass,
  MicrosoftOutlookLogo,
  MicrosoftTeamsLogo,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  GmailIcon,
  GoogleCalendarIcon,
  GoogleDocsIcon,
  GoogleMeetIcon,
  NotionIcon,
  SlackIcon,
  TrelloIcon,
  ZoomIcon,
} from "./BrandIcons";

const iconMap = {
  "google-meet": GoogleMeetIcon,
  teams: MicrosoftTeamsLogo,
  zoom: ZoomIcon,
  gmail: GmailIcon,
  outlook: MicrosoftOutlookLogo,
  calendar: GoogleCalendarIcon,
  "apple-calendar": AppleLogo,
  docs: GoogleDocsIcon,
  slack: SlackIcon,
  notion: NotionIcon,
  trello: TrelloIcon,
};

const integrations = [
  { key: "google-meet", name: "Google Meet", category: "Meeting tools", status: "Available", summary: "Bring MemoValet into the calls your team already joins.", handles: ["Live transcript and translated captions", "Summary, decisions, and action items", "Shareable meeting record after the call"] },
  { key: "teams", name: "Microsoft Teams", category: "Meeting tools", status: "Available", summary: "Use MemoValet alongside your Teams call to capture a record for your workspace. Recording depends on the audio available to your browser and device.", handles: ["Your Teams meetings appear in your upcoming list", "Record and transcribe while the call runs", "Summary, decisions, and action items afterwards"] },
  { key: "zoom", name: "Zoom", category: "Meeting tools", status: "Available", summary: "Use MemoValet alongside your Zoom call to capture notes and actions. Recording depends on the audio available to your browser and device.", handles: ["Your Zoom meetings appear in your upcoming list", "Record and transcribe while the call runs", "Summary, decisions, and action items afterwards"] },
  { key: "gmail", name: "Gmail", category: "Email & calendar", status: "Available", summary: "Send a finished recap or task from the same place the work was captured.", handles: ["Spot meeting invites in your inbox", "Email the meeting PDF to attendees", "Share tasks with people who do not have an account"] },
  { key: "outlook", name: "Outlook", category: "Email & calendar", status: "Soon", summary: "Planned support for email and calendar coordination.", handles: ["Prepare messages about outstanding work", "Share files and meeting PDFs", "Notify people when assigned work changes"] },
  { key: "calendar", name: "Google Calendar", category: "Email & calendar", status: "Available", summary: "See upcoming Google Calendar calls in MemoValet. Subscribe to your MemoValet tasks, deadlines and calls in Google Calendar.", handles: ["Upcoming meeting detection", "Edit subscribed tasks and deadlines in MemoValet. Google Calendar checks for updates periodically, so changes may take several hours.", "Quick access to the meeting record afterwards"] },
  { key: "apple-calendar", name: "Apple Calendar", category: "Email & calendar", status: "Available", summary: "See your MemoValet tasks, deadlines and calls in Apple Calendar on your iPhone, iPad and Mac.", handles: ["Add it in one tap from the Calendar page", "Stays up to date as you change things in MemoValet", "A private link you can reset or turn off any time"] },
  { key: "docs", name: "Google Docs", category: "Productivity", status: "Available", summary: "Export a meeting summary to a document you can edit and share.", handles: ["The summary as a Google Doc", "Decisions and action items with owners", "Saved to your Drive, ready to edit or share"] },
  { key: "slack", name: "Slack", category: "Productivity", status: "Available", summary: "Send a concise update to the channel where the team is already working.", handles: ["Meeting recap with owners", "Important file links", "Focused updates without the full recording"] },
  { key: "notion", name: "Notion", category: "Productivity", status: "Available", summary: "Keep decisions and project notes connected to the team workspace.", handles: ["Structured meeting pages", "Action items and owners", "Searchable project history"] },
  { key: "trello", name: "Trello", category: "Productivity", status: "Available", summary: "Create Trello cards from recorded action items.", handles: ["Create cards from action items", "Carry over owner and due date", "Keep a link back to the meeting context"] },
] as const;

type Status = "Available" | "Soon";
type Integration = Omit<(typeof integrations)[number], "status"> & { status: Status };
type Category = "All" | Integration["category"];
const categories: Category[] = ["All", "Meeting tools", "Email & calendar", "Productivity"];

// Integrations that only work once MemoValet's own app is registered with that
// service. The page is told which are, from the real configuration, so a
// listing can't say Available while the Connect button would do nothing.
export type IntegrationAvailability = Partial<Record<"slack" | "notion" | "trello", boolean>>;

export default function IntegrationsDirectory({ availability = {} }: { availability?: IntegrationAvailability }) {
  const listings: Integration[] = integrations.map((integration) =>
    integration.key in availability
      ? { ...integration, status: availability[integration.key as keyof IntegrationAvailability] ? "Available" : "Soon" }
      : integration
  );
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [active, setActive] = useState<Integration | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const filtered = listings.filter((integration) => {
    const matchesCategory = category === "All" || integration.category === category;
    const matchesQuery = !deferredQuery || `${integration.name} ${integration.category} ${integration.summary}`.toLowerCase().includes(deferredQuery);
    return matchesCategory && matchesQuery;
  });

  const close = () => {
    setActive(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  return (
    <section className="px-5 pb-24 sm:px-8 sm:pb-28" aria-labelledby="integration-directory-heading">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="memo-section-label">Integration directory</p>
            <h2 id="integration-directory-heading" className="mt-4 font-display text-3xl font-light tracking-[-0.045em] text-white sm:text-5xl">Connect your workspace to familiar tools.</h2>
          </div>
          <label className="memo-integration-search">
            <MagnifyingGlass size={19} />
            <span className="sr-only">Search integrations</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search integrations" />
          </label>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" aria-label="Filter integrations">
          {categories.map((item) => (
            <button key={item} type="button" className={`memo-filter-pill ${category === item ? "is-active" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((integration) => {
            const Icon = iconMap[integration.key];
            return (
              <button key={integration.key} type="button" className="memo-integration-card group" onClick={(event) => { triggerRef.current = event.currentTarget; setActive(integration); }}>
                <span className="memo-integration-icon"><Icon className="h-full w-full" /></span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2"><strong className="text-base text-white">{integration.name}</strong><small className={`memo-status ${integration.status === "Available" ? "is-live" : ""}`}>{integration.status}</small></span>
                  <span className="mt-1 block text-xs text-white/44">{integration.category}</span>
                  <span className="mt-4 block text-sm leading-6 text-white/62">{integration.summary}</span>
                </span>
                <ArrowRight size={18} className="mt-1 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-white/14 px-6 py-14 text-center text-sm text-white/55">No integration matches that search yet.</div> : null}
      </div>

      {active ? (
        <div className="memo-feature-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section ref={dialogRef} className="memo-feature-dialog" role="dialog" aria-modal="true" aria-labelledby="integration-dialog-title">
            <button ref={closeRef} type="button" className="memo-feature-dialog-close" aria-label="Close integration details" onClick={close}><X size={20} weight="bold" /></button>
            {(() => { const Icon = iconMap[active.key]; return <span className="memo-integration-icon h-16 w-16"><Icon className="h-full w-full" /></span>; })()}
            <div className="mt-6 flex items-center gap-3"><p className="memo-section-label">{active.category}</p><span className={`memo-status ${active.status === "Available" ? "is-live" : ""}`}>{active.status}</span></div>
            <h3 id="integration-dialog-title" className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{active.name} + MemoValet</h3>
            <p className="mt-5 text-base leading-7 text-white/68">{active.summary}</p>
            <ul className="mt-7 space-y-3">
              {active.handles.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-white/74"><CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[#8f76ff]" />{item}</li>)}
            </ul>
            <Link href="/login" className="mk-glow-btn mt-8 inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold text-white">{active.status === "Available" ? "Start with MemoValet" : "Get updates"}<ArrowRight size={16} weight="bold" /></Link>
          </section>
        </div>
      ) : null}
    </section>
  );
}
