"use client";

import Image from "next/image";
import {
  Camera,
  Check,
  ClosedCaptioning,
  DotsNine,
  Microphone,
  MonitorArrowUp,
  PhoneDisconnect,
  Plus,
  ShareNetwork,
  Smiley,
  UsersThree,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useSpelling } from "@/lib/spelling-context";

const participants = [
  { name: "You", src: "/assets/meeting-participant-you.png", position: "center 16%" },
  { name: "Alex", src: "/assets/meeting-participant-alex.png", position: "center 14%" },
  { name: "Priya", src: "/assets/meeting-participant-priya.png", position: "center 12%" },
];

function buildTranscript(pick: (us: string, uk: string) => string) {
  return [
  { time: "00:12", speaker: "Alex", source: "Great progress on the campaign.", translation: "Gran progreso en la campaña." },
  { time: "00:18", speaker: "Priya", source: "Yes, engagement is up 24% this week.", translation: "Sí, la participación aumentó un 24% esta semana." },
  { time: "00:24", speaker: "You", source: `Let’s ${pick("finalize", "finalise")} assets and confirm the launch date.`, translation: "Finalicemos los recursos y confirmemos la fecha de lanzamiento." },
  ];
}

function buildInitialTasks(pick: (us: string, uk: string) => string) {
  return [
  { text: `${pick("Finalize", "Finalise")} launch assets`, owner: "Priya S.", src: "/assets/meeting-participant-priya.png", due: "May 24" },
  { text: "Review pricing page copy", owner: "Alex R.", src: "/assets/meeting-participant-alex.png", due: "May 23" },
  { text: "Share updated media kit", owner: "You", src: "/assets/meeting-participant-you.png", due: "May 25" },
  ];
}

export default function MeetingWorkspace({ className = "" }: { className?: string }) {
  const { pick } = useSpelling();
  const transcript = buildTranscript(pick);
  const initialTasks = buildInitialTasks(pick);
  const [activeTab, setActiveTab] = useState<"Transcript" | "Notes" | "Files">("Transcript");
  const [done, setDone] = useState<string[]>([]);

  return (
    <section id="live-product" className={`mf-meeting-window ${className}`} aria-label="Interactive MemoValet meeting preview">
      <div className="mf-meeting-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/assets/meetingflow-bow-mark-3d.png" alt="" width={34} height={28} className="h-6 w-auto object-contain" />
          <strong className="truncate text-sm text-white">Weekly Sync</strong>
          <span className="mf-live-pill"><span /> Live</span>
          <span className="hidden text-xs text-white/48 sm:inline">42:18</span>
          <span className="hidden items-center gap-1 text-xs text-white/46 sm:flex"><UsersThree size={15} /> 3</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="meeting-top-action" type="button" aria-label="Share meeting"><ShareNetwork size={15} /><span className="hidden sm:inline">Share</span></button>
          <button className="meeting-leave-action" type="button"><PhoneDisconnect size={15} weight="fill" /><span className="hidden sm:inline">Leave</span></button>
        </div>
      </div>

      <div className="grid min-h-[340px] lg:grid-cols-[1.22fr_1.05fr_0.78fr]">
        <div className="mf-video-column">
          <div className="grid grid-cols-3 gap-2.5">
            {participants.map((person) => (
              <div key={person.name} className="relative aspect-[0.76] overflow-hidden rounded-xl bg-[#252534]">
                <Image src={person.src} alt={person.name} fill sizes="(max-width: 1024px) 31vw, 14vw" className="object-cover" style={{ objectPosition: person.position }} />
                <span className="absolute bottom-2 left-2 rounded-md bg-black/48 px-2 py-1 text-[10px] text-white/90 backdrop-blur">{person.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {[
              { label: "Microphone", Icon: Microphone },
              { label: "Camera", Icon: Camera },
              { label: "Captions", Icon: ClosedCaptioning },
              { label: "Reactions", Icon: Smiley },
              { label: "Share screen", Icon: MonitorArrowUp },
              { label: "More", Icon: DotsNine },
            ].map(({ label, Icon }) => <button key={label} className="meeting-control" type="button" aria-label={label}><Icon size={18} weight={label === "Captions" ? "fill" : "regular"} /></button>)}
            <button className="meeting-control meeting-control-end" type="button" aria-label="End call"><PhoneDisconnect size={18} weight="fill" /></button>
          </div>
        </div>

        <div className="mf-transcript-column">
          <div className="flex gap-8 border-b border-white/10 px-5 pt-4" role="tablist" aria-label="Meeting content">
            {(["Transcript", "Notes", "Files"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`mf-meeting-tab ${activeTab === tab ? "mf-meeting-tab-active" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === "Transcript" && (
              <div className="space-y-5">
                {transcript.map((line) => (
                  <div key={line.time} className="grid grid-cols-[52px_1fr] gap-4 text-xs leading-relaxed">
                    <span className="text-white/40">{line.time}</span>
                    <div>
                      <strong className="block font-medium text-white/85">{line.speaker}</strong>
                      <p className="mt-1 text-white/72">{line.source}</p>
                      <p className="mt-1 text-[#56b9ff]">{line.translation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "Notes" && (
              <div className="text-sm leading-7 text-white/66">
                <h3 className="font-semibold text-white">Launch decisions</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5"><li>Campaign launch stays on May 27.</li><li>Pricing page copy needs final review.</li><li>Media kit goes to the team tomorrow.</li></ul>
              </div>
            )}
            {activeTab === "Files" && (
              <div className="space-y-3 text-sm">
                {["Launch-plan.pdf", "Campaign-assets.zip", "Pricing-copy.docx"].map((file) => <div key={file} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white/72">{file}</div>)}
              </div>
            )}
          </div>
        </div>

        <div className="mf-action-column">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-[1.18rem]">
            <h2 className="text-sm font-medium text-white/90">Action items</h2>
            <span className="rounded-full bg-[#7b57f7] px-2 py-0.5 text-[10px] font-semibold text-white">3</span>
          </div>
          <div className="space-y-2.5 p-4">
            {initialTasks.map((task) => {
              const checked = done.includes(task.text);
              return (
                <button
                  key={task.text}
                  type="button"
                  onClick={() => setDone((items) => checked ? items.filter((item) => item !== task.text) : [...items, task.text])}
                  className="w-full rounded-xl border border-white/9 bg-white/[0.035] p-3 text-left transition hover:border-[#8d73ff]/50 hover:bg-white/[0.055]"
                  aria-pressed={checked}
                >
                  <div className="flex items-start gap-2.5 text-xs text-white/76">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-[#8d73ff] bg-[#7b57f7]" : "border-white/42"}`}>{checked && <Check size={10} weight="bold" />}</span>
                    <span className={checked ? "line-through opacity-50" : ""}>{task.text}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-6 text-[10px] text-white/42">
                    <Image src={task.src} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                    <span>{task.owner}</span><span className="ml-auto">{task.due}</span>
                  </div>
                </button>
              );
            })}
            <button type="button" className="mt-2 inline-flex items-center gap-2 px-1 text-xs font-medium text-[#b48cff]"><Plus size={15} weight="bold" /> Add action item</button>
          </div>
        </div>
      </div>
    </section>
  );
}
