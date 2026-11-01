"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Notification } from "@/lib/types";

const POLL_MS = 60 * 1000;

function subscribeNoop() {
  return () => {};
}

function getMountedTrue() {
  return true;
}

function getMountedFalse() {
  return false;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const mounted = useSyncExternalStore(subscribeNoop, getMountedTrue, getMountedFalse);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const fetchNotifications = () => {
    fetch("/api/notifications")
      .then((res) => { if (!res.ok) throw new Error("unavailable"); return res.json(); })
      .then((data) => {
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
        setError("");
      })
      .catch(() => setError("Couldn't refresh notifications. Please try again."));
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open && buttonRef.current) {
      fetchNotifications();
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = 320;
      const left = Math.min(rect.left, window.innerWidth - panelWidth - 12);
      setPanelPos({ top: rect.bottom + 8, left: Math.max(12, left) });
    }
    setOpen((v) => !v);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const openNotification = async (n: Notification) => {
    if (!n.read) {
      try {
        const response = await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
        if (!response.ok) throw new Error("not saved");
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      } catch { setError("Couldn't mark this notification as read."); }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) throw new Error("not saved");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setError("");
    } catch {
      setError("Couldn't mark notifications as read. Please try again.");
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={open ? "notification-panel" : undefined}
        className="relative flex items-center justify-center h-11 w-11 rounded-xl border border-[var(--surface-border)] text-[var(--muted)] hover:border-indigo-400/40 hover:text-[var(--foreground)] transition shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-4 w-4"
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        panelPos &&
        createPortal(
          <div
            id="notification-panel"
            role="region"
            aria-label="Notifications"
            ref={panelRef}
            style={{ top: panelPos.top, left: panelPos.left }}
            className="fixed w-80 max-w-[90vw] surface-card rounded-2xl shadow-xl shadow-indigo-500/10 z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[min(20rem,60dvh)] overflow-y-auto">
              {error && <p role="status" className="px-4 py-3 text-xs text-red-500">{error} <button type="button" onClick={fetchNotifications} className="underline">Retry</button></p>}
              {!error && notifications.length === 0 && (
                <div className="px-5 py-7 text-center">
                  <p className="text-sm font-semibold">You&apos;re all caught up</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Task updates, accepted invites, and approaching deadlines will appear here.
                  </p>
                  <Link
                    href="/settings#notifications"
                    onClick={() => setOpen(false)}
                    className="mt-4 inline-flex text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                  >
                    Choose notifications
                  </Link>
                </div>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`block w-full text-left px-4 py-3 border-b border-[var(--surface-border)] last:border-b-0 transition hover:bg-indigo-400/5 ${
                    !n.read ? "bg-indigo-400/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full brand-gradient-bg shrink-0" />
                    )}
                    <div className={`min-w-0 flex-1 ${n.read ? "pl-3.5" : ""}`}>
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[var(--muted)] mt-1">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
