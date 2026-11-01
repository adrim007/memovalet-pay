import type { Project, TaskAssignment, UpcomingCalendarEvent, UserDocument } from "@/lib/types";

export const previewActiveProject: Project = {
  id: "preview-project",
  created_by: "preview-user",
  team_id: null,
  name: "Kitchen renovation",
  client_name: "Marco (Carpenter)",
  status: "active",
  created_at: "2026-08-20T09:00:00.000Z",
};

export const previewActiveTask: TaskAssignment = {
  id: "preview-task",
  created_by: "preview-user",
  recipient_email: "Marco (Carpenter)",
  title: "Install kitchen cabinets",
  description: "Install and photograph the finished kitchen cabinets.",
  due_date: "2026-08-28",
  location: "18 Smith Street, Richmond VIC",
  priority: "high",
  status: "pending",
  completion_note: null,
  completion_file_url: null,
  notes: [],
  created_at: "2026-08-20T09:00:00.000Z",
  completed_at: null,
};

export const previewScheduleEvents: UpcomingCalendarEvent[] = [
  { id: "preview-event-1", title: "Team planning", start: "2026-08-26T10:30:00+10:00", end: "2026-08-26T11:00:00+10:00", meetLink: "", attendees: [], source: "calendar" },
  { id: "preview-event-2", title: "Client sync: Orion", start: "2026-08-26T13:00:00+10:00", end: "2026-08-26T13:45:00+10:00", meetLink: "https://meet.google.com/preview", provider: "google-meet", attendees: [], source: "calendar" },
  { id: "preview-event-3", title: "Product review", start: "2026-08-26T15:30:00+10:00", end: "2026-08-26T16:30:00+10:00", meetLink: "https://us02web.zoom.us/j/8912345678", provider: "zoom", attendees: [], source: "calendar" },
  { id: "preview-event-4", title: "Vendor check-in", start: "2026-08-26T16:45:00+10:00", end: "2026-08-26T17:15:00+10:00", meetLink: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_preview", provider: "teams", attendees: [], source: "calendar" },
];

export const previewRecentDocuments: UserDocument[] = [
  { id: "preview-doc-1", user_id: "preview-user", doc_type: "other", title: "Project proposal.pdf", file_path: "preview/project-proposal.pdf", mime_type: "application/pdf", folder_id: null, notes: null, color: null, created_at: "2026-08-26T10:20:00+10:00" },
  { id: "preview-doc-2", user_id: "preview-user", doc_type: "other", title: "Q3 planning deck", file_path: "preview/q3-planning-deck", mime_type: "application/vnd.google-apps.presentation", folder_id: null, notes: null, color: "blue", created_at: "2026-08-25T15:00:00+10:00" },
  { id: "preview-doc-3", user_id: "preview-user", doc_type: "other", title: "Budget tracker.xlsx", file_path: "preview/budget-tracker.xlsx", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", folder_id: null, notes: null, color: "green", created_at: "2026-08-24T11:00:00+10:00" },
];
