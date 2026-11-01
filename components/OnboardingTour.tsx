"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Books, CalendarPlus, ChartBar, Check, Compass, Gear, House, ListChecks, NotePencil, Sparkle, Users, VideoCamera, X } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { onboardingStorageKey, tourPanelPosition, type TourRect } from "@/lib/onboarding";
import "./OnboardingTour.css";

export interface OnboardingTourProps {
  firstName: string;
  userId?: string;
  showInitially: boolean;
  replayRequested?: boolean;
  personal?: boolean;
  preview?: boolean;
}

export default function OnboardingTour({ firstName, userId, showInitially, replayRequested = false, personal = false, preview = false }: OnboardingTourProps) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [welcoming, setWelcoming] = useState(showInitially);
  const [syncFailed, setSyncFailed] = useState(false);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const started = useRef(false);
  const saved = useRef(false);
  const saving = useRef(false);
  const storageKey = userId ? onboardingStorageKey(userId) : null;

  const steps = [
    { target: null, icon: Sparkle, label: "LET’S GET YOU COMFORTABLE", title: `Welcome${firstName ? `, ${firstName}` : ""}. Make yourself at home.`, body: "We’ll point out the places you’ll use most, one at a time. Your dashboard stays in view as we go.", tip: "Use Next and Back to look around. You can leave or replay the tour anytime." },
    { target: "search-control", icon: House, label: "01 / SEARCH & CREATE", title: "Start with this search box.", body: "Find saved work or ask a question here. Choose Create to add a task or note.", tip: "Try Create → “Send the proposal tomorrow”." },
    { target: "nav-meeting", icon: VideoCamera, label: "02 / MEETINGS", title: "Your conversations start here.", body: "Open Meetings to start a call, record a conversation or add a transcript.", tip: "Your summaries, decisions and next steps stay with the meeting." },
    { target: "nav-library", icon: Books, label: "03 / LIBRARY & CALENDAR", title: "Find your saved work here.", body: "Library brings together your saved work. Use its Calendar tab to revisit a day, month or year.", tip: "Library → Calendar, Files or Notes. Pick the view you need." },
    { target: "nav-library", icon: CalendarPlus, label: "04 / YOUR OWN CALENDAR", title: "See your tasks in Google or Apple Calendar.", body: "Sync MemoValet with the calendar you already use. Your tasks, deadlines and calls show up there and stay up to date.", tip: "Library → Calendar → Sync calendar. One tap for Apple or Google." },
    { target: "nav-work", icon: ListChecks, label: personal ? "05 / TASKS" : "05 / WORK", title: "Keep track of the next step.", body: `Open ${personal ? "Tasks" : "Work"} for tasks, due dates and projects. See what you owe and what you’re waiting on.`, tip: "Start with one task and give it a due date." },
    { target: "nav-people", icon: Users, label: "06 / PEOPLE", title: "Find your people here.", body: "Keep contacts together and use Groups to organise the people you work with.", tip: "Explore on your own first. Invite people when you’re ready." },
    { target: "nav-insights", icon: ChartBar, label: "07 / INSIGHTS", title: "See your progress over time.", body: "Review meeting activity and task progress as you use MemoValet.", tip: "An empty view is normal at first. Your activity will build it up." },
    { target: "nav-settings", icon: Gear, label: "08 / SETTINGS", title: "Make it feel like your workspace.", body: "Manage your profile, security, notifications and connections here.", tip: "To replay this guide: Settings → Product tour." },
    { target: null, icon: Check, label: "YOU’RE READY", title: "What would you like to do first?", body: "Choose a starting point, or head back to your dashboard and explore.", tip: "The Tour button on Home brings this back whenever you like." },
  ];
  const step = steps[stepIndex];
  const last = stepIndex === steps.length - 1;
  const Icon = step.icon;

  useEffect(() => {
    if (started.current) return;
    let dismissed = false;
    try { dismissed = Boolean(storageKey && localStorage.getItem(storageKey) === "done"); } catch { /* Account preference remains available when storage is blocked. */ }
    const timer = window.setTimeout(() => {
      if (started.current) return;
      started.current = true;
      setWelcoming(showInitially && !dismissed);
      if (replayRequested || (showInitially && !dismissed)) setActive(true);
      if (replayRequested) {
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [replayRequested, showInitially, storageKey]);

  const persist = useCallback(async () => {
    if (saving.current || saved.current || preview || !userId) return;
    saving.current = true;
    setSyncFailed(false);
    try {
      const { error } = await createClient().auth.updateUser({ data: { onboarding_completed: true } });
      if (error) throw error;
      saved.current = true;
    } catch { setSyncFailed(true); }
    finally { saving.current = false; }
  }, [preview, userId]);

  const finish = useCallback(() => {
    try { if (storageKey) localStorage.setItem(storageKey, "done"); } catch { /* Still persist to the account. */ }
    setActive(false);
    setWelcoming(false);
    void persist();
  }, [persist, storageKey]);

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousScroll = window.scrollY;
    const launchButton = launchRef.current;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      window.scrollTo({ top: previousScroll, behavior: "instant" });
      launchButton?.focus({ preventScroll: true });
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (panelRef.current) panelRef.current.scrollTop = 0;
    const target = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) ?? document.querySelector<HTMLElement>('[data-tour="nav-home"]') : null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: step.target === "search-control" || window.innerWidth < 768 ? "start" : "center", inline: "center" });
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = target?.getBoundingClientRect();
        const nextRect = bounds && bounds.width > 0 && bounds.height > 0 ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height } : null;
        setRect(nextRect);
        const panel = panelRef.current?.getBoundingClientRect();
        if (panel) {
          const content = panelRef.current?.querySelector<HTMLElement>(".memo-welcome-content");
          const top = panelRef.current?.querySelector<HTMLElement>(".memo-welcome-top");
          const bottom = panelRef.current?.querySelector<HTMLElement>(".memo-welcome-bottom");
          const height = step.target && content && top && bottom ? content.scrollHeight + top.offsetHeight + bottom.offsetHeight + 5 : panel.height;
          setPosition(tourPanelPosition({ width: window.innerWidth, height: window.innerHeight }, { width: panel.width, height }, nextRect));
        }
      });
    };
    measure();
    headingRef.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(measure);
    if (panelRef.current) observer.observe(panelRef.current);
    if (target) observer.observe(target);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [active, step.target, stepIndex]);

  const open = () => { started.current = true; setStepIndex(0); setPosition(null); setRect(null); setActive(true); };
  const changeStep = (index: number) => { setStepIndex(index); };
  const go = (path: string) => { finish(); router.push(preview ? `/preview${path}` : path); };

  return (
    <>
      {/* A small button beside Customise. It was a full-width banner under the
          greeting on every visit; new people have the tour opened for them
          anyway, so the banner mostly stood between everyone else and their
          work. A new account's button is lit until the tour is done. */}
      <span className="relative inline-flex">
        <button
          ref={launchRef}
          type="button"
          onClick={open}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold shadow-sm transition-colors ${welcoming ? "border-violet-300 bg-violet-50 text-violet-700 hover:border-violet-400 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-violet-200" : "border-[var(--surface-border)] bg-[var(--surface)] hover:border-indigo-400"}`}
        >
          <Compass size={18} weight={welcoming ? "fill" : "regular"} aria-hidden="true" />
          <span className="hidden sm:inline">{welcoming ? "Show me around" : "Tour"}</span>
          <span className="sr-only sm:hidden">Take the tour</span>
        </button>
        {syncFailed && (
          <span role="status" className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-xs shadow-lg">
            Your tour preference couldn’t sync to your account.{" "}
            <button type="button" className="font-semibold text-indigo-600 underline" onClick={() => void persist()}>Try again</button>
          </span>
        )}
      </span>
      <dialog ref={dialogRef} className="memo-welcome-dialog" aria-labelledby="welcome-title" aria-describedby="welcome-description" onCancel={(event) => { event.preventDefault(); finish(); }} onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
        const first = controls[0];
        const lastControl = controls[controls.length - 1];
        if (!first || !lastControl) return;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
          event.preventDefault(); lastControl.focus();
        } else if (!event.shiftKey && document.activeElement === lastControl) {
          event.preventDefault(); first.focus();
        }
      }}>
        {active && <>
          <div className={rect ? "memo-welcome-spotlight" : "memo-welcome-shade"} aria-hidden="true" style={rect ? { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 } : undefined} />
          <div ref={panelRef} className={`memo-welcome-panel${step.target ? " memo-welcome-guided" : ""}`} style={position ? { top: position.top, left: position.left, maxHeight: position.maxHeight } : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
            <div className="memo-welcome-top"><span><Compass size={15} aria-hidden="true" /> YOUR QUICK TOUR</span><button type="button" onClick={finish} aria-label="Skip tour"><X size={20} aria-hidden="true" /></button></div>
            <div className="memo-welcome-track" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={stepIndex + 1}><span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div>
            <div className="memo-welcome-content" key={stepIndex}>
              <span className="memo-welcome-step-icon"><Icon size={32} weight="duotone" aria-hidden="true" /></span>
              <p className="memo-welcome-eyebrow">{step.label}</p>
              <h2 ref={headingRef} tabIndex={-1} id="welcome-title">{step.title}</h2>
              <p id="welcome-description">{step.body}</p>
              <div className="memo-welcome-tip"><Sparkle size={17} aria-hidden="true" /><p>{step.tip}</p></div>
              {last && <div className="memo-welcome-first-actions">{[{ label: "Write a note", path: "/notes", icon: NotePencil }, { label: "Open Meetings", path: "/meeting", icon: VideoCamera }, { label: "Sync your calendar", path: "/calendar?sync=1", icon: CalendarPlus }].map(({ label, path, icon: ActionIcon }) => <button key={path} type="button" onClick={() => go(path)}><ActionIcon size={18} aria-hidden="true" />{label}<ArrowRight size={15} aria-hidden="true" /></button>)}</div>}
            </div>
            <div className="memo-welcome-bottom"><span>{stepIndex + 1} of {steps.length}</span><div>{stepIndex > 0 && <button type="button" className="memo-welcome-back" onClick={() => changeStep(stepIndex - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</button>}<button type="button" className="memo-welcome-next" onClick={() => last ? finish() : changeStep(stepIndex + 1)}>{last ? "Explore my dashboard" : stepIndex === 0 ? "Let’s begin" : "Next"}{!last && <ArrowRight size={16} aria-hidden="true" />}</button></div></div>
            {stepIndex === 0 && <button type="button" className="memo-welcome-later" onClick={finish}>I’ll explore on my own</button>}
          </div>
        </>}
      </dialog>
    </>
  );
}
