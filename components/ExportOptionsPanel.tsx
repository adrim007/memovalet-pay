import Link from "next/link";
import { AttendeeInfo, ExportOptions } from "@/lib/types";

export interface IntegrationStatus {
  google: boolean;
  trello: boolean;
  slack: boolean;
  notion: boolean;
}

/** Not usable yet, but Settings can finish connecting it. */
export type IntegrationConnectable = Partial<Record<"trello" | "slack" | "notion", boolean>>;

interface ExportOptionsPanelProps {
  options: ExportOptions;
  onToggle: (key: keyof ExportOptions, value: boolean) => void;
  attendees?: AttendeeInfo[];
  integrations: IntegrationStatus;
  connectable?: IntegrationConnectable;
}

const TOGGLES: {
  key: keyof ExportOptions;
  label: string;
  integration: keyof IntegrationStatus;
}[] = [
  { key: "exportToDocs", label: "Export to Google Docs", integration: "google" },
  { key: "exportToTrello", label: "Create Trello cards", integration: "trello" },
  { key: "exportToSlack", label: "Post to Slack", integration: "slack" },
  { key: "exportToNotion", label: "Save to Notion", integration: "notion" },
];

export default function ExportOptionsPanel({
  options,
  onToggle,
  attendees = [],
  integrations,
  connectable = {},
}: ExportOptionsPanelProps) {
  const acceptedCount = attendees.filter((a) => a.accepted).length;
  // Destinations this person can use now, or finish connecting in Settings.
  // A row saying "Connect" for something Settings can't connect was a dead end.
  const available = TOGGLES.filter(
    (t) => integrations[t.integration] || (t.integration !== "google" && connectable[t.integration])
  );
  if (available.length === 0 && acceptedCount === 0) return null;

  return (
    <div className="surface-card rounded-2xl p-5 md:p-6 shadow-xl shadow-indigo-500/5">
      <h2 className="text-base font-semibold mb-3.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
        Export Destinations
      </h2>

      <div className="space-y-1.5">
        {available.map((t) => {
          const checked = !!options[t.key];
          const connected = integrations[t.integration];

          return (
            <label
              key={t.key}
              className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm transition ${
                connected ? "cursor-pointer hover:border-indigo-400/40" : "cursor-not-allowed opacity-70"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{t.label}</span>
                <span className={`block text-[10px] font-medium ${connected ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)]"}`}>
                  {connected ? "Connected" : "Not connected"}
                </span>
              </span>
              {!connected && (
                <Link
                  href="/settings#integrations"
                  className="ml-auto text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                  onClick={(event) => event.stopPropagation()}
                >
                  Connect
                </Link>
              )}
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  checked && connected ? "brand-gradient-bg" : "bg-[var(--surface-border)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked && connected}
                  disabled={!connected}
                  onChange={(e) => onToggle(t.key, e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    checked && connected ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </span>
            </label>
          );
        })}

        {acceptedCount > 0 && (
          <label className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm cursor-pointer transition hover:border-indigo-400/40">
            <span>
              Email PDF to attendees who accepted{" "}
              <span className="text-[var(--muted)]">({acceptedCount})</span>
            </span>
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                options.emailAttendees ? "brand-gradient-bg" : "bg-[var(--surface-border)]"
              }`}
            >
              <input
                type="checkbox"
                checked={!!options.emailAttendees}
                onChange={(e) => onToggle("emailAttendees", e.target.checked)}
                className="sr-only"
              />
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  options.emailAttendees ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </span>
          </label>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
        Only connected destinations run after a meeting. Your MemoValet meeting pack is always
        saved here first.
      </p>
    </div>
  );
}
