"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOCAL_DAY_COOKIE, localDayStamp } from "@/lib/local-day";

/** Keep server-rendered priorities aligned with this device, including midnight and travel. */
export default function LocalDaySync() {
  const router = useRouter();
  useEffect(() => {
    let lastAttempt = "";
    const sync = () => {
      if (document.visibilityState === "hidden") return;
      const stamp = encodeURIComponent(localDayStamp(Intl.DateTimeFormat().resolvedOptions().timeZone));
      const current = document.cookie.split("; ").find(value => value.startsWith(`${LOCAL_DAY_COOKIE}=`))?.slice(LOCAL_DAY_COOKIE.length + 1);
      if (stamp === current || stamp === lastAttempt) return;
      lastAttempt = stamp;
      document.cookie = `${LOCAL_DAY_COOKIE}=${stamp}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      router.refresh();
    };
    sync();
    const timer = window.setInterval(sync, 30_000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [router]);
  return null;
}
