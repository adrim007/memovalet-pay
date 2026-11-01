"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowsClockwise, CalendarPlus, Check, Copy, MicrosoftOutlookLogo, Power, ShieldCheck, X } from "@phosphor-icons/react";
import { AppleIcon, GoogleCalendarIcon } from "@/components/marketing/BrandIcons";
import GoogleCalendarSync from "@/components/GoogleCalendarSync";

type Links = { url: string; apple: string; google: string };

/**
 * Puts your MemoValet calendar into Google Calendar, Apple Calendar or
 * Outlook: a private link those apps subscribe to and check on their own.
 * Your open tasks, deadlines and calls show there, and follow changes made
 * here. The link is made the first time the window opens (app/api/calendar/feed).
 */
export default function CalendarSync({ buttonClass, preview = false }: { buttonClass: string; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<Links | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<"reset" | "off" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const shut = useCallback(() => {
    setOpen(false);
    setConfirming(null);
    window.requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    if (!modal) return;
    const previous = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => { modal.close(); document.body.style.overflow = previous; };
  }, [open, shut]);



  const call = async (method: "POST" | "DELETE", body?: object) => {
    setConfirming(null);
    if (preview) {
      setLinks(method === "DELETE" ? null : { url: "https://memovalet.com/api/calendar/feed/your-private-link.ics", apple: "#", google: "#" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/calendar/feed", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setLinks(data.url ? data : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const show = () => {
    setOpen(true);
    if (!links) void call("POST");
  };

  // The tour's "Sync your calendar" lands here with ?sync=1: open straight away,
  // then tidy the address so a reload doesn't open it again.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sync") !== "1") return;
    const frame = window.requestAnimationFrame(() => {
      url.searchParams.delete("sync");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      show();
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link. Select it and copy it instead.");
    }
  };

  const add = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition";
  const primary = `${add} bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950`;
  const secondary = `${add} border border-[var(--surface-border)] hover:border-indigo-400`;
  const waiting = !links;
  const inert = (disabled: boolean) => (disabled ? { "aria-disabled": true, tabIndex: -1, onClick: (e: React.MouseEvent) => e.preventDefault() } : {});

  const rows = [
    { name: "Apple Calendar", note: "iPhone, iPad and Mac", icon: <AppleIcon className="h-[19px] w-[19px] dark:invert" />, action: <a href={links?.apple ?? "#"} className={primary} {...inert(waiting || preview)}>Add</a> },
    { name: "Google Calendar", note: "Updates every few hours", icon: <GoogleCalendarIcon className="h-5 w-5" />, action: <a href={links?.google ?? "#"} target="_blank" rel="noopener noreferrer" className={primary} {...inert(waiting || preview)}>Add</a> },
    { name: "Outlook and others", note: "Paste your link", icon: <MicrosoftOutlookLogo size={22} weight="fill" className="text-[#0a64c8]" />, action: <button type="button" onClick={copy} disabled={waiting} className={secondary}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? "Copied" : "Copy link"}</button> },
  ];

  return (
    <>
      <button ref={trigger} type="button" className={buttonClass} onClick={show} aria-haspopup="dialog">
        <CalendarPlus size={18} aria-hidden="true" /> Sync calendar
      </button>
      {open && createPortal(
        <dialog ref={dialog} aria-labelledby="calendar-sync-title" aria-describedby="calendar-sync-intro" onCancel={(event) => { event.preventDefault(); shut(); }} onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]')).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }} className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none items-end justify-center border-0 bg-[#0b0a1f]/45 p-0 text-[var(--foreground)] backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) shut(); }}>
          <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-6 shadow-[0_30px_90px_rgba(20,14,60,0.35)] ring-1 ring-black/5 sm:max-w-[29rem] sm:rounded-3xl sm:p-7">
            <header className="flex items-start gap-4">
              <span className="brand-gradient-bg grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/25">
                <CalendarPlus size={22} weight="duotone" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="calendar-sync-title" className="text-lg font-bold tracking-tight">Sync with your calendar</h2>
                <p id="calendar-sync-intro" className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  See your MemoValet tasks, deadlines and calls in the calendar you already use. They stay up to date on their own.
                </p>
              </div>
              <button ref={close} type="button" onClick={shut} className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)]" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <GoogleCalendarSync preview={preview} />

            {error ? <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-600">{error}</p> : null}

            <h3 className="mt-6 text-sm font-bold">Calendar subscription links</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">View your work in another calendar. Make changes in MemoValet. Your calendar app decides when to refresh its copy.</p>
            <ul className="mt-3 divide-y divide-[var(--surface-border)] overflow-hidden rounded-2xl border border-[var(--surface-border)]" aria-busy={waiting && busy}>
              {rows.map((row) => (
                <li key={row.name} className="flex items-center gap-3.5 px-4 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-black/[0.06] dark:bg-white/10">{row.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{row.name}</span>
                    <span className="block text-xs text-[var(--muted)]">{row.note}</span>
                  </span>
                  {row.action}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Your private link</p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-black/[0.02] py-1.5 pl-3.5 pr-1.5 dark:bg-white/[0.03]">
                {links ? (
                  <input readOnly value={links.url} onFocus={(event) => event.currentTarget.select()} aria-label="Your private calendar link" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-[var(--muted)] outline-none" />
                ) : (
                  <span role="status" className="flex-1 text-xs text-[var(--muted)]">{busy ? "Making your private link…" : "No link yet"}</span>
                )}
                <button type="button" onClick={copy} disabled={waiting} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition hover:bg-black/5 disabled:opacity-40">
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {!links && !busy ? (
                <button type="button" onClick={() => void call("POST")} className={`${primary} mt-3`}>Make my calendar link</button>
              ) : null}
            </div>

            <p className="mt-5 flex gap-2.5 text-xs leading-5 text-[var(--muted)]">
              <ShieldCheck size={16} className="mt-px shrink-0 text-emerald-600" aria-hidden="true" />
              <span>Keep this link to yourself: anyone who has it can see these items. Changes flow one way, from MemoValet to your calendar.</span>
            </p>

            <footer className="mt-5 border-t border-[var(--surface-border)] pt-4">
              {confirming ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Confirm">
                  <p className="min-w-0 flex-1 text-xs leading-5">
                    {confirming === "reset"
                      ? "Make a new link? Calendars using the current one will stop updating until you add the new one."
                      : "Turn the link off? Calendars using it will stop updating."}
                  </p>
                  <button type="button" onClick={() => setConfirming(null)} className="h-8 rounded-lg px-3 text-xs font-semibold text-[var(--muted)] hover:bg-black/5">Cancel</button>
                  <button type="button" onClick={() => void (confirming === "reset" ? call("POST", { reset: true }) : call("DELETE"))} className={`h-8 rounded-lg px-3 text-xs font-semibold text-white ${confirming === "off" ? "bg-red-600 hover:bg-red-700" : "bg-slate-950 hover:bg-slate-800"}`}>
                    {confirming === "reset" ? "Make new link" : "Turn off"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <button type="button" disabled={waiting || busy} onClick={() => setConfirming("reset")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40">
                    <ArrowsClockwise size={14} aria-hidden="true" /> Make a new link
                  </button>
                  <button type="button" disabled={waiting || busy} onClick={() => setConfirming("off")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-40">
                    <Power size={14} aria-hidden="true" /> Turn off
                  </button>
                </div>
              )}
              {preview ? <p className="mt-3 text-[11px] font-semibold text-indigo-600">Preview: nothing is saved.</p> : null}
            </footer>
          </section>
        </dialog>,
        document.body,
      )}
    </>
  );
}
