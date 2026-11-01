"use client";

import { useState } from "react";

export default function MeetingActions({ meetingId }: { meetingId: string }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState("");

  const [shareUrl, setShareUrl] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    if (!target || sending) return;

    setSending(true);
    setSendResult("");

    try {
      const response = await fetch(`/api/meetings/${meetingId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok) {
        setSendResult(data?.withPdf === false
          ? `Sent to ${target} as text because the PDF could not be created.`
          : "Sent to " + target);
        setEmail("");
      } else {
        // Say what actually went wrong; "try again" on a send that can never
        // work just makes people try again.
        setSendResult(data?.error || "Couldn't send that. Try again.");
      }
    } catch {
      setSendResult("Couldn't send that. Try again.");
    } finally {
      setSending(false);
    }
  };

  const handleGetLink = async () => {
    setGeneratingLink(true);
    setCopied(false);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/share`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        if (data.url) setShareUrl(data.url);
      }
    } catch {
      // leave shareUrl empty if it fails
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // clipboard access can fail silently, nothing to do
    }
  };

  return (
    <div className="surface-card rounded-2xl p-6 md:p-7 space-y-5 shadow-xl shadow-indigo-500/5">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
        Share This Meeting
      </h2>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
          Email a PDF to someone
        </p>
        <form onSubmit={handleSendEmail} className="flex items-center gap-2">
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="brand-gradient-bg text-white font-medium px-4 py-2.5 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50 shrink-0"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
        {sendResult && <p className="text-xs text-[var(--muted)] mt-2">{sendResult}</p>}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
          Or share a link
        </p>
        {!shareUrl ? (
          <button
            type="button"
            onClick={handleGetLink}
            disabled={generatingLink}
            className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] transition hover:border-indigo-400/40 hover:bg-indigo-400/5 disabled:opacity-60"
          >
            {generatingLink ? "Creating link…" : "Get a shareable link"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] transition hover:border-indigo-400/40 hover:bg-indigo-400/5 shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--muted)] mt-2">
          Anyone with this link can view the summary. Paste it into a text, email, or chat.
        </p>
      </div>
    </div>
  );
}
