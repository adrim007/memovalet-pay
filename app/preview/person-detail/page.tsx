import AppShell from "@/components/AppShell";
import PersonDetailClient from "@/components/PersonDetailClient";
import { SavedMeeting } from "@/lib/types";

function mockMeeting(overrides: Partial<SavedMeeting>): SavedMeeting {
  return {
    id: crypto.randomUUID(),
    user_id: "preview-user",
    title: "Untitled Meeting",
    participants: "Priya",
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
    project_id: null,
    ...overrides,
  };
}

const mockMeetings: SavedMeeting[] = [
  mockMeeting({
    title: "Acme discovery call",
    summary: "Walked through pricing tiers, Acme wants a follow up call with legal.",
    decisions: ["Move forward with the enterprise tier"],
    action_items: [{ task: "Send updated proposal", owner: "Priya" }],
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  }),
  mockMeeting({
    title: "1:1 with Priya",
    summary: "Discussed Q3 goals and career growth plans.",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  }),
];

export default function PersonDetailPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com">
      <PersonDetailClient name="Priya" meetings={mockMeetings} />
    </AppShell>
  );
}
