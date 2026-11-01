import AppShell from "@/components/AppShell";
import InsightsClient from "@/components/InsightsClient";
import { InsightsMeeting } from "@/lib/database";
import { ActionItemRecord, MeetingType, Project, TaskAssignment } from "@/lib/types";

function meeting(
  createdAt: string,
  type: MeetingType,
  duration: string,
  decisions: number
): InsightsMeeting {
  return {
    created_at: createdAt,
    decisions: Array.from({ length: decisions }, (_, index) => `Decision ${index + 1}`),
    action_items: [{ task: "Follow up", owner: "Maya" }],
    metadata: { duration, sentiment: "positive" },
    meeting_type: type,
    participants: "Maya, Priya, Jordan",
  };
}

const meetings: InsightsMeeting[] = [
  meeting("2026-08-24T10:00:00.000Z", "planning", "45 minutes", 2),
  meeting("2026-08-22T10:00:00.000Z", "standup", "30 minutes", 1),
  meeting("2026-08-18T10:00:00.000Z", "sales", "1 hour", 1),
  meeting("2026-08-12T10:00:00.000Z", "planning", "45 minutes", 1),
  meeting("2026-08-10T10:00:00.000Z", "one_on_one", "30 minutes", 0),
  meeting("2026-08-05T10:00:00.000Z", "planning", "40 minutes", 1),
  meeting("2026-08-03T10:00:00.000Z", "standup", "20 minutes", 0),
  meeting("2026-07-27T10:00:00.000Z", "sales", "50 minutes", 0),
  meeting("2026-07-20T10:00:00.000Z", "standup", "25 minutes", 1),
  meeting("2026-07-13T10:00:00.000Z", "one_on_one", "30 minutes", 0),
  meeting("2026-07-06T10:00:00.000Z", "planning", "40 minutes", 0),
];

function actionItem(index: number, status: "todo" | "done", dueDate: string | null): ActionItemRecord {
  return {
    id: `action-${index}`,
    meeting_id: `meeting-${index}`,
    user_id: "preview-user",
    task: `Action item ${index}`,
    owner: index % 2 ? "Priya" : "Maya",
    due_date: dueDate,
    priority: null,
    status,
    created_at: `2026-08-${String(Math.max(1, 24 - index)).padStart(2, "0")}T10:00:00.000Z`,
    completed_at: status === "done" ? "2026-08-24T12:00:00.000Z" : null,
    meeting_title: "Planning",
    location: null,
    photo_url: null,
    reminder_at: null,
  };
}

const actionItems = [
  actionItem(1, "done", null),
  actionItem(2, "done", null),
  actionItem(3, "done", null),
  actionItem(4, "done", null),
  actionItem(5, "done", null),
  actionItem(6, "todo", "2026-08-20"),
  actionItem(7, "todo", "2026-08-23"),
];

const taskAssignments: TaskAssignment[] = [
  {
    id: "task-1", created_by: "preview-user", recipient_email: "jordan@example.com",
    title: "Send pricing", description: null, due_date: null, location: null, priority: "high", status: "done",
    completion_note: null, completion_file_url: null, notes: [], created_at: "2026-08-20T10:00:00.000Z",
    completed_at: "2026-08-22T10:00:00.000Z",
  },
  {
    id: "task-2", created_by: "preview-user", recipient_email: "priya@example.com",
    title: "Update contract", description: null, due_date: "2026-08-28", location: null, priority: "medium", status: "pending",
    completion_note: null, completion_file_url: null, notes: [], created_at: "2026-08-22T10:00:00.000Z",
    completed_at: null,
  },
];

const projects: Project[] = [
  { id: "project-1", created_by: "preview-user", team_id: null, name: "Orion launch", client_name: "Orion", status: "active", created_at: "2026-08-01T10:00:00.000Z" },
  { id: "project-2", created_by: "preview-user", team_id: null, name: "Q3 planning", client_name: null, status: "active", created_at: "2026-07-20T10:00:00.000Z" },
  { id: "project-3", created_by: "preview-user", team_id: null, name: "Website refresh", client_name: null, status: "closed", created_at: "2026-07-10T10:00:00.000Z" },
];

export default function InsightsPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <InsightsClient
        meetings={meetings}
        actionItems={actionItems}
        taskAssignments={taskAssignments}
        projects={projects}
        documentsCount={9}
        foldersCount={3}
      />
    </AppShell>
  );
}
