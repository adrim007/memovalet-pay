export type DemoDecision = {
  id: string;
  meeting: string;
  date: string;
  decision: string;
  context: string;
};

export type DemoActionItem = {
  id: string;
  meeting: string;
  owner: string;
  task: string;
  due: string;
  status: "open" | "done";
};

// This data is deliberately fictional. The hackathon demo can run without a
// login, an API key, or access to anyone's real meeting history.
const decisions: DemoDecision[] = [
  {
    id: "launch-date",
    meeting: "Acme launch planning",
    date: "2026-10-14",
    decision: "Launch the pilot on 28 October with the onboarding flow limited to invited customers.",
    context: "The team chose a smaller pilot so support can review feedback before a wider release.",
  },
  {
    id: "pricing-copy",
    meeting: "Weekly product check-in",
    date: "2026-10-13",
    decision: "Keep pricing simple: one monthly plan and a short free trial.",
    context: "The group agreed that a clearer choice matters more than adding tiers before validation.",
  },
];

const actionItems: DemoActionItem[] = [
  {
    id: "onboarding-copy",
    meeting: "Acme launch planning",
    owner: "Priya",
    task: "Finish the pilot onboarding copy.",
    due: "2026-10-20",
    status: "open",
  },
  {
    id: "support-playbook",
    meeting: "Acme launch planning",
    owner: "Alex",
    task: "Draft the support playbook for pilot feedback.",
    due: "2026-10-21",
    status: "open",
  },
  {
    id: "pricing-review",
    meeting: "Weekly product check-in",
    owner: "Maya",
    task: "Review the updated pricing page.",
    due: "2026-10-16",
    status: "done",
  },
];

export function searchMeetingMemory(query: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = decisions.filter((item) => {
    const haystack = `${item.meeting} ${item.decision} ${item.context}`.toLowerCase();
    return tokens.length === 0 || tokens.some((token) => haystack.includes(token));
  });

  return matches.map((item) => ({
    meeting: item.meeting,
    date: item.date,
    decision: item.decision,
    source: `Decision: ${item.meeting} (${item.date})`,
  }));
}

export function listOpenActionItems() {
  return actionItems
    .filter((item) => item.status === "open")
    .map(({ meeting, owner, task, due }) => ({ meeting, owner, task, due }));
}

export function getDecisionContext(id: string) {
  const decision = decisions.find((item) => item.id === id);
  if (!decision) return null;

  return {
    meeting: decision.meeting,
    date: decision.date,
    decision: decision.decision,
    context: decision.context,
    relatedOpenActions: actionItems
      .filter((item) => item.status === "open" && item.meeting === decision.meeting)
      .map(({ owner, task, due }) => ({ owner, task, due })),
  };
}

export const demoMeetingMemory = { decisions, actionItems };

// The sample world runs on a fixed clock so every demo tells the same story:
// Saturday 17 October 2026, 9 am in Melbourne (UTC+11).
export const SAMPLE_NOW = "2026-10-17T09:00:00+11:00";
const SAMPLE_OFFSET = "+11:00";
const SAMPLE_ATTENDEES = ["Maya", "Priya", "Alex"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Dates read as words ("Thursday 22 October"), never with dashes.
function dayLabel(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
function slotLabel(start: string) {
  const hour = Number(start.slice(11, 13));
  const minutes = start.slice(14, 16);
  const time = `${hour % 12 || 12}${minutes === "00" ? "" : `:${minutes}`} ${hour < 12 ? "am" : "pm"}`;
  return `${dayLabel(start.slice(0, 10))} at ${time}`;
}
function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function openTasksFor(decision: DemoDecision) {
  return actionItems.filter(item => item.status === "open" && item.meeting === decision.meeting);
}

// Offers weekday slots after the last open task is due, so the follow up can review finished work.
export function followUpTimes(decisionId: string) {
  const decision = decisions.find(item => item.id === decisionId);
  if (!decision) return null;
  const tasks = openTasksFor(decision);
  const today = SAMPLE_NOW.slice(0, 10);
  const lastDue = tasks.map(task => task.due).sort().at(-1) ?? today;
  const slots: { start: string; label: string }[] = [];
  for (let day = addDays(lastDue > today ? lastDue : today, 1); slots.length < 3; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const time of ["10:00", "15:00"]) {
      if (slots.length < 3) {
        const start = `${day}T${time}:00${SAMPLE_OFFSET}`;
        slots.push({ start, label: slotLabel(start) });
      }
    }
  }
  return {
    meeting: decision.meeting,
    reason: tasks.length
      ? `These times come after the last open task is due (${dayLabel(lastDue)}), so the team can review finished work. Times are in Melbourne time.`
      : "There are no open tasks, so these are the next weekday slots. Times are in Melbourne time.",
    durationMinutes: 30,
    attendees: SAMPLE_ATTENDEES,
    slots,
  };
}

export function bookFollowUp(decisionId: string, start: string) {
  const options = followUpTimes(decisionId);
  const slot = options?.slots.find(item => item.start === start);
  if (!options || !slot) return null;
  return {
    booking: {
      title: `Follow up: ${options.meeting}`,
      start: slot.start,
      end: new Date(Date.parse(slot.start) + options.durationMinutes * 60000).toISOString(),
      label: slot.label,
      durationMinutes: options.durationMinutes,
      attendees: options.attendees,
      sourceHref: `/preview/history/${decisionId}?scenario=launch`,
    },
    savedTo: "The sample workspace calendar in this browser. No invitations are sent.",
  };
}

export function draftTaskReminders(decisionId: string, followUpStart?: string) {
  const decision = decisions.find(item => item.id === decisionId);
  if (!decision) return null;
  const followUp = followUpStart && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(followUpStart) ? slotLabel(followUpStart) : null;
  return {
    meeting: decision.meeting,
    drafts: openTasksFor(decision).map(task => ({
      to: task.owner,
      task: task.task,
      due: dayLabel(task.due),
      message: `Hi ${task.owner}, a quick reminder from the ${decision.meeting} meeting. Your task "${task.task.replace(/\.$/, "")}" is due ${dayLabel(task.due)}.` +
        (followUp ? ` We'll review it together at the follow up on ${followUp}.` : ""),
    })),
    sent: false,
    note: "Drafts only. Nothing has been sent.",
  };
}
