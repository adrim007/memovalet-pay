import TeamsClient from "@/components/TeamsClient";
import { Team } from "@/lib/types";

export default function TeamsPreviewPage() {
  const mockTeams: Team[] = [
    {
      id: "team-1",
      name: "Product",
      created_by: "user-1",
      created_at: new Date().toISOString(),
      role: "owner",
    },
    {
      id: "team-2",
      name: "Sales",
      created_by: "user-2",
      created_at: new Date().toISOString(),
      role: "member",
    },
  ];

  return (
    <div className="p-8">
      <TeamsClient teams={mockTeams} userId="user-1" />
    </div>
  );
}
