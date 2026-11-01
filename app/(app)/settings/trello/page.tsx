"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Trello sends people back here with their token in the URL fragment, which
// never reaches a server. Hand it to MemoValet's server together with the state
// it was issued with, then go back to Settings to pick a list.
export default function TrelloReturnPage() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    const state = new URLSearchParams(window.location.search).get("state");
    // Out of the address bar and history straight away.
    window.history.replaceState(null, "", "/settings/trello");

    const finish = (result: "connected" | "failed") => router.replace(`/settings?trello=${result}#integrations`);
    if (!token || !state) {
      finish("failed");
      return;
    }
    fetch("/api/integrations/trello/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, state }),
    })
      .then((response) => finish(response.ok ? "connected" : "failed"))
      .catch(() => finish("failed"));
  }, [router]);

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-sm text-[var(--muted)]">Connecting Trello…</p>
    </div>
  );
}
