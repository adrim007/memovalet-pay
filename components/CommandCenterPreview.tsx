"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowSquareOut,
  Bell,
  CalendarBlank,
  CaretDown,
  ChartBar,
  Check,
  CheckSquare,
  FilePdf,
  FileText,
  FolderOpen,
  Gear,
  GlobeHemisphereWest,
  House,
  MagnifyingGlass,
  MapPin,
  Plus,
  ShareNetwork,
  Sparkle,
  Users,
  Wrench,
  X,
} from "@phosphor-icons/react";
import Logo from "@/components/Logo";

const schedule = [
  { time: "10:30 AM", title: "Team planning", detail: "30m · Conference Room B" },
  { time: "1:00 PM", title: "Client sync: Orion", detail: "45m · Zoom" },
  { time: "3:30 PM", title: "Product review", detail: "60m · Conference Room B" },
];

const files = [
  { title: "Project proposal.pdf", detail: "Sarah J. · 10:20 AM", icon: FilePdf, color: "text-red-600 bg-red-50" },
  { title: "Q3 planning deck", detail: "Alex P. · Yesterday", icon: FileText, color: "text-blue-600 bg-blue-50" },
  { title: "Budget tracker.xlsx", detail: "Priya M. · Aug 24", icon: FileText, color: "text-emerald-600 bg-emerald-50" },
];

type Mode = "MemoValet" | "Web" | "Create";

function QuickShare({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-labelledby="command-share-title">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Quick share</p><h2 id="command-share-title" className="mt-1 text-xl font-bold">Share Kitchen renovation</h2></div>
          <button type="button" onClick={onClose} aria-label="Close share window" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"><X size={20} /></button>
        </div>
        <label htmlFor="command-share-email" className="mt-5 block text-sm font-semibold">Email or MemoValet member</label>
        <input id="command-share-email" type="email" placeholder="carpenter@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-500" />
        <select aria-label="Sharing permission" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none">
          <option>Can update and upload photos</option>
          <option>Can view only</option>
        </select>
        <button type="button" onClick={() => setSent(true)} className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 py-3 text-sm font-semibold text-white">Send invitation</button>
        {sent && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Shared through MemoValet and email.</p>}
      </div>
    </div>
  );
}

export default function CommandCenterPreview() {
  const [mode, setMode] = useState<Mode>("MemoValet");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [completed, setCompleted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const runCommand = (event: FormEvent) => {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    if (mode === "Web") {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(clean)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (mode === "Create") {
      window.location.assign(clean.toLowerCase().includes("meeting") ? "/meeting" : "/tasks");
      return;
    }
    setAnswer(`I found the connected meetings, tasks, files, people, and projects for “${clean}”.`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fd] text-[#14141f] md:flex">
      <aside className="flex w-full items-center gap-4 border-b border-slate-200 bg-white/80 p-4 md:sticky md:top-0 md:min-h-screen md:w-[244px] md:shrink-0 md:flex-col md:items-stretch md:border-b-0 md:border-r md:p-6">
        <Logo size="sm" href="/prototype/command-center" />
        <nav className="flex flex-1 gap-1 overflow-x-auto md:mt-6 md:flex-none md:flex-col" aria-label="Command centre navigation">
          {[
            ["Home", House, "/prototype/command-center"],
            ["Meetings", CalendarBlank, "/meeting"],
            ["Work", CheckSquare, "/tasks"],
            ["Insights", ChartBar, "/insights"],
            ["Files", FolderOpen, "/documents"],
            ["People", Users, "/people"],
            ["Settings", Gear, "/settings"],
          ].map(([label, Icon, href], index) => {
            const IconComponent = Icon as typeof House;
            return <Link key={label as string} href={href as string} className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${index === 0 ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><IconComponent size={20} weight={index === 0 ? "fill" : "regular"} /><span className="hidden md:inline">{label as string}</span></Link>;
          })}
        </nav>
        <div className="mt-auto hidden border-t border-slate-200 pt-5 md:block">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Maya Sharma</p><p className="text-xs font-semibold text-indigo-600">Pro Plan</p><Link href="/settings" className="mt-1 block text-[11px] text-slate-500 hover:text-indigo-600">Add a photo or choose a cartoon avatar</Link></div>
            <CaretDown size={15} className="text-slate-500" />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-[1180px]">
          <header className="flex items-start justify-between gap-4">
            <div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Good Morning <span className="brand-gradient-text">Maya</span></h1><p className="mt-2 text-base text-slate-500">Wednesday, August 26, 2026</p></div>
            <button type="button" aria-label="Notifications" className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600"><Bell size={20} /></button>
          </header>

          <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Workspace totals">
            {[
              [12, "Meetings"],
              [3, "This week"],
              [7, "Action items"],
              [2, "Tasks sent"],
            ].map(([value, label]) => (
              <div key={label as string} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(99,102,241,0.04)]">
                <p className="text-3xl font-extrabold tracking-tight">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </section>

          <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1fr)_285px]">
            <div className="min-w-0">
              <div className="rounded-[24px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 p-[1.5px] shadow-sm">
                <section className="rounded-[22px] bg-white p-5 sm:p-6" aria-label="Ask, search, or create">
                  <form onSubmit={runCommand}>
                    <div className="flex items-center gap-3">
                      <MagnifyingGlass size={25} className="shrink-0 text-slate-700" />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Ask, search, or get something done" placeholder="Ask, search, or get something done…" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500" />
                      <span className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 sm:inline">⌘ K</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {[
                        ["MemoValet", Sparkle],
                        ["Web", GlobeHemisphereWest],
                        ["Create", Plus],
                      ].map(([label, Icon]) => {
                        const IconComponent = Icon as typeof Sparkle;
                        return <button key={label as string} type="button" onClick={() => setMode(label as Mode)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${mode === label ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><IconComponent size={18} weight={mode === label ? "fill" : "regular"} />{label as string}{label !== "Web" && <CaretDown size={14} />}</button>;
                      })}
                      <button type="submit" className="ml-auto rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">Go</button>
                    </div>
                  </form>
                </section>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ["Summarize my meetings from yesterday", Sparkle],
                  ["Draft an update email to Sarah about the contract", Check],
                  ["What’s on my agenda tomorrow?", CalendarBlank],
                ].map(([label, Icon]) => {
                  const IconComponent = Icon as typeof Sparkle;
                  return <button key={label as string} type="button" onClick={() => setQuery(label as string)} className="flex min-h-[74px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm font-medium leading-5 transition hover:border-indigo-300 hover:shadow-sm"><IconComponent size={21} className="shrink-0 text-indigo-600" /><span>{label as string}</span></button>;
                })}
              </div>

              {answer && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"><Sparkle size={19} weight="fill" className="mt-0.5 shrink-0" /><p>{answer}</p><button type="button" onClick={() => setAnswer("")} aria-label="Dismiss answer" className="ml-auto"><X size={17} /></button></div>}

              <section className="mt-8" aria-labelledby="attention-title">
                <h2 id="attention-title" className="text-lg font-bold">Needs your attention</h2>
                <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">
                  {[
                    { title: "Sarah owes you: Contract", detail: "Expected Friday, 2 days overdue.", action: "Review", time: "10:15 AM", color: "bg-indigo-600" },
                    { title: "You promised James: Send updated pricing", detail: completed ? "Completed just now." : "Due today.", action: completed ? "Done" : "Mark done", time: "9:30 AM", color: "bg-orange-500" },
                    { title: "Draft promo doc", detail: "From “1:1 with Priya”", action: "Review", time: "Yesterday", color: "bg-violet-600" },
                  ].map((item, index) => <div key={item.title} className="flex flex-wrap items-center gap-3 py-4"><span className={`h-2.5 w-2.5 rounded-full ${item.color}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div><button type="button" onClick={() => index === 1 && setCompleted(true)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50">{item.action}</button><span className="w-16 text-right text-xs text-slate-500">{item.time}</span></div>)}
                </div>
              </section>

              <section className="mt-5" aria-labelledby="active-work-title">
                <h2 id="active-work-title" className="text-lg font-bold">Active work</h2>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-600"><Wrench size={25} weight="duotone" /></span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h3 className="font-bold">Kitchen renovation</h3><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">● In progress</span></div><p className="mt-1 text-xs text-slate-500">Assigned to Marco (Carpenter)</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarBlank size={15} />Due Fri, Aug 28, 2026</span><span className="inline-flex items-center gap-1.5"><MapPin size={15} />18 Smith Street, Richmond VIC</span></div></div>
                    <div className="flex flex-wrap gap-2"><a href="https://www.google.com/maps/search/?api=1&query=18%20Smith%20Street%20Richmond%20VIC" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold">Open in Maps <ArrowSquareOut size={15} /></a><button type="button" onClick={() => setShareOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-4 py-2.5 text-xs font-semibold text-white"><ShareNetwork size={16} />Share</button></div>
                  </div>
                  <div className="mt-6 grid grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-2">
                    {[{ label: "Requested", date: "Aug 20, 2026", state: "done" }, { label: "In progress", date: "Aug 21, 2026", state: "current" }, { label: "Done", date: "Pending", state: "future" }].map((step, index) => <div key={step.label} className="contents"><div className="text-center"><span className={`mx-auto grid h-6 w-6 place-items-center rounded-full border-2 ${step.state === "done" ? "border-indigo-600 bg-indigo-600 text-white" : step.state === "current" ? "border-indigo-200 bg-indigo-600 text-white shadow-[0_0_0_5px_rgba(99,102,241,0.12)]" : "border-slate-300 bg-white text-transparent"}`}>{step.state === "done" && <Check size={13} weight="bold" />}</span><p className="mt-2 text-xs font-semibold">{step.label}</p><p className="text-[10px] text-slate-500">{step.date}</p></div>{index < 2 && <div className={`mt-2.5 h-0.5 ${index === 0 ? "bg-indigo-600" : "bg-slate-200"}`} />}</div>)}</div>
                </div>
              </section>
            </div>

            <aside className="border-t border-slate-200 pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
              <section><h2 className="text-lg font-bold">Today’s schedule</h2><ol className="relative mt-6 space-y-8 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-slate-200">{schedule.map((item) => <li key={item.time} className="relative flex gap-4"><span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-white bg-indigo-600" /><div><p className="text-sm font-semibold text-indigo-600">{item.time}</p><p className="mt-1.5 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div></li>)}</ol><Link href="/meeting" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">View full schedule →</Link></section>
              <section className="mt-10 border-t border-slate-200 pt-7"><h2 className="text-lg font-bold">Recently shared</h2><div className="mt-4 divide-y divide-slate-200">{files.map((file) => { const Icon = file.icon; return <Link href="/documents" key={file.title} className="flex items-center gap-3 py-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${file.color}`}><Icon size={19} weight="fill" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file.title}</span><span className="block text-xs text-slate-500">{file.detail}</span></span><span className="text-lg font-bold text-slate-400">⋮</span></Link>; })}</div><Link href="/documents" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">See all files →</Link></section>
            </aside>
          </div>
        </div>
      </main>
      {shareOpen && <QuickShare onClose={() => setShareOpen(false)} />}
    </div>
  );
}
