"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  LinkSimple,
  Translate,
  Trash,
  VideoCamera,
} from "@phosphor-icons/react";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";

interface Recipient {
  id: string;
  email: string;
  language: string;
}

interface SendOutcome {
  email: string;
  language: string;
  sent: boolean;
  translated: boolean;
  error?: string;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

// Everything that used to be several separate steps — export a PDF, email it,
// copy a share link, switch the language — collapsed into one panel with one
// button, because that is how people actually finish a meeting.
export default function MeetingSharePack({
  meetingId,
  participants,
  hasRecording,
}: {
  meetingId: string;
  participants?: string | null;
  hasRecording?: boolean;
}) {
  const prefilled = (participants || "")
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.includes("@"))
    .map((email) => ({ id: newId(), email, language: "" }));

  const [recipients, setRecipients] = useState<Recipient[]>(
    prefilled.length ? prefilled : [{ id: newId(), email: "", language: "" }]
  );
  const [includePdf, setIncludePdf] = useState(true);
  const [includeRecording, setIncludeRecording] = useState(!!hasRecording);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState("original");

  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<SendOutcome[] | null>(null);
  const [error, setError] = useState("");

  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [linking, setLinking] = useState(false);

  const update = (id: string, patch: Partial<Recipient>) =>
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => setRecipients((prev) => [...prev, { id: newId(), email: "", language: "" }]);

  const removeRow = (id: string) =>
    setRecipients((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));

  const validCount = recipients.filter((r) => r.email.trim().includes("@")).length;
  const ready = validCount > 0;

  const send = async () => {
    if (!ready || sending) return;
    setSending(true);
    setError("");
    setOutcomes(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/share-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipients
            .filter((r) => r.email.trim().includes("@"))
            .map((r) => ({ email: r.email.trim(), language: r.language })),
          includePdf,
          includeRecording,
          includeTranscript,
          transcriptMode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Couldn't send the pack.");
        return;
      }
      setOutcomes(data.results || []);
      if (data.shareUrl) setShareUrl(data.shareUrl);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    if (linking) return;
    setLinking(true);
    setError("");
    try {
      let url = shareUrl;
      if (!url) {
        const response = await fetch(`/api/meetings/${meetingId}/share`, { method: "POST" });
        const data = await response.json();
        if (!response.ok || !data.url) {
          setError(data.error || "Couldn't create a share link.");
          return;
        }
        url = data.url;
        setShareUrl(url);
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy the link.");
    } finally {
      setLinking(false);
    }
  };

  const options: Array<{
    key: string;
    on: boolean;
    toggle: () => void;
    title: string;
    blurb: string;
    icon: typeof FileText;
    disabled?: boolean;
  }> = [
    {
      key: "pdf",
      on: includePdf,
      toggle: () => setIncludePdf((v) => !v),
      title: "Summary attachment",
      blurb: "PDF where supported; a readable text file for other scripts. Includes decisions and tasks.",
      icon: FileText,
    },
    {
      key: "recording",
      on: includeRecording && !!hasRecording,
      toggle: () => hasRecording && setIncludeRecording((v) => !v),
      title: "Recording link",
      blurb: hasRecording ? "Link to sign in. Recipients must already have access to this meeting; emailing does not grant recording access." : "This meeting wasn't recorded, so there is no recording to send.",
      icon: VideoCamera,
      disabled: !hasRecording,
    },
    {
      key: "transcript",
      on: includeTranscript,
      toggle: () => setIncludeTranscript((v) => !v),
      title: "Full transcript",
      blurb: "Choose the original, a translated copy, or both. Originals stay unchanged.",
      icon: Translate,
    },
  ];

  return (
    <section className="mf-card rounded-3xl p-6 sm:p-7" aria-labelledby="share-pack-heading">
      <h2 id="share-pack-heading" className="text-xl font-bold tracking-tight">
        Send the meeting to everyone
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
        Choose what to send and a language for each person. Nothing is sent until you confirm.
      </p>
      {includeTranscript && (
        <label className="mt-4 block text-sm font-medium">
          Transcript attachments
          <select aria-label="Transcript attachments" value={transcriptMode} onChange={e => setTranscriptMode(e.target.value)} disabled={sending} className="ml-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2">
            <option value="original">Original languages</option>
            <option value="translated">Recipient’s language</option>
            <option value="both">Original + recipient’s language</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-[var(--muted)]">For a recipient with no language selected, we send the original.</span>
        </label>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">What to send</p>
          <div className="flex flex-col gap-2">
            {options.map(({ key, on, toggle, title, blurb, icon: Icon, disabled }) => (
              <button
                key={key}
                type="button"
                onClick={toggle}
                disabled={disabled || sending}
                aria-pressed={on}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition disabled:opacity-60 ${
                  on ? "border-violet-400/50 bg-violet-500/10" : "border-[var(--surface-border)] bg-[var(--surface)]"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                    on ? "brand-gradient-bg text-white" : "ring-1 ring-[var(--surface-border)]"
                  }`}
                >
                  {on && <Check size={14} weight="bold" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{blurb}</span>
                </span>
                <Icon size={18} className="shrink-0 text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Who gets it</p>
            <button type="button" onClick={addRow} disabled={sending || recipients.length >= 10} className="text-xs font-semibold text-violet-600 disabled:opacity-50">
              + add someone
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {recipients.map((recipient) => (
              <div key={recipient.id} className="flex items-center gap-2">
                <input
                  type="email"
                  disabled={sending}
                  aria-label="Recipient email"
                  value={recipient.email}
                  onChange={(e) => update(recipient.id, { email: e.target.value })}
                  placeholder="their@email.com"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
                <select
                  value={recipient.language}
                  disabled={sending}
                  onChange={(e) => update(recipient.id, { language: e.target.value })}
                  aria-label="Language for this person"
                  className="max-w-[40%] shrink-0 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="">Original</option>
                  {SPEECH_LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(recipient.id)}
                  disabled={sending}
                  aria-label="Remove this person"
                  className="shrink-0 rounded-xl p-2.5 text-[var(--muted)] hover:bg-red-500/5 hover:text-red-600"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Leave a person on Original to send it exactly as it was spoken.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-700">
          {error}
        </p>
      )}

      {outcomes && (
        <div role="status" className="mt-4 flex flex-col gap-1.5">
          {outcomes.map((outcome) => (
            <p
              key={outcome.email}
              className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
                outcome.sent ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {!outcome.sent
                ? `${outcome.email}: ${outcome.error || "Nothing was sent. Please try again."}`
                : outcome.translated
                  ? `Sent to ${outcome.email} in ${outcome.language}.`
                  : outcome.language !== "original"
                    ? `Sent to ${outcome.email}, in the original language because the ${outcome.language} translation could not be completed.`
                    : `Sent to ${outcome.email}.`}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-5">
        <button
          type="button"
          onClick={copyLink}
          disabled={linking}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--surface-border)] disabled:opacity-60"
        >
          <LinkSimple size={16} />
          {copied ? "Link copied" : linking ? "Getting link…" : "Copy a link instead"}
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!ready || sending}
          className="brand-gradient-bg inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {sending ? "Sending…" : validCount === 1 ? "Send to 1 person" : `Send to ${validCount} people`}
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </section>
  );
}
