"use client";

import { matchesWorkFilter, type WorkFilter } from "@/lib/work-filter";
import { useState } from "react";
import { TaskAssignment } from "@/lib/types";
import { mapsUrl, handleMapsClick } from "@/lib/maps";
import { formatMoney, parseAmountToCents } from "@/lib/money";
import AddressInput from "@/components/AddressInput";
import DeleteButton from "@/components/DeleteButton";
import PriorityPicker from "@/components/PriorityPicker";

export default function SendTaskSection({
  assignments: initialAssignments,
  initiallyOpen = false,
  filter = "open",
}: {
  assignments: TaskAssignment[];
  initiallyOpen?: boolean;
  filter?: WorkFilter;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const visibleAssignments = assignments.filter(a => matchesWorkFilter(filter, a.status, a.due_date));
  const [showForm, setShowForm] = useState(initiallyOpen);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [amount, setAmount] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [chargeNotice, setChargeNotice] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindedId, setRemindedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [postingNoteId, setPostingNoteId] = useState<string | null>(null);

  const sendTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim() || !title.trim() || sending) return;

    const amountCents = amount.trim() ? parseAmountToCents(amount) : null;
    if (amount.trim() && !amountCents) {
      setError("Please enter a valid price, such as 120 or 85.50.");
      return;
    }
    if (amountCents && !customerEmail.trim()) {
      setError("Add the customer's email so they can be charged when the job is done.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/task-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate || null,
          location: location.trim(),
          amountCents,
          customerEmail: customerEmail.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Couldn't send that task.");
        return;
      }

      setAssignments((prev) => [data.assignment, ...prev]);
      if (data.emailed === false) {
        setNotice(
          `Task saved, but the email to ${recipientEmail.trim()} didn't go out. Use "Copy link" below and send it to them directly.`
        );
      }
      setRecipientEmail("");
      setTitle("");
      setDescription("");
      setDueDate("");
      setLocation("");
      setAmount("");
      setCustomerEmail("");
      setShowForm(false);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/assigned/${id}`;
    navigator.clipboard.writeText(url);
    setLinkCopiedId(id);
    setTimeout(() => setLinkCopiedId(null), 2000);
  };

  const sendPaymentLink = async (id: string) => {
    if (chargingId) return;
    setChargingId(id);
    setChargeNotice(null);
    try {
      const response = await fetch(`/api/task-assignments/${id}/charge`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setChargeNotice({ id, ok: false, text: data.error || "Couldn't send the payment link." });
        return;
      }
      setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, payment_status: "pending" } : a)));
      setChargeNotice({
        id,
        ok: true,
        text: data.emailed
          ? "Payment link emailed to the customer."
          : `Payment page is ready but the email didn't go out. Send them this link: ${data.url}`,
      });
    } catch {
      setChargeNotice({ id, ok: false, text: "Something went wrong. Try again." });
    } finally {
      setChargingId(null);
    }
  };

  const remindThem = async (id: string) => {
    setRemindingId(id);
    try {
      const response = await fetch(`/api/task-assignments/${id}/remind`, { method: "POST" });
      if (!response.ok) throw new Error("failed");
      setRemindedId(id);
      setTimeout(() => setRemindedId(null), 3000);
    } catch {
      setError("Couldn't send that reminder. Try again.");
    } finally {
      setRemindingId(null);
    }
  };

  const postNote = async (id: string) => {
    const text = (noteDrafts[id] || "").trim();
    if (!text || postingNoteId === id) return;

    setPostingNoteId(id);
    try {
      const response = await fetch(`/api/task-assignments/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author: "sender" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "failed");

      setAssignments((prev) => prev.map((a) => (a.id === id ? data.assignment : a)));
      setNoteDrafts((prev) => ({ ...prev, [id]: "" }));
    } catch {
      setError("Couldn't post that update. Try again.");
    } finally {
      setPostingNoteId(null);
    }
  };

  const inputClasses =
    "w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20";

  return (
    <div className="surface-card rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Send a task
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-medium text-[var(--muted)] hover:text-current transition"
        >
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>
      <p className="text-sm text-[var(--muted)] mb-4">
        Send a task by email. The recipient can open the link, mark the task as complete
        and attach a photo or video without a MemoValet account.
      </p>

      {showForm && (
        <form onSubmit={sendTask} className="space-y-2.5 mb-4">
          <label className="block">
            <span className="sr-only">Recipient email</span>
            <input
              type="email"
              placeholder="Recipient email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className={inputClasses}
              required
            />
          </label>
          <label className="block">
            <span className="sr-only">Task title</span>
            <input
              type="text"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClasses}
              required
            />
          </label>
          <label className="block">
            <span className="sr-only">Task details</span>
            <textarea
              placeholder="Details (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputClasses} resize-none`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Due date (optional)</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClasses}
            />
          </label>
          <AddressInput
            ariaLabel="Location"
            placeholder="Location (optional)"
            value={location}
            onChange={setLocation}
            className={inputClasses}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Charge the customer (optional)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 120"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClasses}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Customer email</span>
              <input
                type="email"
                placeholder="Who pays when it's done"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className={inputClasses}
              />
            </label>
          </div>
          {amount.trim() && (
            <p className="text-xs text-[var(--muted)]">
              When the job is marked done, the customer gets a secure Stripe payment link for{" "}
              {parseAmountToCents(amount) ? formatMoney(parseAmountToCents(amount) as number) : "that amount"}. Needs
              Stripe connected in Settings → Get paid.
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="w-full brand-gradient-bg text-white font-medium py-2.5 rounded-xl transition hover:opacity-90 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send task"}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400 mb-4">{error}</p>}
      {notice && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-4" role="status">
          {notice}
        </p>
      )}

      {visibleAssignments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sent by you
          </p>
          {visibleAssignments.map((a) => {
            const expanded = expandedId === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-[var(--surface-border)]">
                {/* On a phone the buttons used to squeeze the title to nothing;
                    now the title keeps the first line and the buttons wrap below. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${a.status === "done" ? "brand-gradient-bg" : "border border-[var(--surface-border)]"}`}
                  />
                  <div className="min-w-0 grow shrink basis-[calc(100%-1.25rem)] sm:basis-0">
                    <p
                      className={`text-sm font-medium truncate ${a.status === "done" ? "line-through text-[var(--muted)]" : ""}`}
                    >
                      {a.title}
                    </p>
                    <p className="text-xs text-[var(--muted)] truncate">
                      {a.recipient_email}
                      {a.due_date ? ` · due ${a.due_date}` : ""}
                      {a.amount_cents
                        ? ` · ${formatMoney(a.amount_cents, a.currency || "aud")} ${
                            a.payment_status === "paid"
                              ? "paid ✓"
                              : a.payment_status === "pending"
                                ? "payment link sent"
                                : a.payment_status === "failed"
                                  ? "payment failed"
                                  : "to charge when done"
                          }`
                        : ""}
                      {a.status === "done" && a.completion_note ? ` · "${a.completion_note}"` : ""}
                    </p>
                  </div>
                  <PriorityPicker
                    kind="sent-task"
                    id={a.id}
                    value={a.priority}
                    name={a.title}
                    onChanged={(priority) =>
                      setAssignments((prev) =>
                        prev.map((other) => (other.id === a.id ? { ...other, priority } : other))
                      )
                    }
                  />
                  {a.amount_cents && a.payment_status !== "paid" && (
                    <button
                      type="button"
                      onClick={() => sendPaymentLink(a.id)}
                      disabled={chargingId === a.id}
                      className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 shrink-0 disabled:opacity-60"
                    >
                      {chargingId === a.id
                        ? "Sending…"
                        : a.payment_status === "pending"
                          ? "Resend payment link"
                          : "Send payment link"}
                    </button>
                  )}
                  {a.location && (
                    <a
                      href={mapsUrl(a.location)}
                      onClick={handleMapsClick(a.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 shrink-0"
                    >
                      Map
                    </a>
                  )}
                  {a.completion_file_url && (
                    <a
                      href={a.completion_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 shrink-0"
                    >
                      View
                    </a>
                  )}
                  {a.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => remindThem(a.id)}
                      disabled={remindingId === a.id}
                      className="text-xs font-medium text-[var(--muted)] hover:text-current transition shrink-0 disabled:opacity-60"
                    >
                      {remindingId === a.id
                        ? "Sending…"
                        : remindedId === a.id
                          ? "Sent ✓"
                          : "Remind them"}
                    </button>
                  )}
                  {a.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => copyLink(a.id)}
                      className="text-xs font-medium text-[var(--muted)] hover:text-current transition shrink-0"
                    >
                      {linkCopiedId === a.id ? "Copied" : "Copy link"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                    className="text-[var(--muted)] hover:text-current transition shrink-0"
                    aria-label={expanded ? "Hide updates" : "Show updates"}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <DeleteButton
                    kind="sent-task"
                    id={a.id}
                    noun="job"
                    name={a.title}
                    detail={`The link you sent stops working.${
                      a.amount_cents ? " What was charged stays on your payment record." : ""
                    }`}
                    onDeleted={() => setAssignments((prev) => prev.filter((other) => other.id !== a.id))}
                  />
                </div>
                {chargeNotice && chargeNotice.id === a.id && (
                  <p
                    role="status"
                    className={`mx-3.5 mb-2.5 rounded-lg px-3 py-2 text-xs font-medium ${
                      chargeNotice.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {chargeNotice.text}
                  </p>
                )}

                {expanded && (
                  <div className="border-t border-[var(--surface-border)] px-3.5 py-3 space-y-2">
                    {a.notes.length > 0 && (
                      <div className="space-y-1.5">
                        {a.notes.map((n, i) => (
                          <p key={i} className="text-xs text-[var(--muted)]">
                            <span className="font-medium text-[var(--foreground)]">
                              {n.author === "sender" ? "You" : a.recipient_email}:
                            </span>{" "}
                            {n.text}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add an update…"
                        value={noteDrafts[a.id] || ""}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") postNote(a.id);
                        }}
                        className="flex-1 rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-1.5 text-xs placeholder:text-[var(--muted)] outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => postNote(a.id)}
                        disabled={postingNoteId === a.id || !(noteDrafts[a.id] || "").trim()}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg brand-gradient-bg text-white disabled:opacity-60 shrink-0"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
