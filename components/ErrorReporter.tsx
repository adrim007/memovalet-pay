"use client";

import { useEffect } from "react";

/**
 * Tells MemoValet when something breaks in a visitor's browser.
 *
 * Until now a fault in front of a person left no trace: the server logs only
 * hold a day, and a page that throws never reaches the server at all. This
 * sends a short line — what broke, which page, which build — and nothing that
 * says who they are (see lib/error-report).
 */
export default function ErrorReporter() {
  useEffect(() => {
    const sent = new Set<string>();
    const report = (message: unknown) => {
      const said = typeof message === "string" ? message : message instanceof Error ? message.message : "";
      if (!said) return;
      // The same fault on a loop must not become a flood of requests.
      const key = said.slice(0, 120);
      if (sent.has(key) || sent.size > 20) return;
      sent.add(key);
      void fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: said,
          place: window.location.pathname,
          release: process.env.NEXT_PUBLIC_BUILD_ID ?? null,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    const onError = (event: ErrorEvent) => report(event.message || event.error);
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
