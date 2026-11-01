import { ExportResults } from "@/lib/types";

function DocIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <path
        d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 15.5h6M9 9.5h2" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="m4.5 6.5 7.5 6 7.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrelloIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <rect
        x="6.5"
        y="6.5"
        width="4.5"
        height="9"
        rx="1"
        fill="currentColor"
        stroke="none"
        opacity="0.85"
      />
      <rect
        x="13"
        y="6.5"
        width="4.5"
        height="6"
        rx="1"
        fill="currentColor"
        stroke="none"
        opacity="0.85"
      />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <path d="M8 4v6M16 4v6M8 14v6M16 14v6M4 8h6M14 8h6M4 16h6M14 16h6" strokeLinecap="round" />
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 8v8M8 8l8 8M16 8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ExportsDisplay({ exports }: { exports: ExportResults | null }) {
  if (!exports) return null;

  const hasAny =
    exports.docsUrl ||
    exports.postedToSlack ||
    exports.notionUrl ||
    !!exports.attendeesEmailed ||
    (exports.trelloCards && exports.trelloCards.length > 0);
  const hasFailures = exports.failedExports && exports.failedExports.length > 0;
  if (!hasAny && !hasFailures) return null;

  return (
    <div className="surface-card rounded-2xl p-6 md:p-7 space-y-4 shadow-xl shadow-indigo-500/5">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
        Exports
      </h2>

      <div className="flex flex-wrap gap-2">
        {exports.docsUrl && (
          <a
            href={exports.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] flex items-center gap-2 transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
          >
            <DocIcon />
            Open Google Doc
          </a>
        )}

        {exports.postedToSlack && (
          <span className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] flex items-center gap-2">
            <SlackIcon />
            Posted to Slack
          </span>
        )}

        {exports.notionUrl && (
          <a
            href={exports.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] flex items-center gap-2 transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
          >
            <NotionIcon />
            Open in Notion
          </a>
        )}

        {!!exports.attendeesEmailed && (
          <span className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] flex items-center gap-2">
            <MailIcon />
            Emailed PDF to {exports.attendeesEmailed} attendee
            {exports.attendeesEmailed === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {exports.trelloCards && exports.trelloCards.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
            Trello cards ({exports.trelloCards.length})
          </p>
          <ul className="space-y-1.5">
            {exports.trelloCards.map((card, i: number) => (
              <li key={i}>
                <a
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3.5 py-2 transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
                >
                  <TrelloIcon />
                  {card.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasFailures && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
          {exports.failedExports!.join(", ")} didn&apos;t go through. Check that they&apos;re
          connected under Integrations and try again.
        </div>
      )}
    </div>
  );
}
