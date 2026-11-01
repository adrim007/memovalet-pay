import AppShell from "@/components/AppShell";
import ProjectDetailClient from "@/components/ProjectDetailClient";
import { Project, SavedMeeting } from "@/lib/types";

const mockProject: Project = {
  id: "proj-1",
  created_by: "user-1",
  team_id: null,
  name: "Acme renewal",
  client_name: "Acme Corp",
  status: "active",
  created_at: new Date().toISOString(),
};

function mockMeeting(overrides: Partial<SavedMeeting>): SavedMeeting {
  return {
    id: crypto.randomUUID(),
    user_id: "preview-user",
    title: "Untitled Meeting",
    participants: null,
    transcript: "",
    summary: null,
    decisions: null,
    action_items: null,
    follow_up_email: null,
    metadata: null,
    created_at: new Date().toISOString(),
    share_token: null,
    team_id: null,
    meeting_type: "general",
    video_url: null,
    notes: null,
    project_id: "proj-1",
    ...overrides,
  };
}

const mockMeetings: SavedMeeting[] = [
  mockMeeting({
    title: "Acme discovery call",
    participants: "Priya, David",
    summary: "Walked through pricing tiers, Acme wants a follow up call with legal.",
    decisions: ["Move forward with the enterprise tier"],
    action_items: [{ task: "Send updated proposal", owner: "Priya" }],
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  }),
  mockMeeting({
    title: "Acme contract review",
    participants: "Priya, David, Legal",
    summary: "Reviewed redlines on the MSA, one open item on liability cap.",
    decisions: ["Accept a $500k liability cap"],
    action_items: [{ task: "Get final sign-off from Legal", owner: "David" }],
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  }),
];

export default function ProjectDetailPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com">
      <ProjectDetailClient project={mockProject} meetings={mockMeetings} />
    </AppShell>
  );
}
