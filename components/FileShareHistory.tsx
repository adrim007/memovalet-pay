"use client";
import { useEffect, useState } from "react";
type Share = {
  id: string;
  message: string;
  expires_at: string;
  revoked_at: string | null;
  expired: boolean;
};
export default function FileShareHistory() {
  const [shares, setShares] = useState<Share[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/file-shares")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (active) setShares(data.shares || []);
      })
      .catch(() => {
        if (active) setStatus("Share history couldn't be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="mt-6" aria-label="Manage file shares">
      <h2 className="text-sm font-semibold">Manage links you’ve shared</h2>
      <p role="status" className="my-2 text-xs text-[var(--muted)]">
        {status || "Revoking stops new access. It cannot recall copies already downloaded."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {shares.map((share) => (
          <div key={share.id} className="surface-card rounded-xl p-3 text-sm">
            <p className="truncate">{share.message || "Shared files"}</p>
            {share.revoked_at || share.expired ? (
              <p className="mt-2 text-xs text-[var(--muted)]">Access ended</p>
            ) : (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-red-700"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/file-shares?id=${share.id}`, {
                      method: "DELETE",
                    });
                    if (!response.ok) throw new Error();
                    setShares((previous) =>
                      previous.map((row) =>
                        row.id === share.id ? { ...row, revoked_at: new Date().toISOString() } : row
                      )
                    );
                    setStatus("Share revoked. Existing file URLs expire within one minute.");
                  } catch {
                    setStatus("Couldn't revoke access. Try again.");
                  }
                }}
              >
                Revoke access
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
