import AppShell from "@/components/AppShell";
import PeopleClient from "@/components/PeopleClient";
import type { Team } from "@/lib/types";

const mockPeople = [
  { name: "Priya", meetingCount: 5 },
  { name: "David", meetingCount: 3 },
  { name: "Sarah", meetingCount: 2 },
  { name: "Jordan", meetingCount: 1 },
];

const mockTeams: Team[] = [
  {
    id: "team-1",
    name: "Product launch",
    created_by: "preview-user",
    created_at: "2026-09-18T10:00:00.000Z",
    role: "owner",
  },
  {
    id: "team-2",
    name: "Client success",
    created_by: "someone-else",
    created_at: "2026-09-10T10:00:00.000Z",
    role: "member",
  },
];

export default async function PeoplePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const query = await searchParams;

  return (
    <AppShell userEmail="maya@example.com">
      <PeopleClient
        people={mockPeople}
        teams={mockTeams}
        userId="preview-user"
        initialView={query.view === "groups" ? "groups" : "people"}
      />
    </AppShell>
  );
}
