"use client";

import { useState } from "react";

// Opens the follow-up as a ready-to-edit email instead of creating a Gmail
// draft through Google's API — that needed a Gmail permission MemoValet
// doesn't ask for, so it failed every time. A compose link needs no
// permission at all and works whether or not Google is connected.
export default function FollowUpEmailActions({ subject, body }: { subject: string; body: string }) {
  const [copied, setCopied] = useState(false);

  const gmail =
    "https://mail.google.com/mail/?" + new URLSearchParams({ view: "cm", fs: "1", su: subject, body }).toString();
  // mailto wants %20 for spaces, not +, or some mail apps show the plus signs.
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subject ? `${subject}\n\n${body}` : body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is on screen to select by hand.
    }
  };

  const button =
    "rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold transition hover:border-indigo-400/40 hover:bg-indigo-400/5";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a href={gmail} target="_blank" rel="noopener noreferrer" className={button}>
        Open in Gmail
      </a>
      <a href={mailto} className={button}>
        Open in email app
      </a>
      <button type="button" onClick={copy} className={button}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
