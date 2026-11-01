import AppShell from "@/components/AppShell";
import TasksClient from "@/components/TasksClient";
import { ActionItemRecord, Commitment, TaskAssignment } from "@/lib/types";

function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function mockItem(overrides: Partial<ActionItemRecord>): ActionItemRecord {
  return {
    id: crypto.randomUUID(),
    meeting_id: crypto.randomUUID(),
    user_id: "mock-user",
    task: "Untitled task",
    owner: null,
    due_date: null,
    priority: null,
    status: "todo",
    created_at: new Date().toISOString(),
    completed_at: null,
    meeting_title: "Weekly sync",
    location: null,
    photo_url: null,
    reminder_at: null,
    ...overrides,
  };
}

const items: ActionItemRecord[] = [
  mockItem({
    task: "Send updated pricing deck to Acme",
    owner: "Priya",
    due_date: daysFromNow(2),
    priority: null,
    meeting_title: "Acme discovery call",
    location: "Acme HQ, 1 Market St, San Francisco",
  }),
  mockItem({
    task: "Pick up conference badge",
    owner: "Alex",
    due_date: daysFromNow(-1),
    priority: "medium",
    meeting_title: "Travel planning",
    reminder_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  }),
  mockItem({
    task: "Book venue site visit",
    owner: "Jordan",
    priority: "low",
    meeting_title: "Q3 offsite planning",
    photo_url: "https://placehold.co/80x80",
  }),
];

const assignments: TaskAssignment[] = [
  {
    id: crypto.randomUUID(),
    created_by: "mock-user",
    recipient_email: "sam@tiling.example",
    title: "Re-grout the ensuite",
    description: null,
    due_date: daysFromNow(3),
    location: null,
    priority: null,
    status: "pending",
    completion_note: null,
    completion_file_url: null,
    notes: [],
    created_at: new Date().toISOString(),
    completed_at: null,
    amount_cents: 48000,
    currency: "aud",
    payment_status: "none",
  },
];

function mockCommitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: crypto.randomUUID(),
    user_id: "mock-user",
    description: "Untitled promise",
    direction: "i_owe",
    person_id: null,
    person_name: null,
    due_date: null,
    priority: null,
    status: "pending",
    source_type: null,
    source_id: null,
    confidence: "manual",
    created_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

const iOwe: Commitment[] = [
  mockCommitment({
    description: "Send the revised quote",
    person_name: "Priya",
    due_date: daysFromNow(1),
    priority: "high",
  }),
];

const theyOwe: Commitment[] = [
  mockCommitment({
    description: "Confirm the delivery window",
    direction: "they_owe",
    person_name: "Marco",
    due_date: daysFromNow(-2),
    priority: "low",
  }),
];

// ?added=…&date=YYYY-MM-DD&at=ISO shows a task just made with Create on Home
// at the top of your personal tasks, the way the real list would: the
// walkthrough film uses it (media-src/energy-ad/scripts/capture-walkthrough.mjs).
export default async function TasksPreviewPage({ searchParams }: { searchParams: Promise<{ added?: string; date?: string; at?: string }> }) {
  const { added, date, at } = await searchParams;
  const mine = added
    ? [mockCommitment({ description: added.slice(0, 200), due_date: /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : daysFromNow(1), due_at: at && !Number.isNaN(Date.parse(at)) ? at : null }), ...iOwe]
    : iOwe;
  return (
    <AppShell userEmail="maya@example.com">
      <TasksClient items={items} assignments={assignments} iOwe={mine} theyOwe={theyOwe} />
    </AppShell>
  );
}
