import AppShell from "@/components/AppShell";
import MeetingHistoryList from "@/components/MeetingHistoryList";
import { SavedMeeting } from "@/lib/types";

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

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
    project_id: null,
    ...overrides,
  };
}

const meetings: SavedMeeting[] = [
  mockMeeting({
    title: "Weekly sync with design",
    participants: "Sarah, Mike, Alex",
    summary: "Reviewed onboarding flow mockups and agreed on next sprint priorities.",
    created_at: hoursAgo(2),
    video_url: "https://example.com/fake.webm",
  }),
  mockMeeting({
    title: "Acme discovery call",
    participants: "Priya, David",
    summary: "Walked through pricing tiers, Acme wants a follow up call with legal.",
    created_at: hoursAgo(6),
  }),
  mockMeeting({
    title: "1:1 with Jordan",
    participants: "Jordan",
    summary: "Discussed Q3 goals and career growth plans.",
    created_at: daysAgo(1),
  }),
  mockMeeting({
    title: "August investor update",
    participants: "Board",
    summary: "Shared MRR growth, runway, and hiring plan for next quarter.",
    created_at: daysAgo(3),
  }),
  mockMeeting({
    title: "Standup",
    participants: "Eng team",
    summary: "Blocked on API rate limits, otherwise on track for Friday release.",
    created_at: daysAgo(4),
    video_url: "https://example.com/fake2.webm",
  }),
  mockMeeting({
    title: "Q2 retro",
    participants: "Whole team",
    summary: "Shipped 12 features, missed two deadlines, discussed process fixes.",
    created_at: daysAgo(45),
  }),
];

export default function HistoryPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Meeting library</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Revisit recordings, transcripts, translations, notes, decisions, and action items.
          </p>
        </div>
        <MeetingHistoryList meetings={meetings} userId="preview-user" />
      </div>
    </AppShell>
  );
}
