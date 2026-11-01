"use client";
import { useState } from "react";
export default function FileSharePanel({
  documents,
  onClose,
}: {
  documents: { id: string; title: string }[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState("memovalet");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ id: string; url: string } | null>(null);
  return (
    <section aria-label="Share selected files" className="mf-card mb-5 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Share {documents.length} selected file{documents.length === 1 ? "" : "s"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border px-3 py-1 text-sm"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {documents.map((file) => file.title).join(" · ")}
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setStatus("");
          try {
            const response = await fetch("/api/file-shares", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode,
                email,
                message,
                documentIds: documents.map((file) => file.id),
              }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Couldn't share these files");
            setResult({ id: data.id, url: data.url });
            setStatus(
              data.error ||
                (mode === "memovalet"
                  ? "Shared in MemoValet. The recipient can open it from notifications."
                  : "Email submitted. The viewing link expires in 7 days.")
            );
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Couldn't share these files");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !!result} className="space-y-3 disabled:opacity-70">
          <label className="block text-sm">
            Share through
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="ml-3 rounded-lg border bg-[var(--surface)] px-3 py-2"
            >
              <option value="memovalet">MemoValet</option>
              <option value="email">Email link</option>
            </select>
          </label>
          <label className="block text-sm">
            Recipient’s email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Message
            <textarea
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            {mode === "memovalet"
              ? "Only the selected MemoValet account and you can open this share."
              : "Anyone with the emailed link can view these selected files. Avoid using email links for sensitive documents."}{" "}
            Links expire after 7 days. Revoking a link cannot recall a downloaded copy.
          </p>
          <button
            type="submit"
            disabled={!documents.length || documents.length > 10}
            className="brand-gradient-bg rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sharing…" : "Confirm and share"}
          </button>
        </fieldset>
      </form>
      {status && (
        <p role="status" className="mt-4 text-sm">
          {status}
        </p>
      )}
      {result && (
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.url);
                setStatus("Link copied.");
              } catch {
                setStatus("Could not copy the link.");
              }
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Copy link
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const response = await fetch(`/api/file-shares?id=${result.id}`, {
                  method: "DELETE",
                });
                if (!response.ok) throw new Error();
                setResult(null);
                setStatus(
                  "Share revoked. Previously issued file URLs may remain usable for up to one minute."
                );
              } catch {
                setStatus("Could not revoke access. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg border px-3 py-2 text-sm text-red-700"
          >
            Revoke access
          </button>
        </div>
      )}
    </section>
  );
}
