"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionStarter } from "@/components/AssistantStarter";
import { InsightsMeeting } from "@/lib/database";
import { MEETING_TYPE_LABELS } from "@/lib/prompts";
import { ActionItemRecord, MeetingType, Project, TaskAssignment } from "@/lib/types";

type InsightTab = "meetings" | "tasks" | "projects" | "documents";
type RangeWeeks = 4 | 8 | 13;

const TAB_LABELS: { id: InsightTab; label: string }[] = [
  { id: "meetings", label: "Meetings" },
  { id: "tasks", label: "Tasks" },
  { id: "projects", label: "Projects" },
  { id: "documents", label: "Documents" },
];

const BAR_COLORS = ["#6d5dfc", "#3b82f6", "#f59e0b", "#10b981"];

function meetingTypeLabel(type: MeetingType) {
  const label = MEETING_TYPE_LABELS[type] || type;
  if (label === "Planning Session") return "Planning";
  if (label === "Team Standup") return "Standup";
  return label;
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function rangeStart(weeks: number) {
  const date = startOfWeek(new Date());
  date.setDate(date.getDate() - (weeks - 1) * 7);
  return date;
}

function weekLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function parseDurationMinutes(raw: string | undefined) {
  if (!raw) return 0;
  const text = raw.toLowerCase();
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (hours || minutes) {
    return Math.round(
      (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0)
    );
  }
  const bare = text.match(/(\d+(?:\.\d+)?)/);
  return bare ? Math.round(Number(bare[1])) : 0;
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function isOverdue(item: ActionItemRecord) {
  if (item.status === "done" || !item.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${item.due_date}T00:00:00`) < today;
}

function TabIcon({ tab }: { tab: InsightTab }) {
  if (tab === "meetings") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="3.5" y="5" width="17" height="15" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M3.5 10h17" strokeLinecap="round" />
      </svg>
    );
  }
  if (tab === "tasks") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="m8 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "projects") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path d="M3.5 8A1.5 1.5 0 0 1 5 6.5h4l2 2h8A1.5 1.5 0 0 1 20.5 10v7A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17V8Z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M7 3.5h7l4 4v13H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M14 3.5v4h4M9 13h6M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <strong className="brand-gradient-text text-2xl font-extrabold tracking-tight">{value}</strong>
      <span className="text-sm font-medium text-[var(--muted)]">{label}</span>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`surface-card min-w-0 rounded-2xl p-5 md:p-6 ${className}`}>
      <h2 className="mb-5 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function VolumeChart({ data }: { data: { label: string; meetings: number; hours: number }[] }) {
  const width = 680;
  const height = 250;
  const left = 34;
  const right = 22;
  const top = 24;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxMeetings = Math.max(1, ...data.map((item) => item.meetings));
  const maxHours = Math.max(1, ...data.map((item) => item.hours));
  const step = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.min(40, step * 0.5);
  const points = data.map((item, index) => {
    const x = left + step * index + step / 2;
    const y = top + chartHeight - (item.hours / maxHours) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex items-center gap-5 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />Meetings</span>
        <span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-fuchsia-500" />Hours</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Meeting time and volume by week">
        {[0, 1, 2, 3, 4].map((line) => {
          const y = top + (chartHeight / 4) * line;
          return <line key={line} x1={left} x2={width - right} y1={y} y2={y} stroke="var(--surface-border)" strokeDasharray="4 5" />;
        })}
        {data.map((item, index) => {
          const x = left + step * index + step / 2;
          const barHeight = (item.meetings / maxMeetings) * chartHeight;
          return (
            <g key={item.label}>
              <rect x={x - barWidth / 2} y={top + chartHeight - barHeight} width={barWidth} height={barHeight} rx="5" fill="url(#meetingBars)" />
              <text x={x} y={height - 12} textAnchor="middle" fontSize="11" fill="var(--muted)">{item.label}</text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="meetingBars" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="1" stopColor="#4f46e5" /></linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((item, index) => {
          const x = left + step * index + step / 2;
          const y = top + chartHeight - (item.hours / maxHours) * chartHeight;
          return <circle key={item.label} cx={x} cy={y} r="4" fill="#ec4899" stroke="white" strokeWidth="2" />;
        })}
      </svg>
    </div>
  );
}

function ProgressRow({ label, value, max, index = 0 }: { label: string; value: number; max: number; index?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-sm text-[var(--muted)]">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-border)]">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
      </div>
      <strong className="w-6 text-right text-sm">{value}</strong>
    </div>
  );
}

function InsightNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 border-b border-[var(--surface-border)] py-4 first:pt-0 last:border-b-0 last:pb-0">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/10 text-indigo-600 dark:text-indigo-300">↗</span>
      <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{body}</p></div>
    </div>
  );
}

export default function InsightsClient({ meetings, actionItems, taskAssignments, projects, documentsCount, foldersCount }: { meetings: InsightsMeeting[]; actionItems: ActionItemRecord[]; taskAssignments: TaskAssignment[]; projects: Project[]; documentsCount: number; foldersCount: number }) {
  const [tab, setTab] = useState<InsightTab>("meetings");
  const [weeks, setWeeks] = useState<RangeWeeks>(8);

  const data = useMemo(() => {
    const start = rangeStart(weeks);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - weeks * 7);
    const inRange = (value: string) => new Date(value) >= start;
    const rangeMeetings = meetings.filter((meeting) => inRange(meeting.created_at));
    const previousMeetings = meetings.filter((meeting) => {
      const date = new Date(meeting.created_at);
      return date >= previousStart && date < start;
    });
    const rangeActionItems = actionItems.filter((item) => inRange(item.created_at));
    const rangeAssignments = taskAssignments.filter((item) => inRange(item.created_at));
    const weekStarts = Array.from({ length: weeks }, (_, index) => {
      const date = startOfWeek(new Date());
      date.setDate(date.getDate() - (weeks - 1 - index) * 7);
      return date;
    });
    const weekly = weekStarts.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const withinWeek = rangeMeetings.filter((meeting) => {
        const date = new Date(meeting.created_at);
        return date >= weekStart && date < weekEnd;
      });
      const minutes = withinWeek.reduce((sum, meeting) => sum + parseDurationMinutes(meeting.metadata?.duration), 0);
      return { label: weekLabel(weekStart), meetings: withinWeek.length, hours: Math.round((minutes / 60) * 10) / 10 };
    });
    const typeCounts = new Map<MeetingType, number>();
    rangeMeetings.forEach((meeting) => {
      const type = (meeting.meeting_type || "general") as MeetingType;
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    const meetingTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const dayCounts = new Map<number, number>();
    rangeMeetings.forEach((meeting) => {
      const day = new Date(meeting.created_at).getDay();
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    });
    const busiestDayEntry = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const busiestDay = busiestDayEntry ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][busiestDayEntry[0]] : "No busy day yet";
    const minutes = rangeMeetings.reduce((sum, meeting) => sum + parseDurationMinutes(meeting.metadata?.duration), 0);
    const decisions = rangeMeetings.reduce((sum, meeting) => sum + (meeting.decisions?.length || 0), 0);
    const change = previousMeetings.length ? Math.round(((rangeMeetings.length - previousMeetings.length) / previousMeetings.length) * 100) : rangeMeetings.length ? 100 : 0;
    const completed = rangeActionItems.filter((item) => item.status === "done");
    const overdue = rangeActionItems.filter(isOverdue).length;
    const completionRate = rangeActionItems.length ? Math.round((completed.length / rangeActionItems.length) * 100) : 0;
    const closeDays = completed.filter((item) => item.completed_at).map((item) => (new Date(item.completed_at!).getTime() - new Date(item.created_at).getTime()) / 86400000).filter((days) => days >= 0);
    const avgClose = closeDays.length ? Math.max(0.1, Math.round((closeDays.reduce((a, b) => a + b, 0) / closeDays.length) * 10) / 10) : null;
    const completedAssignments = rangeAssignments.filter((item) => item.status === "done").length;
    const rangeProjects = projects.filter((project) => inRange(project.created_at));
    return {
      rangeMeetings, weekly, meetingTypes, busiestDay, busiestDayCount: busiestDayEntry?.[1] || 0,
      minutes, decisions, change, completionRate, overdue, avgClose,
      completedTasks: completed.length + completedAssignments,
      pendingTasks: rangeActionItems.filter((item) => item.status === "todo").length + rangeAssignments.filter((item) => item.status === "pending").length,
      rangeProjects,
    };
  }, [actionItems, meetings, projects, taskAssignments, weeks]);

  const maxType = Math.max(1, ...data.meetingTypes.map(([, count]) => count));
  const activeProjects = projects.filter((project) => project.status === "active");
  const closedProjects = projects.filter((project) => project.status === "closed");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Insights</h1><p className="mt-1.5 text-sm text-[var(--muted)] md:text-base">Choose an area to understand what&apos;s changing.</p></div>
        <label className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium md:mr-12">
          <span className="text-[var(--muted)]">Range</span>
          <select value={weeks} onChange={(event) => setWeeks(Number(event.target.value) as RangeWeeks)} className="bg-transparent outline-none">
            <option value={4}>Last 4 weeks</option><option value={8}>Last 8 weeks</option><option value={13}>Last 13 weeks</option>
          </select>
        </label>
      </div>

      <div className="surface-card mt-6 grid grid-cols-2 overflow-hidden rounded-xl md:grid-cols-4" role="tablist" aria-label="Insight areas">
        {TAB_LABELS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`relative flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition ${tab === item.id ? "text-indigo-600 dark:text-indigo-300" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <TabIcon tab={item.id} />{item.label}{tab === item.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full brand-gradient-bg" />}
          </button>
        ))}
      </div>

      {tab === "meetings" && (
        data.rangeMeetings.length === 0 ? (
          <div className="mt-6">
            <SectionStarter
              icon="meeting"
              eyebrow="Insights begin after your first meeting"
              title="Give MemoValet one conversation to learn from."
              body="Instead of showing an empty chart and a 0% change, MemoValet will explain what it needs and take you straight to the next useful action."
              primaryHref="/meeting"
              primaryLabel="Start or import a meeting"
              secondaryHref="/settings#integrations"
              secondaryLabel="Connect a calendar"
              points={[
                "Meeting load, time, and busiest days",
                "Decisions and progress",
                "Language coverage and recurring meeting patterns",
              ]}
            />
          </div>
        ) : (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><Metric value={data.rangeMeetings.length} label="meetings" /><span className="text-[var(--surface-border)]">•</span><Metric value={formatMinutes(data.minutes)} label="total" /><span className="text-[var(--surface-border)]">•</span><Metric value={data.decisions} label="decisions" /></div>
          <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Panel title="Meeting time and volume"><VolumeChart data={data.weekly} /></Panel>
            <Panel title="What changed">
              <InsightNote title={`Meeting volume ${data.change >= 0 ? "increased" : "decreased"} ${Math.abs(data.change)}%`} body={`Compared with the prior ${weeks} weeks.`} />
              <InsightNote title={data.meetingTypes[0] ? `${meetingTypeLabel(data.meetingTypes[0][0])} meetings are the biggest group` : "No dominant meeting type yet"} body={data.meetingTypes[0] ? `They make up ${Math.round((data.meetingTypes[0][1] / Math.max(1, data.rangeMeetings.length)) * 100)}% of your meetings.` : "Add meeting types to reveal the pattern."} />
              <InsightNote title={`${data.busiestDay} is your busiest meeting day`} body={data.busiestDayCount ? `${data.busiestDayCount} meetings in this range.` : "More meetings are needed to calculate this."} />
              <Link href="/meeting" className="mt-5 flex items-center justify-center rounded-xl brand-gradient-bg px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90">See meetings →</Link>
            </Panel>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Meeting types"><div className="space-y-4">{data.meetingTypes.length ? data.meetingTypes.map(([type, count], index) => <ProgressRow key={type} label={meetingTypeLabel(type)} value={count} max={maxType} index={index} />) : <p className="text-sm text-[var(--muted)]">No meeting types recorded in this range.</p>}</div></Panel>
            <Panel title="Task completion"><div className="grid grid-cols-3 divide-x divide-[var(--surface-border)]"><div className="pr-4"><strong className="brand-gradient-text text-3xl font-extrabold">{data.completionRate}%</strong><p className="mt-2 text-sm font-semibold">Completed</p><p className="mt-1 text-xs text-[var(--muted)]">Action items finished.</p></div><div className="px-4"><strong className="text-3xl font-extrabold text-orange-500">{data.overdue}</strong><p className="mt-2 text-sm font-semibold">Overdue</p><p className="mt-1 text-xs text-[var(--muted)]">Past their due date.</p></div><div className="pl-4"><strong className={`brand-gradient-text font-extrabold ${data.avgClose == null ? "text-sm" : "text-3xl"}`}>{data.avgClose ?? "Not available"}</strong><p className="mt-2 text-sm font-semibold">Days to close</p><p className="mt-1 text-xs text-[var(--muted)]">Average completion time.</p></div></div></Panel>
          </div>
        </div>
        )
      )}

      {tab === "tasks" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel title="Task progress"><div className="grid grid-cols-2 gap-4 sm:grid-cols-3"><Metric value={data.completedTasks} label="completed" /><Metric value={data.pendingTasks} label="open" /><Metric value={data.overdue} label="overdue" /></div><div className="mt-8 h-3 overflow-hidden rounded-full bg-[var(--surface-border)]"><div className="h-full brand-gradient-bg" style={{ width: `${data.completedTasks + data.pendingTasks ? (data.completedTasks / (data.completedTasks + data.pendingTasks)) * 100 : 0}%` }} /></div><p className="mt-3 text-sm text-[var(--muted)]">{data.completedTasks + data.pendingTasks ? `${Math.round((data.completedTasks / (data.completedTasks + data.pendingTasks)) * 100)}% of tracked work was completed in this range.` : "No tasks were created in this range."}</p></Panel>
          <Panel title="Assistant view"><InsightNote title={data.overdue ? `${data.overdue} task${data.overdue === 1 ? " is" : "s are"} slipping` : "Nothing is overdue"} body={data.overdue ? "Clear the oldest deadline first, then remind the owner of the next one." : "You are making steady progress on your tasks."} /><InsightNote title={`${data.pendingTasks} open task${data.pendingTasks === 1 ? "" : "s"}`} body="MemoValet keeps these visible until they are finished." /><Link href="/tasks" className="mt-5 flex items-center justify-center rounded-xl brand-gradient-bg px-4 py-3 text-sm font-semibold text-white">Open tasks →</Link></Panel>
        </div>
      )}

      {tab === "projects" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Panel title="Project health"><div className="space-y-5"><Metric value={activeProjects.length} label="active projects" /><Metric value={closedProjects.length} label="closed projects" /><p className="text-sm text-[var(--muted)]">{data.rangeProjects.length} project{data.rangeProjects.length === 1 ? " was" : "s were"} started in the selected range.</p></div></Panel>
          <Panel title="Projects"><div className="divide-y divide-[var(--surface-border)]">{projects.length ? projects.slice(0, 8).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{project.client_name || "Personal project"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${project.status === "active" ? "bg-emerald-400/10 text-emerald-600 dark:text-emerald-300" : "bg-slate-400/10 text-[var(--muted)]"}`}>{project.status}</span></Link>) : <p className="text-sm text-[var(--muted)]">Create a project to connect meetings, tasks, and documents around one goal.</p>}</div></Panel>
        </div>
      )}

      {tab === "documents" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel title="Your knowledge library"><div className="grid grid-cols-2 gap-4"><div className="rounded-2xl bg-indigo-400/5 p-5"><strong className="brand-gradient-text text-4xl font-extrabold">{documentsCount}</strong><p className="mt-2 text-sm font-semibold">Documents saved</p></div><div className="rounded-2xl bg-fuchsia-400/5 p-5"><strong className="brand-gradient-text text-4xl font-extrabold">{foldersCount}</strong><p className="mt-2 text-sm font-semibold">Folders</p></div></div><p className="mt-5 text-sm leading-6 text-[var(--muted)]">Documents give MemoValet more context when you ask questions, prepare for meetings, or look for an old decision.</p></Panel>
          <Panel title="Make it more useful"><InsightNote title="Group files by project" body="Project folders make preparation and search easier." /><InsightNote title="Add the documents you reuse" body="Contracts, briefs, and plans become part of your assistant's memory." /><Link href="/documents" className="mt-5 flex items-center justify-center rounded-xl brand-gradient-bg px-4 py-3 text-sm font-semibold text-white">Open documents →</Link></Panel>
        </div>
      )}
    </div>
  );
}
