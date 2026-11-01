import AppShell from "@/components/AppShell";
import ProjectsClient from "@/components/ProjectsClient";
import { Project } from "@/lib/types";

const mockProjects: Project[] = [
  {
    id: "proj-1",
    created_by: "user-1",
    priority: "high" as const,
    team_id: null,
    name: "Acme renewal",
    client_name: "Acme Corp",
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: "proj-2",
    created_by: "user-1",
    team_id: null,
    name: "Q3 platform migration",
    client_name: null,
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: "proj-3",
    created_by: "user-1",
    team_id: null,
    name: "Nova Robotics onboarding",
    client_name: "Nova Robotics",
    status: "closed",
    created_at: new Date().toISOString(),
  },
];

export default function ProjectsPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com">
      <ProjectsClient projects={mockProjects} userId="user-1" />
    </AppShell>
  );
}
