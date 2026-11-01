"use client";

import { useCallback, useEffect, useState } from "react";
import { ShareNetwork } from "@phosphor-icons/react";

type ItemType = "note" | "project" | "meeting";
type Recipient = { userId: string; label: string };

// The share form on its own, for screens that place the Share button
// themselves (e.g. in a row of actions) and just need the inline form.
// Shows who already has access, with a Remove button per person.
export function ShareForm({
  itemType,
  itemId,
  onClose,
}: {
  itemType: ItemType;
  itemId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    try {
      const response = await fetch(`/api/shares?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`);
      const data = await response.json();
      setRecipients(response.ok && Array.isArray(data.recipients) ? data.recipients : []);
    } catch {
      setRecipients([]);
    }
  }, [itemType, itemId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shares?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`)
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!cancelled) setRecipients(ok && Array.isArray(data.recipients) ? data.recipients : []);
      })
      .catch(() => {
        if (!cancelled) setRecipients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  const share = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    if (!target || sending) return;
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, email: target }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult({ ok: false, message: data.error || "Couldn't share that." });
      } else if (data.shared) {
        setResult({
          ok: true,
          message: `Shared with ${target}. They can view it in MemoValet${data.emailed ? " and by email" : ""}.`,
        });
        setEmail("");
        void loadRecipients();
      } else if (data.emailed) {
        setResult({ ok: true, message: `${target} doesn't have MemoValet yet, so we emailed it to them instead.` });
        setEmail("");
      } else {
        setResult({
          ok: false,
          message: `${target} doesn't have a MemoValet account, and the email didn't go out. Ask them to sign up, then share again.`,
        });
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong. Try again." });
    } finally {
      setSending(false);
    }
  };

  const remove = async (recipient: Recipient) => {
    if (removingId) return;
    setRemovingId(recipient.userId);
    setResult(null);
    try {
      const response = await fetch(
        `/api/shares?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}&userId=${encodeURIComponent(recipient.userId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setResult({ ok: false, message: data.error || "Couldn't remove their access." });
        return;
      }
      setRecipients((prev) => (prev || []).filter((r) => r.userId !== recipient.userId));
      setResult({ ok: true, message: `${recipient.label} no longer has access.` });
    } catch {
      setResult({ ok: false, message: "Something went wrong. Try again." });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <form onSubmit={share} className="mt-3 w-full rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
      <label htmlFor={`share-${itemId}`} className="mb-1.5 block text-xs font-semibold">
        Share this {itemType} with someone
      </label>
      <div className="flex gap-2">
        <input
          id={`share-${itemId}`}
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their email"
          className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="brand-gradient-bg rounded-xl px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {sending ? "Sharing…" : "Share"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-xs font-semibold"
        >
          Close
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">
        If they use MemoValet it appears in their account with a notification. If not, they get it by email.
      </p>

      {recipients && recipients.length > 0 && (
        <div className="mt-3 border-t border-indigo-200/70 pt-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Has access
          </p>
          <ul className="space-y-1">
            {recipients.map((recipient) => (
              <li key={recipient.userId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{recipient.label}</span>
                <button
                  type="button"
                  onClick={() => remove(recipient)}
                  disabled={removingId === recipient.userId}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-red-500/5 hover:text-red-600 disabled:opacity-60"
                >
                  {removingId === recipient.userId ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <p
          role="status"
          className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${
            result.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}

// Button + form together, for screens with a single header action row.
export default function ShareWithUser({ itemType, itemId }: { itemType: ItemType; itemId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
      >
        <ShareNetwork size={14} weight="bold" />
        Share
      </button>
    );
  }

  return <ShareForm itemType={itemType} itemId={itemId} onClose={() => setOpen(false)} />;
}
