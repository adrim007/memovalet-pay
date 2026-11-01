"use client";

import { useEffect, useState } from "react";

/**
 * Asks the device not to sleep while `active` — used while recording.
 *
 * Without this, a phone left on the table dims, locks, and suspends the page,
 * and the recording stops partway through a meeting with nothing to say so.
 *
 * The lock is released by the browser every time the tab is hidden and is never
 * restored on its own, so it is re-requested on each return to visibility for as
 * long as recording continues. Best effort throughout: iOS only supports this
 * from 16.4, and a browser that refuses should not break recording — it only
 * means the screen behaves as it did before.
 */
export function useWakeLock(active: boolean) {
  const [warning, setWarning] = useState("");

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.wakeLock) return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;
    let acquiring = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (acquiring || (sentinel && !sentinel.released)) return;
      acquiring = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) { await lock.release(); return; }
        sentinel = lock;
        setWarning("");
        lock.addEventListener("release", () => {
          if (!cancelled) setWarning("Screen-awake protection was released. Keep this page visible and check your recording before continuing.");
        }, { once: true });
      } catch {
        if (!cancelled) setWarning("This device couldn't stay awake automatically. Keep the screen on and this page visible while recording.");
      } finally { acquiring = false; }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
  if (!active) return "";
  if (typeof navigator !== "undefined" && !navigator.wakeLock) return "Keep the screen on and this page visible. This browser has no screen-awake protection.";
  return warning;
}
